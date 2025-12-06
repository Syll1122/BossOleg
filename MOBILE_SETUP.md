# Mobile Setup Guide - Running the App on Mobile Devices

This guide explains how to run the Watch App on Android and iOS devices using Capacitor.

## Prerequisites

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **Android Studio** (for Android) - [Download](https://developer.android.com/studio)
3. **Xcode** (for iOS, macOS only) - [Download from App Store](https://apps.apple.com/us/app/xcode/id497799835)
4. **Java Development Kit (JDK)** - Required for Android development

## Current Database Setup

The app currently uses **IndexedDB** which works in:
- ✅ Web browsers (Chrome, Firefox, Safari, Edge)
- ✅ Android WebView (via Capacitor)
- ✅ iOS WebView (via Capacitor)

**Note:** IndexedDB works perfectly on mobile devices through Capacitor's WebView. No additional setup is needed for the database to work on mobile!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Build the Web App

```bash
npm run build
```

This creates the `dist` folder with your compiled app.

## Step 3: Add Mobile Platforms

### For Android:

```bash
npx cap add android
```

### For iOS (macOS only):

```bash
npx cap add ios
```

## Step 4: Sync Your App

After making changes, sync the web assets to native projects:

```bash
npx cap sync
```

This command:
- Copies the `dist` folder to native projects
- Updates native dependencies
- Updates native plugins

## Step 5: Open in Native IDE

### Android:

```bash
npx cap open android
```

This opens Android Studio where you can:
1. Wait for Gradle sync to complete
2. Connect an Android device via USB (enable USB debugging)
3. Or start an Android emulator
4. Click the "Run" button (▶️) to build and run

### iOS (macOS only):

```bash
npx cap open ios
```

This opens Xcode where you can:
1. Select a simulator or connected iOS device
2. Click the "Run" button (▶️) to build and run

## Step 6: Enable USB Debugging (Android)

On your Android device:
1. Go to **Settings** → **About phone**
2. Tap **Build number** 7 times to enable Developer options
3. Go back to **Settings** → **Developer options**
4. Enable **USB debugging**
5. Connect device via USB
6. Accept the USB debugging prompt on your device

## Testing the Database on Mobile

The IndexedDB database will work automatically on mobile devices. To test:

1. **Sign Up** - Create a new account on the mobile app
2. **Login** - Log in with the created account
3. **Data Persistence** - Close and reopen the app - your login should persist
4. **Multiple Accounts** - Create multiple accounts and test switching between them

## Viewing Database Data (Development)

### Android (Chrome DevTools):

1. Connect your Android device via USB
2. Open Chrome on your computer
3. Go to `chrome://inspect`
4. Find your device and click "inspect"
5. Go to **Application** tab → **Storage** → **IndexedDB** → **WatchAppDB**

### iOS (Safari Web Inspector):

1. On iOS device: **Settings** → **Safari** → **Advanced** → Enable **Web Inspector**
2. Connect device to Mac via USB
3. On Mac: Open **Safari** → **Develop** → [Your Device] → [Your App]
4. Go to **Storage** tab → **IndexedDB** → **WatchAppDB**

## Troubleshooting

### Database Not Working?

1. **Check Console Logs**: Look for database errors in browser/dev tools
2. **Clear App Data**: Uninstall and reinstall the app to reset database
3. **Check Permissions**: Ensure the app has storage permissions

### Build Errors?

1. **Clean Build**: 
   ```bash
   # Android
   cd android && ./gradlew clean && cd ..
   
   # iOS
   cd ios && xcodebuild clean && cd ..
   ```

2. **Reinstall Dependencies**:
   ```bash
   npm install
   npx cap sync
   ```

### App Not Loading?

1. **Check Capacitor Config**: Ensure `webDir` points to `dist` in `capacitor.config.ts`
2. **Rebuild**: Run `npm run build` then `npx cap sync`
3. **Check Console**: Look for errors in native IDE console

## Upgrading to SQLite (Optional)

If you need SQLite for more advanced features, you can upgrade:

### Install SQLite Plugin:

```bash
npm install @capacitor-community/sqlite
```

### Update Database Service:

The current `database.ts` uses IndexedDB. To switch to SQLite, you would:
1. Install the plugin (above)
2. Update `src/services/database.ts` to use SQLite API
3. Sync: `npx cap sync`

**Note:** IndexedDB is sufficient for most use cases and works seamlessly on mobile!

## Development Workflow

1. **Make code changes** in `src/`
2. **Build**: `npm run build`
3. **Sync**: `npx cap sync`
4. **Test**: Run on device/emulator
5. **Debug**: Use Chrome DevTools (Android) or Safari Web Inspector (iOS)

## Production Build

### Android APK:

```bash
# In Android Studio
Build → Generate Signed Bundle / APK
```

### iOS App Store:

```bash
# In Xcode
Product → Archive
```

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Ionic Documentation](https://ionicframework.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [iOS Developer Guide](https://developer.apple.com/documentation/)

## Quick Commands Reference

```bash
# Build web app
npm run build

# Sync to native
npx cap sync

# Open Android Studio
npx cap open android

# Open Xcode
npx cap open ios

# Run on web (development)
npm run dev

# Check Capacitor version
npx cap --version
```

## Database Features

The local database supports:
- ✅ User account creation
- ✅ User authentication (login)
- ✅ Account lookup by email or username
- ✅ Account updates
- ✅ Account deletion
- ✅ Data persistence across app restarts
- ✅ Works offline (no internet required)

All data is stored locally on the device and persists even when the app is closed!



