import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { RetrievedChunk } from './ai-prompt.service';
import { AiIntentClassifierService } from './ai-intent-classifier.service';
import { AiContextRegistryService } from './ai-context-registry.service';
import { VectorSearchService } from './vector-search.service';
import { shouldSkipRetrieval } from './utils/skip-retrieval';
import type {
  AiContextBuildResult,
  AiContextUser,
} from './context/ai-context.types';

export const AI_PROMPT_VERSION = 'v3';

@Injectable()
export class AiContextBuilderService {
  constructor(
    private readonly registry: AiContextRegistryService,
    private readonly intentClassifier: AiIntentClassifierService,
    private readonly vectorSearch: VectorSearchService,
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
        contextVersion: 'urgent',
        promptVersion: AI_PROMPT_VERSION,
        urgent: true,
        urgentMessage: this.intentClassifier.urgentResponse(),
      };
    }

    const intent = this.intentClassifier.classify(question);
    const allowedIntents = this.intentClassifier.intentsForSource(intent);

    const sections: string[] = [];
    const versionParts: string[] = [AI_PROMPT_VERSION, intent];

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
      versionParts.push(await source.getVersionKey(user));
    }

    let chunks: RetrievedChunk[] = [];
    if (
      !shouldSkipRetrieval(question) &&
      (intent === 'medical_record_question' ||
        intent === 'doctor_practice_question' ||
        intent === 'mixed_question' ||
        intent === 'doctor_recommendation_question')
    ) {
      const search = await this.vectorSearch.search(question, {
        userId: user.id,
        userRole: user.role,
        patientUserId: user.patientContextId ?? undefined,
        limit: 8,
      });
      chunks = search.chunks;
      if (chunks.length) {
        sections.push(
          '[Vector search — authorized records]\n' +
            chunks
              .map(
                (c, i) =>
                  `[${i + 1} | ${c.entityType}]\n${c.text}`,
              )
              .join('\n\n'),
        );
      }
    }

    const contextVersion = createHash('sha256')
      .update(versionParts.join('|'))
      .digest('hex')
      .slice(0, 16);

    return {
      intent,
      contextText: sections.join('\n\n---\n\n') || 'No context retrieved.',
      chunks,
      contextVersion,
      promptVersion: AI_PROMPT_VERSION,
      urgent: false,
    };
  }
}
