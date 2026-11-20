/// <reference types="vite/client" />

// Fontsource packages are CSS-only; they are imported for their side effect.
declare module '@fontsource-variable/*';

/** The app version from package.json (injected by Vite). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_DEFAULT_CHAIN?: string;
  readonly VITE_SIM_LATENCY_MS?: string;
  readonly VITE_DOCS_URL?: string;
  readonly VITE_GITHUB_URL?: string;
  readonly VITE_COSMOS_REST_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
