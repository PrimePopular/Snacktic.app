export type Role = 'student' | 'admin' | 'owner';

export interface Profile {
  id: string;
  username: string;
  /** Real name. Only the owner can see it, through the Students page. */
  fullName: string;
  /** WhatsApp number. Optional at sign-up, needed to order a reward. */
  phone: string;
  /** A suspended account cannot earn, send or spend points. Only the owner can change this. */
  suspended: boolean;
  role: Role;
  /** True only if the student ticked "send me news and offers". */
  marketingOptIn: boolean;
}

/**
 * loading      checking for an existing session
 * unconfigured .env.local is missing the Supabase keys
 * signed-out   guest
 * signed-in    account and profile loaded
 * error        signed in, but the profile could not be loaded (for example offline)
 */
export type AuthStatus = 'loading' | 'unconfigured' | 'signed-out' | 'signed-in' | 'error';

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

export interface SignUpInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  username: string;
  marketingOptIn: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  profile: Profile | null;
  email: string | null;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** True while the person arrived from a password-reset email and has not chosen a new password yet. */
  recovering: boolean;
  /** Sends a reset link. Always reports success for unknown emails, so accounts cannot be guessed. */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  /** Change your own nickname and/or WhatsApp number. */
  updateDetails: (patch: { username?: string; phone?: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  setMarketingOptIn: (value: boolean) => Promise<AuthResult>;
  /** Try loading the profile again after an error. */
  retry: () => void;
}
