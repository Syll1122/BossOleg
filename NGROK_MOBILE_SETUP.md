# ngrok Setup for Mobile Testing

This guide will help you access your app on mobile devices using ngrok (HTTPS tunnel).

## Why ngrok?

- **HTTPS Required**: Modern browsers require HTTPS for GPS/geolocation features
- **No Network Configuration**: Works from anywhere, not just same Wi-Fi
- **Easy Setup**: Simple tunnel to your local dev server

## Prerequisites

1. **Install ngrok**: 
   - Download from: https://ngrok.com/download
   - Or via npm: `npm install -g ngrok`
   
2. **Get ngrok Auth Token** (Free account):
   - Sign up at: https://dashboard.ngrok.com/signup
   - Go to: https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy your authtoken

3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

## Quick Start

### Step 1: Start Your Dev Server

Open Terminal 1:
```bash
npm run dev
```

You should see:
```
➜  Local:   http://localhost:5173/
```

### Step 2: Start ngrok Tunnel

Open Terminal 2 (new terminal window):

**Windows (PowerShell):**
```powershell
.\ngrok-setup.ps1
```

**Or manually:**
```bash
ngrok http 5173
```

You'll see something like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:5173
```

### Step 3: Copy ngrok HTTPS URL

Copy the **HTTPS URL** from ngrok (the one starting with `https://`).

Example: `https://abc123.ngrok-free.app`

### Step 4: Access from Mobile

1. **Open your mobile browser** (Chrome, Safari, etc.)
2. **Enter the ngrok HTTPS URL** (from Step 3)
3. **Allow location access** when prompted (required for GPS features)

## Optional: Auto-configure Vite with ngrok URL

If you want Vite HMR (Hot Module Reload) to work through ngrok:

1. **Set environment variable before starting dev server**:

**Windows (PowerShell):**
```powershell
$env:NGROK_URL="https://abc123.ngrok-free.app"
npm run dev
```

**Linux/Mac:**
```bash
export NGROK_URL="https://abc123.ngrok-free.app"
npm run dev
```

2. **Or create a `.env` file** in project root:
```env
NGROK_URL=https://abc123.ngrok-free.app
```

**Note**: Replace `abc123.ngrok-free.app` with your actual ngrok URL.

## Troubleshooting

### "Blocked request. This host is not allowed"
If you see this error, the ngrok host is already configured in `vite.config.ts`. Simply:
1. **Restart your dev server** (stop and run `npm run dev` again)
2. The `allowedHosts` configuration should allow all ngrok domains

### "ngrok: command not found"
- Make sure ngrok is installed and in your PATH
- Try: `npm install -g ngrok`

### "Tunnel session failed"
- Check your ngrok authtoken: `ngrok config check`
- Re-authenticate: `ngrok config add-authtoken YOUR_TOKEN`

### GPS still not working on mobile?
- Make sure you're using the **HTTPS** ngrok URL (not HTTP)
- Clear browser cache on mobile
- Check browser console for errors

### ngrok URL changes every time?
- Free ngrok accounts get random URLs
- For fixed URL, upgrade to ngrok paid plan
- Or use ngrok config file to reserve a domain

## Quick Commands

**Start ngrok:**
```bash
ngrok http 5173
```

**Start ngrok with custom domain (if you have paid plan):**
```bash
ngrok http 5173 --domain=your-domain.ngrok-free.app
```

**Check ngrok status:**
```bash
curl http://localhost:4040/api/tunnels
```

## Notes

- ✅ GPS/geolocation will work on mobile through HTTPS
- ✅ Works from anywhere (not just same network)
- ✅ Hot reload works (if you configure NGROK_URL env var)
- ⚠️ Free ngrok URLs expire after 2 hours of inactivity
- ⚠️ Free ngrok has connection limits

## Alternative: Use Your Computer's IP (Local Network Only)

If you just want to test on same Wi-Fi network (no HTTPS):

1. Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Access from phone: `http://YOUR_IP:5173`
3. **Note**: GPS won't work without HTTPS!

For more info, see: `NETWORK_ACCESS.md`

