import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  return {
    base: process.env.VERCEL ? '/' : (mode === 'production' ? './' : '/'),
    plugins: [
      react(),
      tailwindcss(),
      // Cachea el shell de la app (HTML/JS/CSS) para que en vercel funcione
      // offline tras la primera visita. Solo se registra fuera de la APK
      // (ver index.tsx) porque esta ya funciona offline via assets locales.
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        manifest: false,
      }),
    ],
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
      dedupe: ['react', 'react-dom', 'react-dom/client'],
    },
  };
});