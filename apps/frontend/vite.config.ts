import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
