export interface LoggedInUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  photo_url?: string | null;
  specialty?: string | null;
}
