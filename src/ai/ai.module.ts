import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorReview } from '../entities/review.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { Symptom } from '../entities/symptom.entity';
import { AiCacheService } from './ai-cache.service';
import { AiChatService } from './ai-chat.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { AiContextRegistryService } from './ai-context-registry.service';
import { AiController } from './ai.controller';
import { AiGateway } from './ai.gateway';
import { AiIntentClassifierService } from './ai-intent-classifier.service';
import { AiPromptService } from './ai-prompt.service';
import { AiService } from './ai.service';
import { AiStreamService } from './ai-stream.service';
import { DoctorsContextSource } from './context/sources/doctors.context-source';
import { GeneralKnowledgeContextSource } from './context/sources/general-knowledge.context-source';
import { MedicalRecordsContextSource } from './context/sources/medical-records.context-source';
import { PatientProfileContextSource } from './context/sources/patient-profile.context-source';
import { EmbeddingsService, embeddingsProviderFactory } from './embeddings.service';
import { KnowledgeIndexerService } from './knowledge-indexer.service';
import { GeminiLlmProvider } from './llm/gemini.provider';
import { LLM_PROVIDER } from './llm/llm.tokens';
import { VectorSearchService } from './vector-search.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AiConversation,
      AiMessage,
      AiUsageLog,
      PatientProfile,
      Doctor,
      DoctorReview,
      DoctorSpeciality,
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
    AiChatService,
    AiStreamService,
    AiPromptService,
    AiIntentClassifierService,
    AiContextRegistryService,
    AiContextBuilderService,
    PatientProfileContextSource,
    MedicalRecordsContextSource,
    DoctorsContextSource,
    GeneralKnowledgeContextSource,
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
  exports: [KnowledgeIndexerService, AiService, AiChatService],
})
export class AiModule {}
