export interface StudentRow {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  suspended: boolean;
  joinedAt: string;
  lastSignInAt: string | null;
  role: string;
}
