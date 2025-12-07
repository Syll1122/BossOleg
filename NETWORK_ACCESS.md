# How to Access the App from Your Phone on the Same Network

## Step 1: Update Vite Configuration
The `vite.config.ts` has been updated to allow network access. The server is now configured to listen on `0.0.0.0` which allows connections from other devices on your network.

## Step 2: Find Your Computer's IP Address

### On Windows:
1. Open Command Prompt (cmd)
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter (usually Wi-Fi or Ethernet)
4. You'll see something like: `192.168.1.100` or `10.38.21.188`

### Quick Command:
```bash
ipconfig | findstr /i "IPv4"
```

## Step 3: Start the Development Server

Run the development server:
```bash
npm run dev
```

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://10.38.21.188:5173/
```

## Step 4: Access from Your Phone

1. **Make sure your phone is on the same Wi-Fi network** as your computer
2. **Open your phone's browser** (Chrome, Safari, etc.)
3. **Enter the Network URL** shown in the terminal:
   - Example: `http://10.38.21.188:5173/`
   - Replace `10.38.21.188` with your actual IP address

## Troubleshooting

### Can't access from phone?
1. **Check firewall**: Windows Firewall might be blocking the connection
   - Go to Windows Defender Firewall → Allow an app through firewall
   - Allow Node.js or add port 5173

2. **Verify same network**: Both devices must be on the same Wi-Fi network

3. **Try different IP**: If you have multiple IP addresses, try the other one
   - Usually the one starting with `192.168.x.x` or `10.x.x.x` works

4. **Check port**: Make sure port 5173 is not blocked by your router

### Firewall Quick Fix (Windows):
```powershell
# Run PowerShell as Administrator
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
```

## Notes

- The app will hot-reload on your phone when you make changes
- Make sure to use `http://` not `https://`
- Some corporate networks may block this - try a mobile hotspot if needed

