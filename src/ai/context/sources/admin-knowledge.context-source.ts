import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';
import { EmbeddingsService } from '../../embeddings.service';

type AdminChunk = {
  title: string;
  text: string;
  sourceId?: string;
};

type AdminKnowledgePayload = {
  chunks: AdminChunk[];
};

/** Platform knowledge trained by admins (text / PDF / DOCX) for the AI assistant. */
@Injectable()
export class AdminKnowledgeContextSource implements AIContextSource {
  readonly name = 'admin_knowledge';
  private readonly logger = new Logger(AdminKnowledgeContextSource.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly embeddings: EmbeddingsService,
  ) {}

  canHandle(_question: string, intent: AiIntent): boolean {
    // Always available — admin RAG is platform knowledge for every assistant turn.
    return (
      intent === 'general_medical_question' ||
      intent === 'health_recommendation_question' ||
      intent === 'doctor_coaching_question' ||
      intent === 'doctor_recommendation_question' ||
      intent === 'medical_record_question' ||
      intent === 'mixed_question' ||
      intent === 'patient_profile_question' ||
      intent === 'doctor_profile_question' ||
      intent === 'doctor_practice_question'
    );
  }

  async fetchContext(
    _user: AiContextUser,
    question: string,
  ): Promise<AdminKnowledgePayload> {
    const chunks = await this.fetchRelevantChunks(question, 8);
    return { chunks };
  }

  buildContextText(data: unknown): string {
    const payload = data as AdminKnowledgePayload | null;
    const chunks = payload?.chunks ?? [];
    if (!chunks.length) return '';

    const lines = [
      '[Platform knowledge — trained by 3elagi admins]',
      'Use this content when it helps answer the user. Prefer it over general knowledge when it is relevant. Do not invent details that are not in these sources.',
    ];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const title = chunk.title?.trim() || 'Untitled source';
      lines.push('', `[Source ${i + 1}: ${title}]`, chunk.text.trim());
    }
    return lines.join('\n');
  }

  async getVersionKey(): Promise<string> {
    const rows = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS count, COALESCE(MAX(updated_at)::text, 'none') AS max_updated
      FROM ai_knowledge_chunks
      WHERE entity_type = 'admin_knowledge'
      `,
    );
    const count = rows[0]?.count ?? 0;
    const maxUpdated = rows[0]?.max_updated ?? 'none';
    return `admin_knowledge:${count}:${maxUpdated}`;
  }

  private async fetchRelevantChunks(
    question: string,
    limit: number,
  ): Promise<AdminChunk[]> {
    const q = question.trim();
    try {
      if (q) {
        const embedding = await this.embeddings.embedQuery(q);
        if (embedding?.length) {
          const vectorLiteral = `[${embedding.join(',')}]`;
          const rows = await this.dataSource.query(
            `
            SELECT text, metadata
            FROM ai_knowledge_chunks
            WHERE entity_type = 'admin_knowledge'
              AND embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $2
            `,
            [vectorLiteral, limit],
          );
          if (rows.length) return rows.map((row: any) => this.mapRow(row));
        }
      }
    } catch (err) {
      this.logger.warn(
        `Admin knowledge vector lookup failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Fallback: keyword match + newest chunks so trained content still reaches the model.
    const tokens = q
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
      .slice(0, 6);

    if (tokens.length) {
      const likeClauses = tokens
        .map((_, i) => `(LOWER(text) LIKE $${i + 1} OR LOWER(COALESCE(metadata->>'title','')) LIKE $${i + 1})`)
        .join(' OR ');
      const params = tokens.map((t) => `%${t}%`);
      params.push(String(limit));
      const rows = await this.dataSource.query(
        `
        SELECT text, metadata
        FROM ai_knowledge_chunks
        WHERE entity_type = 'admin_knowledge'
          AND (${likeClauses})
        ORDER BY updated_at DESC
        LIMIT $${params.length}
        `,
        params,
      );
      if (rows.length) return rows.map((row: any) => this.mapRow(row));
    }

    const recent = await this.dataSource.query(
      `
      SELECT text, metadata
      FROM ai_knowledge_chunks
      WHERE entity_type = 'admin_knowledge'
      ORDER BY updated_at DESC
      LIMIT $1
      `,
      [limit],
    );
    return recent.map((row: any) => this.mapRow(row));
  }

  private mapRow(row: {
    text: string;
    metadata?: Record<string, unknown> | null;
  }): AdminChunk {
    const meta = row.metadata ?? {};
    return {
      title: typeof meta.title === 'string' ? meta.title : 'Admin knowledge',
      text: row.text ?? '',
      sourceId: typeof meta.sourceId === 'string' ? meta.sourceId : undefined,
    };
  }
}
