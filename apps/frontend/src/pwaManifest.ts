import type { ManifestOptions } from 'vite-plugin-pwa';

// Real theme tokens (see theme.ts) -- background.default doubles as the
// manifest's background_color (splash screen) and theme_color (OS chrome),
// matching the app's actual dark shell instead of an invented brand color.
const THEME_BACKGROUND = '#0B0D0F';

/**
 * Single source of truth for the web app manifest: consumed by vite.config.ts
 * (fed into VitePWA) and by tests directly, so the manifest's real shape can
 * be asserted without needing a full Vite build.
 */
export const pwaManifest: Partial<ManifestOptions> = {
  name: 'Rondo',
  short_name: 'Rondo',
  description: 'Organizá partidos, invitá jugadores y coordiná con tu equipo.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: THEME_BACKGROUND,
  theme_color: THEME_BACKGROUND,
  lang: 'es-AR',
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
  ],
};
