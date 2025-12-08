# 🚀 Quick ngrok Setup for Mobile Testing

## TL;DR - Quick Start

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **In another terminal, start ngrok:**
   ```bash
   ngrok http 5173
   ```

3. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok-free.app`)

4. **Open on your phone** - GPS will work! ✅

## Detailed Setup

### Step 1: Install ngrok

**Windows:**
```powershell
# Option 1: Download from https://ngrok.com/download
# Option 2: Via npm (if you have Node.js)
npm install -g ngrok
```

### Step 2: Get ngrok Auth Token

1. Sign up at: https://dashboard.ngrok.com/signup
2. Go to: https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy your authtoken

### Step 3: Configure ngrok

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### Step 4: Start Your App & ngrok

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
ngrok http 5173
```

### Step 5: Use ngrok URL on Mobile

Copy the HTTPS URL from ngrok terminal and open it on your phone!

## Optional: Enable Hot Reload via ngrok

If you want hot module reload (HMR) to work through ngrok:

1. **Create `.env` file** in project root:
   ```env
   VITE_NGROK_URL=https://abc123.ngrok-free.app
   ```
   (Replace with your actual ngrok URL)

2. **Restart dev server:**
   ```bash
   npm run dev
   ```

## Windows PowerShell Script

Use the provided script:
```powershell
.\ngrok-setup.ps1
```

## Notes

- ⚠️ Free ngrok URLs change every restart
- ✅ Works from anywhere (not just same network)
- ✅ GPS works because it's HTTPS
- ⚠️ Keep both terminals open (dev server + ngrok)

For more details, see: `NGROK_MOBILE_SETUP.md`

