import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { MedicalDocument, DocumentType } from '../entities/medical-document.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Prescription } from '../entities/prescription.entity';
import { Symptom } from '../entities/symptom.entity';

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'Unknown';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

export function buildPatientProfileText(
  profile: PatientProfile,
): string {
  const lines = [
    'Patient:',
    profile.name,
    '',
    'Phone:',
    profile.phone,
  ];
  if (profile.birth_date) {
    lines.push('', 'Birth date:', profile.birth_date);
  }
  if (profile.gender) {
    lines.push('', 'Gender:', profile.gender);
  }
  if (profile.chronic_conditions) {
    lines.push('', 'Chronic conditions:', profile.chronic_conditions);
  }
  if (profile.medical_notes) {
    lines.push('', 'Medical notes:', profile.medical_notes);
  }
  return lines.join('\n');
}

export function buildAllergyText(profile: PatientProfile): string {
  return [
    'Patient:',
    profile.name,
    '',
    'Allergies:',
    profile.allergies?.trim() || 'None recorded',
  ].join('\n');
}

export function buildDoctorProfileText(doctor: Doctor): string {
  const lines = ['Doctor:', `Dr ${doctor.name}`];
  if (doctor.phone) lines.push('', 'Phone:', doctor.phone);
  if (doctor.personal_clinic_location) {
    lines.push('', 'Location:', doctor.personal_clinic_location);
  }
  if (doctor.professional_title) {
    lines.push('', 'Title:', doctor.professional_title);
  }
  if (doctor.description) {
    lines.push('', 'Description:', doctor.description);
  }
  return lines.join('\n');
}

export function buildDiagnosisText(
  diagnosis: Diagnosis,
  symptoms: Symptom[],
  doctorName?: string | null,
): string {
  const lines = [
    'Diagnosis:',
    diagnosis.desc,
    '',
    'Date:',
    formatDate(diagnosis.created_at),
  ];
  if (doctorName) {
    lines.push('', 'Doctor:', doctorName);
  }
  if (symptoms.length > 0) {
    lines.push(
      '',
      'Symptoms:',
      symptoms.map((s) => s.desc).join(', '),
    );
  }
  return lines.join('\n');
}

export function buildMedicalDocumentText(
  doc: MedicalDocument,
  typeLabel: string,
): string {
  const lines = [
    'Record type:',
    typeLabel,
    '',
    'Title:',
    doc.title ?? typeLabel,
    '',
    'Date:',
    formatDate(doc.created_at),
  ];
  if (doc.notes) {
    lines.push('', 'Notes:', doc.notes);
  }
  if (doc.file_name) {
    lines.push('', 'File:', doc.file_name);
  }
  return lines.join('\n');
}

export function documentTypeLabel(type: DocumentType): string {
  switch (type) {
    case DocumentType.LAB:
      return 'Lab result';
    case DocumentType.XRAY:
      return 'Imaging';
    case DocumentType.PRESCRIPTION:
      return 'Prescription document';
    case DocumentType.DIAGNOSIS:
      return 'Diagnosis document';
    case DocumentType.SYMPTOM:
      return 'Symptom record';
    default:
      return 'Medical record';
  }
}

export function knowledgeEntityTypeForDocument(
  type: DocumentType,
): 'lab_result' | 'imaging' | 'prescription' | 'medical_record' {
  if (type === DocumentType.LAB) return 'lab_result';
  if (type === DocumentType.XRAY) return 'imaging';
  if (type === DocumentType.PRESCRIPTION) return 'prescription';
  return 'medical_record';
}

export function buildPrescriptionText(
  prescription: Prescription,
  doctorName?: string | null,
  patientName?: string | null,
): string {
  const lines = [
    'Prescription:',
    prescription.title,
    '',
    'Date:',
    formatDate(prescription.created_at),
  ];
  if (patientName) lines.push('', 'Patient:', patientName);
  if (doctorName) lines.push('', 'Doctor:', doctorName);
  if (prescription.symptoms) {
    lines.push('', 'Symptoms:', prescription.symptoms);
  }
  if (prescription.items?.length) {
    lines.push(
      '',
      'Medications:',
      prescription.items
        .map((item) => {
          const parts = [item.name];
          if (item.dose) parts.push(`dose: ${item.dose}`);
          if (item.frequency) parts.push(`frequency: ${item.frequency}`);
          if (item.duration) parts.push(`duration: ${item.duration}`);
          if (item.notes) parts.push(`notes: ${item.notes}`);
          return parts.join(', ');
        })
        .join('\n'),
    );
  }
  return lines.join('\n');
}

export function normalizeQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}
