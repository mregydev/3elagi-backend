import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PointsModule } from '../points/points.module';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { Appointment } from '../entities/appointment.entity';
import { Consultation } from '../entities/consultation.entity';
import { DoctorReview } from '../entities/review.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { Symptom } from '../entities/symptom.entity';
import { User } from '../entities/user.entity';
import { AiCacheService } from './ai-cache.service';
import { AiChatService } from './ai-chat.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { AiContextRegistryService } from './ai-context-registry.service';
import { AiController } from './ai.controller';
import { AiGuestController } from './ai-guest.controller';
import { AiGateway } from './ai.gateway';
import { AiIntentClassifierService } from './ai-intent-classifier.service';
import { AiPromptService } from './ai-prompt.service';
import { AiLinkValidatorService } from './ai-link-validator.service';
import { AiResponseService } from './ai-response.service';
import { AiService } from './ai.service';
import { AiStreamService } from './ai-stream.service';
import { DoctorPatientsContextSource } from './context/sources/doctor-patients.context-source';
import { DoctorPracticeInsightsContextSource } from './context/sources/doctor-practice-insights.context-source';
import { DoctorProfileContextSource } from './context/sources/doctor-profile.context-source';
import { DoctorMedicationMarketContextSource } from './context/sources/doctor-medication-market.context-source';
import { DoctorsContextSource } from './context/sources/doctors.context-source';
import { AdminKnowledgeContextSource } from './context/sources/admin-knowledge.context-source';
import { GeneralKnowledgeContextSource } from './context/sources/general-knowledge.context-source';
import { AppointmentsContextSource } from './context/sources/appointments.context-source';
import { ConsultationsContextSource } from './context/sources/consultations.context-source';
import { MedicalRecordsContextSource } from './context/sources/medical-records.context-source';
import { PatientHealthInsightsContextSource } from './context/sources/patient-health-insights.context-source';
import { PatientProfileContextSource } from './context/sources/patient-profile.context-source';
import { EmbeddingsService, embeddingsProviderFactory } from './embeddings.service';
import { KnowledgeIndexerService } from './knowledge-indexer.service';
import { GeminiLlmProvider } from './llm/gemini.provider';
import { LLM_PROVIDER } from './llm/llm.tokens';
import { VectorSearchService } from './vector-search.service';
import { MessageEmotionsModule } from '../message-emotions/message-emotions.module';
import { MessageEmotionsService } from '../message-emotions/message-emotions.service';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    AuthModule,
    PointsModule,
    UploadsModule,
    MessageEmotionsModule,
    PushNotificationsModule,
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
      User,
      Appointment,
      Consultation,
    ]),
  ],
  controllers: [AiController, AiGuestController],
  providers: [
    AiService,
    AiChatService,
    AiStreamService,
    AiPromptService,
    AiIntentClassifierService,
    AiContextRegistryService,
    AiContextBuilderService,
    AiResponseService,
    AiLinkValidatorService,
    DoctorProfileContextSource,
    DoctorMedicationMarketContextSource,
    DoctorPatientsContextSource,
    DoctorPracticeInsightsContextSource,
    PatientProfileContextSource,
    PatientHealthInsightsContextSource,
    MedicalRecordsContextSource,
    DoctorsContextSource,
    AdminKnowledgeContextSource,
    GeneralKnowledgeContextSource,
    AppointmentsContextSource,
    ConsultationsContextSource,
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
  exports: [KnowledgeIndexerService, AiService, AiChatService, LLM_PROVIDER],
})
export class AiModule {}
