import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SENTRY_API_BASE_URL, sentryEnv } from './sentry.config';

type SentryLogsQuery = {
  query?: string;
  statsPeriod?: string;
  limit?: number;
  projects?: string[];
};

/** Sentry allows at most 20 fields per request. */
const SENTRY_LOG_FIELDS = [
  'id',
  'timestamp',
  'message',
  'severity',
  'trace',
  'project',
  'environment',
  'release',
  'thread_id',
  'payload_size',
  'connection_state',
  'tags[user_id]',
  'tags[message_id]',
  'tags[status]',
  'tags[event_type]',
  'tags[platform]',
  'tags[version]',
  'server_to_client_ms'
] as const;

const TIMING_FIELDS = [
  'client_to_server_ms',
  'server_to_client_ms',
  'latency_ms',
  'provider_latency_ms',
] as const;

type SentryLogRow = Record<string, unknown>;

function parseAttributeName(name: string) {
  const typedTag = name.match(/^tags\[(.+),(?:number|string|boolean)\]$/);
  if (typedTag) return typedTag[1];

  const simpleTag = name.match(/^tags\[(.+)\]$/);
  if (simpleTag) return simpleTag[1];

  return name;
}

function coerceAttributeValue(type: string | undefined, value: unknown) {
  if (value == null) return null;

  if (type === 'int' || type === 'number') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  if (type === 'bool' || type === 'boolean') {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
  }

  return value;
}

function normalizeSentryRow(row: SentryLogRow) {
  const out: SentryLogRow = {};

  for (const [key, value] of Object.entries(row)) {
    out[parseAttributeName(key)] = value;
  }

  return out;
}

function mapTraceItemAttributes(attributes: unknown): SentryLogRow {
  const out: SentryLogRow = {};

  if (!Array.isArray(attributes)) return out;

  for (const entry of attributes) {
    if (!entry || typeof entry !== 'object') continue;

    const { name, type, value } = entry as {
      name?: string;
      type?: string;
      value?: unknown;
    };

    if (!name) continue;
    out[parseAttributeName(name)] = coerceAttributeValue(type, value);
  }

  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  concurrency = 8,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  return results;
}

@Injectable()
export class SentryService {
  private async sentryFetch(url: string) {
    const { authToken } = sentryEnv();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  private async fetchTraceItemDetails(
    project: string,
    itemId: string,
    traceId: string,
  ) {
    const { org } = sentryEnv();
    const params = new URLSearchParams({
      item_type: 'logs',
      trace_id: traceId,
    });

    const url =
      `${SENTRY_API_BASE_URL}/projects/${org}/${project}/trace-items/${itemId}/` +
      `?${params.toString()}`;

    const { response, data } = await this.sentryFetch(url);
    if (!response.ok) return null;

    return mapTraceItemAttributes(data?.attributes);
  }

  private async enrichRowFromTraceItem(row: SentryLogRow) {
    const itemId = String(row.id ?? '');
    const traceId = String(row.trace ?? '');
    const project = String(row.project ?? 'orth-mobile');

    if (!itemId || !traceId) return row;

    const details = await this.fetchTraceItemDetails(project, itemId, traceId);
    if (!details) return row;

    const enriched = { ...row };

    for (const [key, value] of Object.entries(details)) {
      const shouldFillTiming =
        (TIMING_FIELDS as readonly string[]).includes(key) &&
        enriched[key] == null;

      if (shouldFillTiming || enriched[key] == null) {
        enriched[key] = value;
      }
    }

    return enriched;
  }

  async fetchOrthMessageCompletedLogs(options: SentryLogsQuery = {}) {
    const { org, authToken } = sentryEnv();

    if (!authToken) {
      throw new ServiceUnavailableException(
        'SENTRY_AUTH_TOKEN is not configured on the server',
      );
    }

    const query = options.query ?? 'event_type:orth_message_completed';
    const statsPeriod = options.statsPeriod ?? '24h';
    const limit = options.limit ?? 100;
    const projects = options.projects ?? ['orth-mobile', 'orth-web'];

    const params = new URLSearchParams();
    params.set('dataset', 'ourlogs');
    params.set('query', query);
    for (const field of SENTRY_LOG_FIELDS) {
      params.append('field', field);
    }
    for (const project of projects) {
      params.append('project', project);
    }
    params.set('statsPeriod', statsPeriod);
    params.set('limit', String(limit));

    const url = `${SENTRY_API_BASE_URL}/organizations/${org}/events/?${params.toString()}`;

    const { response, data } = await this.sentryFetch(url);

    if (!response.ok) {
      throw new HttpException(
        {
          message: 'Sentry API request failed',
          status: response.status,
          data,
        },
        response.status,
      );
    }

    const rows = Array.isArray(data?.data) ? (data.data as SentryLogRow[]) : [];
    const normalized = rows.map((row) => normalizeSentryRow(row));
    const enriched = await mapWithConcurrency(normalized, (row) =>
      this.enrichRowFromTraceItem(row),
    );

    return {
      status: response.status,
      data: {
        ...data,
        data: enriched,
      },
    };
  }
}
