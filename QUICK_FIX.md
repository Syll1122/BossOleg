# ⚠️ CRITICAL: Fix Hosts File to Run Android Studio

## The Problem
Your `hosts` file is blocking `dl.google.com` by redirecting it to `127.0.0.1`. This prevents Gradle from downloading Android dependencies.

## The Solution (REQUIRES ADMIN RIGHTS)

### Option 1: Manual Fix (Recommended)

1. **Open PowerShell as Administrator:**
   - Press `Windows Key + X`
   - Select "Windows PowerShell (Admin)" or "Terminal (Admin)"

2. **Open the hosts file:**
   ```powershell
   notepad C:\Windows\System32\drivers\etc\hosts
   ```

3. **Find and REMOVE or COMMENT OUT these lines:**
   ```
   127.0.0.1 dl.google.com 
   127.0.0.1 tools.google.com
   ```
   
   Either delete them completely, or add `#` at the start:
   ```
   # 127.0.0.1 dl.google.com 
   # 127.0.0.1 tools.google.com
   ```

4. **Save the file** (Ctrl+S)

5. **Flush DNS cache:**
   ```powershell
   ipconfig /flushdns
   ```

6. **Restart Android Studio** and try again

### Option 2: Use the Batch Script

1. Right-click `android/REMOVE_HOSTS_ENTRIES.bat`
2. Select "Run as administrator"
3. Follow the prompts

## Verify the Fix

After removing the entries, verify with:
```powershell
nslookup dl.google.com
```

You should see real IP addresses (like `74.125.204.93`), NOT `127.0.0.1`.

## Why This Happened

These entries are often added by:
- Antivirus software (blocking tracking)
- Ad blockers
- Privacy tools
- Malware (less common)

They block Google domains to prevent tracking, but also block legitimate Android development downloads.

## After Fixing

Once you've removed the hosts file entries:
1. Close Android Studio completely
2. Run: `npx cap sync android`
3. Open Android Studio: `npx cap open android`
4. Gradle should now sync successfully!

---

**Note:** The Gradle configuration has been updated to use alternative repositories, but Android dependencies are primarily available from Google's Maven repository, so fixing the hosts file is the best solution.

