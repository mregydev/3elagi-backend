export interface LoggedInUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  photo_url?: string | null;
  specialty?: string | null;
  /** Doctor speciality catalog id — used for realtime roster matching. */
  speciality_id?: string | null;
  /** Doctor entity id — used for profile deep links. */
  doctor_id?: string | null;
}
