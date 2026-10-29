import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // import X from '@/features/...'  instead of  '../../features/...'
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // In development, /api calls go to the Spring Boot backend (only used when VITE_USE_MOCK=false). Same port as server.port in the backend.
    proxy: { '/api': 'http://localhost:8082' },
  },
});
