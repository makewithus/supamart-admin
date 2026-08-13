import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Unique per build/redeploy. The app compares this against the value stored
  // when the session was created and forces a re-login when they differ — so a
  // rebuild + redeploy always kicks existing sessions back to the login screen.
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
