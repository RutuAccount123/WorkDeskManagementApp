import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // tests always use the built-in sample data, whatever .env says
    env: { TZ: 'Asia/Kolkata', VITE_USE_MOCK: 'true' },
    coverage: { reporter: ['text-summary', 'html'], include: ['src/**/*.{js,jsx}'], exclude: ['src/test/**', 'src/main.jsx'] },
  },
});
