/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      // Real backend is proxied here when VITE_USE_FIXTURES is not set.
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
      // Test-generation service (separate backend).
      '/internal': {
        target: process.env.VITE_GENERATE_PROXY_TARGET ?? 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      // Performance-testing service (gatiQA-perf-api). /perf-api/* → /api/*
      '/perf-api': {
        target: process.env.VITE_PERF_PROXY_TARGET ?? 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/perf-api/, '/api'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: false,
    // Component tests run against the synthetic fixture backend,
    // which implements the same GatiQaApi contract as the HTTP client.
    env: { VITE_USE_FIXTURES: 'true' },
  },
});
