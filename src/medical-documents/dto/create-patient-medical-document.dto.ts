import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../../entities/medical-document.entity';

const PATIENT_UPLOAD_TYPES = [DocumentType.LAB, DocumentType.XRAY] as const;
export type PatientUploadDocumentType = (typeof PATIENT_UPLOAD_TYPES)[number];

export class CreatePatientMedicalDocumentDto {
  @IsEnum(PATIENT_UPLOAD_TYPES)
  type: PatientUploadDocumentType;

  @IsString()
  file_url: string;

  @IsString()
  file_name: string;

  /** Main description shown in the app */
  @IsString()
  notes: string;

  @IsString()
  title: string;

  /** When set by a doctor, the record is stored on this patient's user id. */
  @IsOptional()
  @IsString()
  patient_user_id?: string;
}
