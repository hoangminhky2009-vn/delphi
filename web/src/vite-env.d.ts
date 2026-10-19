/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Gốc URL API; trống = cùng origin (xem web/.env.example). */
  readonly VITE_API_BASE_URL?: string;
}
