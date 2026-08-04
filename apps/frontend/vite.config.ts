import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest } from './src/pwaManifest';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker registration is driven manually by useUpdatePrompt
      // (virtual:pwa-register/react) so the app controls exactly when/how
      // the update UI shows -- the plugin's own auto-injected script is
      // disabled to avoid double registration.
      injectRegister: false,
      registerType: 'prompt',
      // Default (registerType leaves devOptions unset -> disabled): no
      // service worker is generated/registered in `vite dev` or in tests,
      // only in a real `vite build`.
      manifest: pwaManifest,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        // App shell only: precache the build's own JS/CSS/HTML/icons/fonts.
        // No entry here ever matches /api/v1/* (a different origin in every
        // real deployment anyway) or Clerk's domain, so neither is cached.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Deterministic regardless of the developer's local .env: tests must
    // not depend on whatever VITE_BETA_SIGN_UP_ENABLED happens to be set to
    // locally. Components that need both states test them via props instead
    // (see LoginPage's signUpEnabled prop).
    env: {
      VITE_BETA_SIGN_UP_ENABLED: 'false',
    },
  },
});
