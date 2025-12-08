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
    // Allow ngrok hosts (for mobile testing)
    // Wildcards allow any subdomain of ngrok domains
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok.app',
      'localhost',
      '127.0.0.1',
      'all', // Allow all hosts (for development - remove in production)
    ],
    hmr: {
      // For ngrok: Set VITE_NGROK_URL environment variable
      // Example: VITE_NGROK_URL=https://abc123.ngrok-free.app npm run dev
      // Or create .env file with: VITE_NGROK_URL=https://abc123.ngrok-free.app
      host: process.env.VITE_NGROK_URL 
        ? new URL(process.env.VITE_NGROK_URL).hostname 
        : 'localhost',
      clientPort: process.env.VITE_NGROK_URL ? 443 : 5173,
      protocol: process.env.VITE_NGROK_URL ? 'wss' : 'ws',
    },
    cors: true, // Enable CORS for ngrok and network access
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
