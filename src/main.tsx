import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { App } from '@/app/App';
import { initI18n } from '@/i18n';

// Zod otherwise probes for `eval` support (`new Function('')`) when the first schema is built. Under the strict
// Content-Security-Policy in nginx.conf the probe is blocked and reported as a (harmless) violation; the form schemas
// here are small, so the plain, non-compiled path costs nothing and keeps the policy report clean.
z.config({ jitless: true });

// Render only after the active language bundle is loaded, so the UI never flashes raw translation keys.
void initI18n().then(() => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
