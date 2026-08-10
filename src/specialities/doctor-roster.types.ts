/** Payload broadcast when a doctor becomes visible in speciality browse lists. */
export interface DoctorRosterPayload {
  id: string;
  doctor_id: string;
  name: string;
  photo_url?: string | null;
  /** ISO 3166-1 alpha-2 country of residence / practice. */
  country?: string | null;
  specialty?: string | null;
  speciality_id: string;
  professional_title?: string | null;
  experience_years?: number | null;
  consultation_fee_egp?: number | null;
  consultation_price?: number | null;
  rating_average?: number;
  rating_total?: number;
  /** Doctor accepts immediate video calls. */
  immediate_call_enabled?: boolean;
  /** Doctor's call line is occupied right now. */
  on_call?: boolean;
  role: 'doctor';
}
