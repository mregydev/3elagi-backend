import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
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

export function buildDoctorProfileText(
  doctor: Doctor,
  speciality?: DoctorSpeciality | null,
): string {
  const lines = ['Doctor:', `Dr ${doctor.name}`];
  const specialtyName =
    speciality?.name_en ?? doctor.professional_title ?? null;
  if (specialtyName) {
    lines.push('', 'Speciality:', specialtyName);
  }
  if (speciality?.name_ar) {
    lines.push('', 'Speciality (Arabic):', speciality.name_ar);
  }
  if (doctor.phone) lines.push('', 'Phone:', doctor.phone);
  if (doctor.personal_clinic_location) {
    lines.push('', 'Location:', doctor.personal_clinic_location);
  }
  if (doctor.experience_years != null) {
    lines.push('', 'Experience years:', String(doctor.experience_years));
  }
  if (doctor.consultation_fee_egp != null) {
    lines.push('', 'Consultation fee (EGP):', String(doctor.consultation_fee_egp));
  }
  if (doctor.description) {
    lines.push('', 'Description:', doctor.description);
  }
  if (doctor.tags?.length) {
    lines.push('', 'Tags:', doctor.tags.join(', '));
  }
  return lines.join('\n');
}

export function buildDoctorDirectorySummary(
  doctors: Array<Doctor & { speciality?: DoctorSpeciality | null }>,
  specialities: DoctorSpeciality[],
): string {
  const bySpeciality = new Map<string, string[]>();
  for (const doctor of doctors) {
    const spec =
      doctor.speciality?.name_en ??
      doctor.professional_title ??
      'General';
    const list = bySpeciality.get(spec) ?? [];
    list.push(`Dr ${doctor.name}`);
    bySpeciality.set(spec, list);
  }

  const lines = [
    '3elagi platform doctor directory',
    '',
    'Total approved doctors:',
    String(doctors.length),
    '',
    'Doctors by speciality:',
  ];

  for (const [spec, names] of [...bySpeciality.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push('', `${spec} (${names.length}):`, names.join(', '));
  }

  lines.push('', 'All specialities on the platform:');
  if (!specialities.length) {
    lines.push('No specialities recorded.');
  } else {
    for (const s of specialities) {
      lines.push(`- ${s.name_en} (${s.name_ar})`);
    }
  }

  return lines.join('\n');
}

export function buildSpecialityCatalogText(
  specialities: DoctorSpeciality[],
  doctorCountBySpeciality: Map<string, number>,
): string {
  const lines = [
    'Platform specialities catalog',
    '',
    'Total specialities:',
    String(specialities.length),
  ];
  for (const s of specialities) {
    const count = doctorCountBySpeciality.get(s.name_en) ?? 0;
    lines.push(
      '',
      `Speciality: ${s.name_en}`,
      `Arabic name: ${s.name_ar}`,
      `Approved doctors in this speciality: ${count}`,
    );
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
