# Fix Android Studio Connection Issue

## Problem
Gradle cannot download dependencies because `dl.google.com` is redirected to `127.0.0.1` in your hosts file.

## Solution

### Step 1: Remove Hosts File Entries (REQUIRES ADMIN RIGHTS)

1. **Open Notepad as Administrator:**
   - Press `Windows Key`
   - Type "Notepad"
   - Right-click "Notepad" and select "Run as administrator"

2. **Open the hosts file:**
   - In Notepad, go to: `File` → `Open`
   - Navigate to: `C:\Windows\System32\drivers\etc\`
   - Change file type filter to "All Files (*.*)"
   - Open `hosts`

3. **Remove or comment out these lines:**
   ```
   127.0.0.1 dl.google.com 
   127.0.0.1 tools.google.com
   ```
   
   Either delete them completely, or comment them out by adding `#` at the start:
   ```
   # 127.0.0.1 dl.google.com 
   # 127.0.0.1 tools.google.com
   ```

4. **Save the file** (Ctrl+S)

5. **Flush DNS cache:**
   Open PowerShell as Administrator and run:
   ```powershell
   ipconfig /flushdns
   ```

### Step 2: Verify the Fix

After removing the hosts file entries, try opening Android Studio again:

```bash
npx cap open android
```

Gradle should now be able to download dependencies from Google's servers.

### Alternative: If You Can't Edit Hosts File

If you cannot edit the hosts file, you can try using a VPN or proxy, but the best solution is to remove those entries.

## Why This Happened

The hosts file entries were likely added by:
- Antivirus software
- Ad blockers
- Privacy tools
- Malware (less likely)

These entries redirect Google domains to localhost to block tracking or ads, but they also block legitimate downloads needed for Android development.

