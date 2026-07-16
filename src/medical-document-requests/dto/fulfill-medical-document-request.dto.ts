import { IsUUID } from 'class-validator';

export class FulfillMedicalDocumentRequestDto {
  @IsUUID()
  document_id: string;
}
