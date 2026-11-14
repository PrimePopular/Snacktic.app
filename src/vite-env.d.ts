/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Shown on the privacy page so students know who to contact. */
  readonly VITE_CONTACT_EMAIL?: string;
  /** Public key for phone notifications (safe to expose). Made with: npx web-push generate-vapid-keys */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build date, set in vite.config.ts. */
declare const __APP_BUILD__: string;
