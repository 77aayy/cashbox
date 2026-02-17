import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // إضافة .nojekyll في dist حتى لا تتجاهل GitHub Pages الملفات التي تبدأ بنقطة
    {
      name: 'nojekyll',
      closeBundle() {
        try {
          writeFileSync(resolve(__dirname, 'dist', '.nojekyll'), '')
        } catch (_) {}
      },
    },
  ],
  base: '/cashbox/',
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-xlsx': ['xlsx'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
