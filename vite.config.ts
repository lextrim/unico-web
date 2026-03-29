import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    base: mode === 'production' ? './' : '/',
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      target: 'es2017',
    },
    esbuild: {
      target: 'es2017',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});