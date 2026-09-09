import type { Doctor } from '../entities/doctor.entity';

export type PatientPaymentMethod = 'bank' | 'wallet';

/** Bank details a patient needs to pay the doctor outside the app. */
export type DoctorBankDetailsForPatient = {
  doctor_iban: string | null;
  doctor_account_holder: string | null;
  doctor_national_id: string | null;
};

export type DoctorPaymentDetailsForPatient = {
  payment_method: PatientPaymentMethod;
  payment_link?: string | null;
  doctor_iban?: string | null;
  doctor_account_holder?: string | null;
  doctor_national_id?: string | null;
};

type DoctorPaymentSource = Pick<
  Doctor,
  | 'patient_payment_method'
  | 'payment_link'
  | 'iban'
  | 'account_holder_full_name'
  | 'national_id'
>;

export function resolvePatientPaymentMethod(
  doctor: DoctorPaymentSource | null | undefined,
): PatientPaymentMethod {
  const raw = doctor?.patient_payment_method?.trim().toLowerCase();
  if (raw === 'wallet' || raw === 'bank') return raw;
  if (doctor?.payment_link?.trim() && !doctor?.iban?.trim()) return 'wallet';
  return 'bank';
}

export function doctorBankDetailsForPatient(
  doctor:
    | Pick<Doctor, 'iban' | 'account_holder_full_name' | 'national_id'>
    | null
    | undefined,
): DoctorBankDetailsForPatient {
  return {
    doctor_iban: doctor?.iban?.trim() || null,
    doctor_account_holder: doctor?.account_holder_full_name?.trim() || null,
    doctor_national_id: doctor?.national_id?.trim() || null,
  };
}

/** Payment instructions shown to the patient — bank OR wallet, never both. */
export function doctorPaymentDetailsForPatient(
  doctor: DoctorPaymentSource | null | undefined,
): DoctorPaymentDetailsForPatient {
  if (resolvePatientPaymentMethod(doctor) === 'wallet') {
    return {
      payment_method: 'wallet',
      payment_link: doctor?.payment_link?.trim() || null,
    };
  }
  return {
    payment_method: 'bank',
    ...doctorBankDetailsForPatient(doctor),
  };
}
