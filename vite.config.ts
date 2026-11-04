import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Rutas relativas: la app funciona en GitHub Pages (/aluminio-app/) o en cualquier otro sitio.
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 700 },
});
