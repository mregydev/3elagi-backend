import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Clinic } from './entities/clinic.entity';
import { Doctor } from './entities/doctor.entity';
import { ClinicJoinRequest } from './entities/clinic-join-request.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { MedicalDocument } from './entities/medical-document.entity';
import { Diagnosis } from './entities/diagnosis.entity';
import { Symptom } from './entities/symptom.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionMedication } from './entities/prescription-medication.entity';
import { PrescriptionTemplate } from './entities/prescription-template.entity';
import { IntakeTest } from './entities/intake-test.entity';
import { IntakeExamAssignment } from './entities/intake-exam-assignment.entity';
import { IntakeExamInstance } from './entities/intake-exam-instance.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { DoctorScheduleOverride } from './entities/doctor-schedule-override.entity';
import { InitialSchema1777599963712 } from './migrations/1777599963712-InitialSchema';
import { AddIsPersonalToClinic1777600000001 } from './migrations/1777600000001-AddIsPersonalToClinic';
import { PrescriptionsAndSettings1777800000000 } from './migrations/1777800000000-PrescriptionsAndSettings';
import { PrescriptionTemplates1777810000000 } from './migrations/1777810000000-PrescriptionTemplates';
import { AddClinicLogo1777820000000 } from './migrations/1777820000000-AddClinicLogo';
import { IntakeTests1777830000000 } from './migrations/1777830000000-IntakeTests';
import { PatientPortal1777840000000 } from './migrations/1777840000000-PatientPortal';
import { ScheduleOverrides1777850000000 } from './migrations/1777850000000-ScheduleOverrides';
import { AdminAndIntakeSimplify1777860000000 } from './migrations/1777860000000-AdminAndIntakeSimplify';
import { PatientPhotoAndIntakeEndpoints1777870000000 } from './migrations/1777870000000-PatientPhotoAndIntakeEndpoints';
import { DoctorProfileAndApproval1777880000000 } from './migrations/1777880000000-DoctorProfileAndApproval';
import { DoctorFaqsAndReviews1777890000000 } from './migrations/1777890000000-DoctorFaqsAndReviews';
import { DoctorTags1777900000000 } from './migrations/1777900000000-DoctorTags';
import { PatientOnboardingIntake1777910000000 } from './migrations/1777910000000-PatientOnboardingIntake';
import { AppointmentHideName1777920000000 } from './migrations/1777920000000-AppointmentHideName';
import { AppointmentApproval1777930000000 } from './migrations/1777930000000-AppointmentApproval';
import { DiagnosisAndSymptoms1777940000000 } from './migrations/1777940000000-DiagnosisAndSymptoms';
import { AddPatientsPhotoUrl1777950000000 } from './migrations/1777950000000-AddPatientsPhotoUrl';
import { AddUsersPhotoUrl1777960000000 } from './migrations/1777960000000-AddUsersPhotoUrl';
import { MedicalDocumentsTitle1777970000000 } from './migrations/1777970000000-MedicalDocumentsTitle';
import { NullableDiagnosisDoctor1777980000000 } from './migrations/1777980000000-NullableDiagnosisDoctor';
import { SymptomDoctorId1777990000000 } from './migrations/1777990000000-SymptomDoctorId';
import { SpecialitiesAndAdvertisements1778000000000 } from './migrations/1778000000000-SpecialitiesAndAdvertisements';
import { FixSpecialityImagesAndAssignDoctors1778010000000 } from './migrations/1778010000000-FixSpecialityImagesAndAssignDoctors';
import { UpdateSpecialityExpressiveImages1778020000000 } from './migrations/1778020000000-UpdateSpecialityExpressiveImages';
import { BundledSpecialityImages1778030000000 } from './migrations/1778030000000-BundledSpecialityImages';
import { SurgeryAndAlaadocSpecialities1778040000000 } from './migrations/1778040000000-SurgeryAndAlaadocSpecialities';
import { RemoveDemoDoctors1778050000000 } from './migrations/1778050000000-RemoveDemoDoctors';
import { DoctorReview } from './entities/review.entity';
import { DoctorSpeciality } from './entities/doctor-speciality.entity';
import { Advertisement } from './entities/advertisement.entity';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ContactModule } from './contact/contact.module';
import { ClinicsModule } from './clinics/clinics.module';
import { DoctorsModule } from './doctors/doctors.module';
import { JoinRequestsModule } from './join-requests/join-requests.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { MedicalDocumentsModule } from './medical-documents/medical-documents.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { PrescriptionTemplatesModule } from './prescription-templates/prescription-templates.module';
import { IntakeTestsModule } from './intake-tests/intake-tests.module';
import { IntakeExamsModule } from './intake-exams/intake-exams.module';
import { SchedulesModule } from './schedules/schedules.module';
import { PatientPortalModule } from './patient-portal/patient-portal.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { DiagnosisModule } from './diagnosis/diagnosis.module';
import { SymptomsModule } from './symptoms/symptoms.module';
import { SpecialitiesModule } from './specialities/specialities.module';
import { AdvertisementsModule } from './advertisements/advertisements.module';
import { PresenceModule } from './presence/presence.module';
import { MessagesModule } from './messages/messages.module';
import { Message } from './entities/message.entity';
import { MessagesTable1778060000000 } from './migrations/1778060000000-MessagesTable';
import { MessageAttachmentsAndRead1778070000000 } from './migrations/1778070000000-MessageAttachmentsAndRead';
import { MessageEditedAt1778080000000 } from './migrations/1778080000000-MessageEditedAt';
import { DoctorPatientAccess1778090000000 } from './migrations/1778090000000-DoctorPatientAccess';
import { DoctorPatientAccess } from './entities/doctor-patient-access.entity';
import { DoctorPatientAccessModule } from './doctor-patient-access/doctor-patient-access.module';
import { UserMessagePoints1778100000000 } from './migrations/1778100000000-UserMessagePoints';
import { DoctorMessagePrice1778110000000 } from './migrations/1778110000000-DoctorMessagePrice';
import { AiAssistant1778120000000 } from './migrations/1778120000000-AiAssistant';
import { EnsureDefaultMessagePoints1778100000001 } from './migrations/1778100000001-EnsureDefaultMessagePoints';
import { PointsModule } from './points/points.module';
import { AiModule } from './ai/ai.module';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { MessageEmotions1778130000000 } from './migrations/1778130000000-MessageEmotions';
import { MessageEmotionDislike1778140000000 } from './migrations/1778140000000-MessageEmotionDislike';
import { MessageEmotion } from './entities/message-emotion.entity';
import { MessageEmotionsModule } from './message-emotions/message-emotions.module';
import { PrescriptionMedications1778160000000 } from './migrations/1778160000000-PrescriptionMedications';
import { PrescriptionImageUrl1778170000000 } from './migrations/1778170000000-PrescriptionImageUrl';
import { DeviceTokens1778180000000 } from './migrations/1778180000000-DeviceTokens';
import { DiagnosisDocumentsManyToMany1778190000000 } from './migrations/1778190000000-DiagnosisDocumentsManyToMany';
import { MedicalRecordAiInsight1778210000000 } from './migrations/1778210000000-MedicalRecordAiInsight';
import { UserPreferredLocale1778220000000 } from './migrations/1778220000000-UserPreferredLocale';
import { DeviceToken } from './entities/device-token.entity';
import { DiagnosisDocument } from './entities/diagnosis-document.entity';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { TtsModule } from './tts/tts.module';
import { SttModule } from './stt/stt.module';
import { WherebyModule } from './whereby/whereby.module';
import { VideoCallsModule } from './video-calls/video-calls.module';
import { VideoCallSession } from './entities/video-call-session.entity';
import { VideoCallSessions1778230000000 } from './migrations/1778230000000-VideoCallSessions';
import { AppointmentChatFields1778240000000 } from './migrations/1778240000000-AppointmentChatFields';
import { AdminRagSources1778250000000 } from './migrations/1778250000000-AdminRagSources';
import { IntakeExamInstances1778260000000 } from './migrations/1778260000000-IntakeExamInstances';
import { DoctorCertifications1778270000000 } from './migrations/1778270000000-DoctorCertifications';
import { Consultations1778280000000 } from './migrations/1778280000000-Consultations';
import { ConsultationPriceCap1778290000000 } from './migrations/1778290000000-ConsultationPriceCap';
import { PointsReimbursed1778300000000 } from './migrations/1778300000000-PointsReimbursed';
import { ConsultationComplaints1778310000000 } from './migrations/1778310000000-ConsultationComplaints';
import { DoctorPriceEgpCredits1778320000000 } from './migrations/1778320000000-DoctorPriceEgpCredits';
import { VideoConsultationPrice1778330000000 } from './migrations/1778330000000-VideoConsultationPrice';
import { AiMessageAttachments1778340000000 } from './migrations/1778340000000-AiMessageAttachments';
import { PatientMedicalRecordsConsent1778350000000 } from './migrations/1778350000000-PatientMedicalRecordsConsent';
import { AppointmentAiInsight1778360000000 } from './migrations/1778360000000-AppointmentAiInsight';
import { PaymentIntentions1778370000000 } from './migrations/1778370000000-PaymentIntentions';
import { VideoCallDuration1778380000000 } from './migrations/1778380000000-VideoCallDuration';
import { DoctorBankDetails1778390000000 } from './migrations/1778390000000-DoctorBankDetails';
import { MedicalRecordBodyPart1778400000000 } from './migrations/1778400000000-MedicalRecordBodyPart';
import { PaymentIntention } from './entities/payment-intention.entity';
import { PaymentsModule } from './payments/payments.module';
import { AdminRagSource } from './entities/admin-rag-source.entity';
import { Consultation } from './entities/consultation.entity';
import { ConsultationComplaint } from './entities/consultation-complaint.entity';
import { MedicalDocumentRequest } from './entities/medical-document-request.entity';
import { MedicalDocumentRequests1778410000000 } from './migrations/1778410000000-MedicalDocumentRequests';
import { DiagnosisPrescriptionIntakeLinks1778420000000 } from './migrations/1778420000000-DiagnosisPrescriptionIntakeLinks';
import { PatientProfileCountry1778430000000 } from './migrations/1778430000000-PatientProfileCountry';
import { DoctorCountry1778440000000 } from './migrations/1778440000000-DoctorCountry';
import { PaymentIntentionMarketPricing1778450000000 } from './migrations/1778450000000-PaymentIntentionMarketPricing';
import { UserEmailVerificationAndPasswordReset1778460000000 } from './migrations/1778460000000-UserEmailVerificationAndPasswordReset';
import { EmergencyAndGynaecologySpecialities1778470000000 } from './migrations/1778470000000-EmergencyAndGynaecologySpecialities';
import { ThreelagiCampaignBanners1778480000000 } from './migrations/1778480000000-ThreelagiCampaignBanners';
import { SpecialityMarketVisibility1778490000000 } from './migrations/1778490000000-SpecialityMarketVisibility';
import { NutritionistSpeciality1778500000000 } from './migrations/1778500000000-NutritionistSpeciality';
import { UserNotifications1778510000000 } from './migrations/1778510000000-UserNotifications';
import { PointPricing } from './entities/point-pricing.entity';
import { DoctorImmediateCalls1778520000000 } from './migrations/1778520000000-DoctorImmediateCalls';
import { PointPricing1778530000000 } from './migrations/1778530000000-PointPricing';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { MedicalDocumentRequestsModule } from './medical-document-requests/medical-document-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          PointPricing,
          User,
          Clinic,
          Doctor,
          ClinicJoinRequest,
          Patient,
          Appointment,
          MedicalDocument,
          Diagnosis,
          Symptom,
          Prescription,
          PrescriptionMedication,
          PrescriptionTemplate,
          IntakeTest,
          IntakeExamAssignment,
          IntakeExamInstance,
          PatientProfile,
          DoctorSchedule,
          DoctorScheduleOverride,
          DoctorReview,
          DoctorSpeciality,
          Advertisement,
          Message,
          DoctorPatientAccess,
          AiConversation,
          AiMessage,
          AiUsageLog,
          MessageEmotion,
          DeviceToken,
          DiagnosisDocument,
          VideoCallSession,
          AdminRagSource,
          Consultation,
          ConsultationComplaint,
          PaymentIntention,
          MedicalDocumentRequest,
          UserNotification,
        ],
        synchronize: false,
        migrations: [
          InitialSchema1777599963712,
          AddIsPersonalToClinic1777600000001,
          PrescriptionsAndSettings1777800000000,
          PrescriptionTemplates1777810000000,
          AddClinicLogo1777820000000,
          IntakeTests1777830000000,
          PatientPortal1777840000000,
          ScheduleOverrides1777850000000,
          AdminAndIntakeSimplify1777860000000,
          PatientPhotoAndIntakeEndpoints1777870000000,
          DoctorProfileAndApproval1777880000000,
          DoctorFaqsAndReviews1777890000000,
          DoctorTags1777900000000,
          PatientOnboardingIntake1777910000000,
          AppointmentHideName1777920000000,
          AppointmentApproval1777930000000,
          DiagnosisAndSymptoms1777940000000,
          AddPatientsPhotoUrl1777950000000,
          AddUsersPhotoUrl1777960000000,
          MedicalDocumentsTitle1777970000000,
          NullableDiagnosisDoctor1777980000000,
          SymptomDoctorId1777990000000,
          SpecialitiesAndAdvertisements1778000000000,
          FixSpecialityImagesAndAssignDoctors1778010000000,
          UpdateSpecialityExpressiveImages1778020000000,
          BundledSpecialityImages1778030000000,
          SurgeryAndAlaadocSpecialities1778040000000,
          RemoveDemoDoctors1778050000000,
          MessagesTable1778060000000,
          MessageAttachmentsAndRead1778070000000,
          MessageEditedAt1778080000000,
          DoctorPatientAccess1778090000000,
          UserMessagePoints1778100000000,
          EnsureDefaultMessagePoints1778100000001,
          DoctorMessagePrice1778110000000,
          AiAssistant1778120000000,
          MessageEmotions1778130000000,
          MessageEmotionDislike1778140000000,
          PrescriptionMedications1778160000000,
          PrescriptionImageUrl1778170000000,
          DeviceTokens1778180000000,
          DiagnosisDocumentsManyToMany1778190000000,
          MedicalRecordAiInsight1778210000000,
          UserPreferredLocale1778220000000,
          VideoCallSessions1778230000000,
          AppointmentChatFields1778240000000,
          AdminRagSources1778250000000,
          IntakeExamInstances1778260000000,
          DoctorCertifications1778270000000,
          Consultations1778280000000,
          ConsultationPriceCap1778290000000,
          PointsReimbursed1778300000000,
          ConsultationComplaints1778310000000,
          DoctorPriceEgpCredits1778320000000,
          VideoConsultationPrice1778330000000,
          AiMessageAttachments1778340000000,
          PatientMedicalRecordsConsent1778350000000,
          AppointmentAiInsight1778360000000,
          PaymentIntentions1778370000000,
          VideoCallDuration1778380000000,
          DoctorBankDetails1778390000000,
          MedicalRecordBodyPart1778400000000,
          MedicalDocumentRequests1778410000000,
          DiagnosisPrescriptionIntakeLinks1778420000000,
          PatientProfileCountry1778430000000,
          DoctorCountry1778440000000,
          PaymentIntentionMarketPricing1778450000000,
          UserEmailVerificationAndPasswordReset1778460000000,
          EmergencyAndGynaecologySpecialities1778470000000,
          ThreelagiCampaignBanners1778480000000,
          SpecialityMarketVisibility1778490000000,
          NutritionistSpeciality1778500000000,
          UserNotifications1778510000000,
          DoctorImmediateCalls1778520000000,
          PointPricing1778530000000,
        ],
        migrationsRun: true,
        migrationsTransactionMode: 'each',
        ssl: {
          rejectUnauthorized: false,
        },
        logging: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ContactModule,
    ClinicsModule,
    DoctorsModule,
    JoinRequestsModule,
    PatientsModule,
    AppointmentsModule,
    MedicalDocumentsModule,
    DiagnosisModule,
    SymptomsModule,
    PrescriptionsModule,
    PrescriptionTemplatesModule,
    IntakeTestsModule,
    IntakeExamsModule,
    SchedulesModule,
    PatientPortalModule,
    ConsultationsModule,
    ComplaintsModule,
    ReviewsModule,
    UploadsModule,
    HealthModule,
    UsersModule,
    AdminModule,
    SpecialitiesModule,
    AdvertisementsModule,
    PresenceModule,
    MessagesModule,
    DoctorPatientAccessModule,
    PointsModule,
    AiModule,
    MessageEmotionsModule,
    PushNotificationsModule,
    NotificationsModule,
    TtsModule,
    SttModule,
    WherebyModule,
    VideoCallsModule,
    PaymentsModule,
    MedicalDocumentRequestsModule,
  ],
})
export class AppModule {}
