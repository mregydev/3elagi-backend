import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiResponseService, type AiLinkEntry } from './ai-response.service';
import type { RetrievedChunk } from './ai-prompt.service';
import { AiIntentClassifierService } from './ai-intent-classifier.service';
import { AiContextRegistryService } from './ai-context-registry.service';
import { VectorSearchService } from './vector-search.service';
import { shouldSkipRetrieval } from './utils/skip-retrieval';
import type {
  AiContextBuildResult,
  AiContextUser,
} from './context/ai-context.types';

export const AI_PROMPT_VERSION = 'v13';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MEDICAL_ENTITY_TYPES = new Set([
  'diagnosis',
  'lab_result',
  'imaging',
  'prescription',
  'medical_record',
]);

@Injectable()
export class AiContextBuilderService {
  constructor(
    private readonly registry: AiContextRegistryService,
    private readonly intentClassifier: AiIntentClassifierService,
    private readonly vectorSearch: VectorSearchService,
    private readonly response: AiResponseService,
  ) {}

  async build(
    user: AiContextUser,
    question: string,
  ): Promise<AiContextBuildResult> {
    if (this.intentClassifier.detectUrgent(question)) {
      return {
        intent: 'mixed_question',
        contextText: '',
        chunks: [],
        links: [],
        contextVersion: 'urgent',
        promptVersion: AI_PROMPT_VERSION,
        urgent: true,
        urgentMessage: this.intentClassifier.urgentResponse(user.preferredLocale),
      };
    }

    const intent = this.intentClassifier.classify(question);
    const allowedIntents = this.intentClassifier.intentsForSource(intent);

    const sections: string[] = [];
    const versionParts: string[] = [AI_PROMPT_VERSION, intent];
    const links: AiLinkEntry[] = [];

    for (const source of this.registry.getSources()) {
      if (!source.canHandle(question, intent)) continue;
      if (
        !allowedIntents.some((i) => source.canHandle(question, i)) &&
        intent !== 'mixed_question'
      ) {
        continue;
      }

      const data = await source.fetchContext(user, question);
      const text = source.buildContextText(data).trim();
      if (text) sections.push(text);
      this.collectLinksFromText(text, links);
      versionParts.push(await source.getVersionKey(user));
    }

    let chunks: RetrievedChunk[] = [];
    // Include general_medical_question so admin-trained platform knowledge can surface.
    if (
      !shouldSkipRetrieval(question) &&
      (intent === 'medical_record_question' ||
        intent === 'doctor_practice_question' ||
        intent === 'health_recommendation_question' ||
        intent === 'doctor_coaching_question' ||
        intent === 'mixed_question' ||
        intent === 'doctor_recommendation_question' ||
        intent === 'general_medical_question')
    ) {
      const search = await this.vectorSearch.search(question, {
        userId: user.id,
        userRole: user.role,
        patientUserId: user.patientContextId ?? undefined,
        limit: 8,
      });
      chunks = search.chunks;
      this.collectLinksFromChunks(chunks, links);
      if (chunks.length) {
        const hasAdmin = chunks.some((c) => c.entityType === 'admin_knowledge');
        sections.push(
          (hasAdmin
            ? '[Vector search — authorized records and platform knowledge]\n'
            : '[Vector search — authorized records]\n') +
            chunks
              .map((c, i) => {
                const link = this.linkPathForChunk(c);
                const linkLine = link ? `\nLink: ${link}` : '';
                return `[${i + 1} | ${c.entityType}]\n${c.text}${linkLine}`;
              })
              .join('\n\n'),
        );
      }
    }

    const linkCatalog = this.response.buildLinkCatalog(links);
    if (linkCatalog) sections.push(linkCatalog);

    const contextVersion = createHash('sha256')
      .update(versionParts.join('|'))
      .digest('hex')
      .slice(0, 16);

    return {
      intent,
      contextText: sections.join('\n\n---\n\n') || 'No context retrieved.',
      chunks,
      links,
      contextVersion,
      promptVersion: AI_PROMPT_VERSION,
      urgent: false,
    };
  }

  private collectLinksFromChunks(chunks: RetrievedChunk[], links: AiLinkEntry[]) {
    for (const chunk of chunks) {
      const path = this.linkPathForChunk(chunk);
      if (!path) continue;
      const label = this.labelForChunk(chunk);
      this.pushLink(links, { label, path, kind: chunk.entityType === 'doctor_profile' ? 'doctor_profile' : 'medical_record' });
    }
  }

  private collectLinksFromText(text: string, links: AiLinkEntry[]) {
    const lines = text.split('\n');
    for (const line of lines) {
      const medical = line.match(/^Link:\s*(\/medical\/[0-9a-f-]+)\s*(?:\|\s*(.+))?$/i);
      if (medical) {
        this.pushLink(links, {
          label: medical[2]?.trim() || 'Medical record',
          path: medical[1],
          kind: 'medical_record',
        });
        continue;
      }
      const doctor = line.match(/^Link:\s*(\/doctor\/[0-9a-f-]+)\s*(?:\|\s*(.+))?$/i);
      if (doctor) {
        this.pushLink(links, {
          label: doctor[2]?.trim() || 'Doctor profile',
          path: doctor[1],
          kind: 'doctor_profile',
        });
      }
    }
  }

  private linkPathForChunk(chunk: RetrievedChunk): string | null {
    if (!chunk.entityId) return null;
    if (!UUID_RE.test(chunk.entityId)) return null;
    if (chunk.entityType === 'doctor_profile') {
      return `/doctor/${chunk.entityId}`;
    }
    if (MEDICAL_ENTITY_TYPES.has(chunk.entityType)) {
      return `/medical/${chunk.entityId}`;
    }
    return null;
  }

  private labelForChunk(chunk: RetrievedChunk): string {
    const metadata = chunk.metadata ?? {};
    const title =
      (typeof metadata.title === 'string' && metadata.title) ||
      (typeof metadata.diagnosis === 'string' && metadata.diagnosis) ||
      (typeof metadata.name === 'string' && metadata.name) ||
      null;
    if (title) {
      return chunk.entityType === 'doctor_profile' ? `Dr ${title}` : title;
    }
    const firstLine = chunk.text.split('\n').find((line) => line.trim()) ?? 'Record';
    return firstLine.replace(/^(Diagnosis|Record type|Doctor):\s*/i, '').trim() || 'Record';
  }

  private pushLink(links: AiLinkEntry[], entry: AiLinkEntry) {
    if (!this.isValidLinkPath(entry.path)) return;
    if (links.some((link) => link.path === entry.path)) return;
    links.push(entry);
  }

  private isValidLinkPath(path: string): boolean {
    const medical = path.match(/^\/medical\/(.+)$/i);
    if (medical) return UUID_RE.test(medical[1]);
    const doctor = path.match(/^\/doctor\/(.+)$/i);
    if (doctor) return UUID_RE.test(doctor[1]);
    return false;
  }
}
