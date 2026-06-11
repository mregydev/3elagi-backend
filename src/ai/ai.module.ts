import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { Symptom } from '../entities/symptom.entity';
import { AiCacheService } from './ai-cache.service';
import { AiController } from './ai.controller';
import { AiGateway } from './ai.gateway';
import { AiPromptService } from './ai-prompt.service';
import { AiService } from './ai.service';
import { EmbeddingsService, embeddingsProviderFactory } from './embeddings.service';
import { KnowledgeIndexerService } from './knowledge-indexer.service';
import { GeminiLlmProvider } from './llm/gemini.provider';
import { LLM_PROVIDER } from './llm/llm.tokens';
import { VectorSearchService } from './vector-search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiConversation,
      AiMessage,
      AiUsageLog,
      PatientProfile,
      Doctor,
      Diagnosis,
      Symptom,
      MedicalDocument,
      Prescription,
      Patient,
      DoctorPatientAccess,
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiPromptService,
    EmbeddingsService,
    embeddingsProviderFactory,
    VectorSearchService,
    AiCacheService,
    KnowledgeIndexerService,
    AiGateway,
    {
      provide: LLM_PROVIDER,
      useClass: GeminiLlmProvider,
    },
  ],
  exports: [KnowledgeIndexerService, AiService],
})
export class AiModule {}
