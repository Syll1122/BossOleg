# GPS Location Access - HTTPS Setup Guide

## Problem
Modern browsers (Chrome, Safari, Firefox) **require HTTPS** for geolocation API access, except when using `localhost` or `127.0.0.1`. 

When you access the app from your phone using `http://10.38.21.188:5173`, it's **not** localhost, so GPS will be blocked.

## Solutions

### Option 1: Use ngrok (Easiest - Recommended for Testing)

ngrok creates a secure HTTPS tunnel to your local server.

1. **Sign up for free**: Go to https://ngrok.com and create an account
2. **Download ngrok**: https://ngrok.com/download
3. **Get your authtoken**: From ngrok dashboard
4. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
5. **Start your dev server**:
   ```bash
   npm run dev
   ```
6. **In another terminal, start ngrok**:
   ```bash
   ngrok http 5173
   ```
7. **Use the HTTPS URL**: ngrok will give you a URL like `https://abc123.ngrok.io`
   - Access this URL from your phone
   - GPS will work because it's HTTPS!

### Option 2: Use mkcert (For Local Development)

mkcert creates local SSL certificates trusted by your system.

1. **Install mkcert**:
   ```bash
   # Windows (using Chocolatey)
   choco install mkcert
   
   # Or download from: https://github.com/FiloSottile/mkcert/releases
   ```

2. **Install local CA**:
   ```bash
   mkcert -install
   ```

3. **Create certificate**:
   ```bash
   mkcert 10.38.21.188 localhost 127.0.0.1 ::1
   ```
   This creates `10.38.21.188+3.pem` and `10.38.21.188+3-key.pem`

4. **Update vite.config.ts**:
   ```typescript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'
   import fs from 'fs'
   import path from 'path'

   export default defineConfig({
     plugins: [react()],
     server: {
       host: '0.0.0.0',
       port: 5173,
       https: {
         key: fs.readFileSync(path.resolve(__dirname, './10.38.21.188+3-key.pem')),
         cert: fs.readFileSync(path.resolve(__dirname, './10.38.21.188+3.pem')),
       },
     },
   })
   ```

5. **Install certificate on phone**:
   - Copy the root CA certificate from `mkcert -CAROOT`
   - Install it on your phone (Settings → Security → Install certificate)
   - Access via `https://10.38.21.188:5173`

### Option 3: Use localhost only (Limited)

- Only works on your computer, not from phone
- Access via `http://localhost:5173`
- GPS will work, but you can't test on your phone

### Option 4: Deploy to Production

- Deploy to Vercel, Netlify, or similar (they provide HTTPS automatically)
- GPS will work on production URLs

## Quick Test

To verify if GPS will work, open browser console on your phone and check:
```javascript
console.log('Secure context:', window.isSecureContext);
console.log('Protocol:', window.location.protocol);
```

If `isSecureContext` is `false` and protocol is `http:`, GPS will be blocked.

## Error Messages

The app now shows helpful error messages when GPS fails:
- If HTTPS is required, it will tell you
- If permissions are denied, it will guide you
- If GPS is unavailable, it will suggest checking settings

## Recommended for Development

**Use ngrok** - it's the fastest way to get HTTPS working for testing on your phone without complex setup.

