import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Unique per build/redeploy. The app compares this against the value stamped into
  // localStorage at login time and forces a re-login when they differ — so a rebuild +
  // redeploy always kicks existing sessions back to the login screen. (This was in place
  // before and was lost somewhere in today's auth iterations — restoring it, since a
  // persisted Firebase session with nothing to invalidate it is exactly why the login
  // screen stopped appearing.)
  define: {
    __BUILD_ID__: JSON.stringify(String(Date.now())),
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
