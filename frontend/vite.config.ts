/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.VITE_BACKEND_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // En local, le front appelle /api sur sa propre origine : pas de CORS à gérer.
    proxy: { '/api': { target: backend, changeOrigin: false } },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: { '/api': { target: backend, changeOrigin: false } },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
