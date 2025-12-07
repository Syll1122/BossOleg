# ngrok Setup Guide - Quick Start

## What is ngrok?
ngrok creates a secure HTTPS tunnel to your local development server, allowing you to access it from your phone with GPS working.

## Step-by-Step Setup

### Step 1: Sign Up for ngrok (Free)

1. Go to https://ngrok.com
2. Click **"Sign up"** or **"Get started for free"**
3. Create an account (you can use Google/GitHub to sign up quickly)
4. Verify your email if required

### Step 2: Download ngrok

1. After signing in, go to: https://dashboard.ngrok.com/get-started/setup
2. Select **Windows** as your operating system
3. Download the ZIP file
4. Extract it to a folder (e.g., `C:\ngrok` or `C:\Users\YourName\ngrok`)

### Step 3: Get Your Authtoken

1. In the ngrok dashboard, you'll see your **authtoken** (looks like: `2abc123def456ghi789jkl012mno345pq_6r7s8t9u0v1w2x3y4z5`)
2. Copy this token - you'll need it in the next step

### Step 4: Configure ngrok

1. Open **Command Prompt** or **PowerShell**
2. Navigate to where you extracted ngrok:
   ```bash
   cd C:\ngrok
   ```
   (Or wherever you extracted it)

3. Add ngrok to your authtoken:
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
   ```
   Replace `YOUR_AUTHTOKEN_HERE` with the token from Step 3

4. Verify it worked:
   ```bash
   ngrok version
   ```
   You should see the version number

### Step 5: Start Your Development Server

1. In your project folder, start the dev server:
   ```bash
   npm run dev
   ```
   
2. You should see:
   ```
   VITE v5.x.x  ready in xxx ms
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://10.38.21.188:5173/
   ```

3. **Keep this terminal open** - the server needs to keep running

### Step 6: Start ngrok Tunnel

1. Open a **NEW** terminal/Command Prompt window
2. Navigate to ngrok folder (if not already there):
   ```bash
   cd C:\ngrok
   ```

3. Start the tunnel:
   ```bash
   ngrok http 5173
   ```

4. You'll see something like:
   ```
   Session Status                online
   Account                       Your Name (Plan: Free)
   Version                       3.x.x
   Region                        United States (us)
   Forwarding                    https://abc123.ngrok-free.app -> http://localhost:5173
   
   Connections                   ttl     opn     rt1     rt5     p50     p90
                                 0       0       0.00    0.00    0.00    0.00
   ```

5. **Copy the HTTPS URL** - it looks like: `https://abc123.ngrok-free.app`

### Step 7: Access from Your Phone

1. Make sure your phone is connected to the internet (Wi-Fi or mobile data)
2. Open your phone's browser (Chrome, Safari, etc.)
3. Enter the ngrok HTTPS URL: `https://abc123.ngrok-free.app`
4. **First time**: ngrok may show a warning page - click **"Visit Site"** to proceed
5. Your app should load, and **GPS will now work!** ✅

## Quick Reference Commands

```bash
# Start dev server
npm run dev

# In another terminal, start ngrok
ngrok http 5173

# To stop ngrok: Press Ctrl+C
```

## Tips

1. **Free Plan Limits**:
   - The URL changes every time you restart ngrok (unless you pay for a static URL)
   - There's a connection limit, but fine for testing

2. **Keep Both Running**:
   - Keep the `npm run dev` terminal open
   - Keep the `ngrok http 5173` terminal open
   - Both need to be running for it to work

3. **If ngrok URL Changes**:
   - Just update the URL on your phone
   - The old URL will stop working when you restart ngrok

4. **Troubleshooting**:
   - If ngrok says "port already in use", make sure port 5173 isn't being used by another app
   - If the page doesn't load, check that `npm run dev` is still running
   - If GPS still doesn't work, make sure you're using the **HTTPS** URL (not HTTP)

## Alternative: Add ngrok to PATH (Optional)

To use `ngrok` from anywhere without `cd` to the folder:

1. Copy ngrok.exe to a folder in your PATH (e.g., `C:\Windows\System32`)
2. Or add the ngrok folder to your system PATH:
   - Right-click "This PC" → Properties
   - Advanced system settings → Environment Variables
   - Edit "Path" → Add `C:\ngrok` (or wherever ngrok is)
   - Restart terminal

Then you can run `ngrok http 5173` from anywhere!

## Next Steps

Once ngrok is running:
- Access the HTTPS URL from your phone
- GPS location should work perfectly
- Test all features that require location access

---

**Need Help?**
- ngrok Docs: https://ngrok.com/docs
- ngrok Dashboard: https://dashboard.ngrok.com

