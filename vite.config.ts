
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'background.js'),
        content: resolve(__dirname, 'contentScript.js'),
      },
      output: {
        // Ensure scripts are named exactly as manifest.json expects
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'main' ? 'assets/[name]-[hash].js' : '[name].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
