import type { Doctor } from '../entities/doctor.entity';

/** Bank details a patient needs to pay the doctor outside the app. */
export type DoctorBankDetailsForPatient = {
  doctor_iban: string | null;
  doctor_account_holder: string | null;
  doctor_national_id: string | null;
};

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
