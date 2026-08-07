export const appConfig = {
  appName: 'Rondo',
  // Empty -- API calls are relative paths by default (`/api/v1/...`),
  // resolved same-origin through a proxy: Vite's dev server proxy in local
  // dev (see apps/frontend/vite.config.ts), a Vercel rewrite in
  // beta/production (see vercel.json). This is required for the
  // httpOnly session cookie to work at all (browsers only send cookies
  // same-origin by default). Override with VITE_API_BASE_URL only if
  // running the backend somewhere the proxy doesn't expect.
  apiBaseUrl: '',
};
