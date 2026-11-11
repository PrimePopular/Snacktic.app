/** Mirrors the database rules in supabase/schema.sql so people get instant, friendly feedback. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const MIN_PASSWORD_LENGTH = 8;

export function validateUsername(value: string): string | null {
  if (!USERNAME_PATTERN.test(value.trim())) {
    return 'Use 3 to 20 letters, numbers or underscores. No spaces.';
  }
  return null;
}

export function validateFullName(value: string): string | null {
  const length = value.trim().length;
  return length >= 2 && length <= 60 ? null : 'Enter your name (2 to 60 characters).';
}

/** The phone number is optional. If given, it must look like a real number. */
export function validatePhone(value: string, required = false): string | null {
  const text = value.trim();
  if (text === '') return required ? 'Enter your WhatsApp number.' : null;
  const digits = text.replace(/\D/g, '').length;
  return /^[0-9+()\-\s]{6,25}$/.test(text) && digits >= 7 ? null : 'Enter a valid number (digits, spaces, + and brackets only).';
}

export function validateEmail(value: string): string | null {
  return /^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Enter a valid email address.';
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  return password === confirm ? null : "The two passwords don't match.";
}

export function validatePassword(value: string): string | null {
  return value.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
}

/** Turns technical auth errors into plain language. Unknown errors stay generic on purpose. */
export function friendlyAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return "That email and password don't match.";
  if (text.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox.';
  if (text.includes('already registered')) return 'An account with that email already exists. Try signing in.';
  if (text.includes('same password') || text.includes('different from the old')) return 'Choose a password you have not used before.';
  if (text.includes('password should be')) return 'That password is too weak. Try a longer one.';
  if (text.includes('rate limit') || text.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  if (text.includes('username_available') || text.includes('could not find the function')) {
    return 'The database setup is incomplete. Run supabase/002_auth_extras.sql in Supabase.';
  }
  return 'Something went wrong. Please try again.';
}

export const NETWORK_MESSAGE = "Can't reach Snacktic. Check your connection and try again.";
