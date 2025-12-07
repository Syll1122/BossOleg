/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy()
  ],
  server: {
    host: '0.0.0.0', // Allow access from network devices
    port: 5173, // Default Vite port
    strictPort: false, // Allow different port if 5173 is taken
    hmr: {
      host: 'hermetic-fossilizable-laurine.ngrok-free.dev',
      clientPort: 443,
    },
    cors: true, // Enable CORS for ngrok
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
