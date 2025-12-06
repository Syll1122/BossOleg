# Local Database Setup - Complete Guide

## Overview

A local database system has been implemented for account management using **IndexedDB**. This database works seamlessly on:
- ✅ Web browsers (Chrome, Firefox, Safari, Edge)
- ✅ Android devices (via Capacitor WebView)
- ✅ iOS devices (via Capacitor WebView)

**No additional setup required** - IndexedDB works automatically on mobile devices through Capacitor!

## What Was Implemented

### 1. Database Service (`src/services/database.ts`)

A complete database service with the following features:

- **Account Creation**: Create new user accounts
- **Authentication**: Login with username/email and password
- **Account Lookup**: Find accounts by email or username
- **Account Updates**: Update account information
- **Account Deletion**: Remove accounts
- **Data Persistence**: All data persists across app restarts
- **Offline Support**: Works without internet connection

### 2. Account Model (`src/models/types.ts`)

Account structure:
```typescript
interface Account {
  id: string;              // Unique identifier
  email: string;            // Email address (unique)
  username: string;         // Username (unique)
  password: string;         // Password (should be hashed in production)
  name: string;            // Full name
  role: 'resident' | 'collector' | 'admin';
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

### 3. Updated Pages

#### Sign Up Page (`src/pages/SignUpPage.tsx`)
- ✅ Full form validation
- ✅ Email format validation
- ✅ Password confirmation
- ✅ Role selection (Resident/Collector)
- ✅ Saves accounts to local database
- ✅ Error handling and user feedback

#### Login Page (`src/pages/LoginPage.tsx`)
- ✅ Login with username OR email
- ✅ Password authentication
- ✅ Authenticates against local database
- ✅ Session management
- ✅ Role-based redirection

#### User State (`src/state/useCurrentUser.ts`)
- ✅ Reads user from database
- ✅ Maintains session state
- ✅ Handles authentication state

### 4. Authentication Utilities (`src/utils/auth.ts`)

Helper functions:
- `logout()` - Clear session and redirect to login
- `isLoggedIn()` - Check if user is logged in
- `getCurrentUserId()` - Get current user ID

## How It Works

### Database Initialization

The database is automatically initialized when:
1. The app loads
2. Any database operation is called
3. User signs up or logs in

### Data Storage

All account data is stored in IndexedDB:
- **Database Name**: `WatchAppDB`
- **Store Name**: `accounts`
- **Indexes**: 
  - `email` (unique)
  - `username` (unique)
  - `role` (non-unique)

### Authentication Flow

1. **Sign Up**:
   - User fills form → Validates input → Creates account in database → Redirects to login

2. **Login**:
   - User enters username/email + password → Database lookup → Authentication → Session stored → Redirect based on role

3. **Session**:
   - User ID, role, name stored in localStorage
   - Persists across app restarts
   - Cleared on logout

## Usage Examples

### Creating an Account

```typescript
import { databaseService } from '../services/database';

await databaseService.createAccount({
  email: 'user@example.com',
  username: 'johndoe',
  password: 'securepassword',
  name: 'John Doe',
  role: 'resident'
});
```

### Authenticating

```typescript
const account = await databaseService.authenticate('johndoe', 'securepassword');
// or
const account = await databaseService.authenticate('user@example.com', 'securepassword');
```

### Getting Account by Email

```typescript
const account = await databaseService.getAccountByEmail('user@example.com');
```

### Updating Account

```typescript
await databaseService.updateAccount(accountId, {
  name: 'New Name',
  email: 'newemail@example.com'
});
```

## Testing the Database

### In Browser (Development)

1. Open browser DevTools (F12)
2. Go to **Application** tab
3. Navigate to **Storage** → **IndexedDB** → **WatchAppDB** → **accounts**
4. View all stored accounts

### On Mobile

See `MOBILE_SETUP.md` for instructions on viewing database data on mobile devices.

## Security Notes

⚠️ **Important for Production**:

1. **Password Hashing**: Currently passwords are stored in plain text. In production, use:
   - bcrypt, argon2, or similar hashing library
   - Never store plain text passwords

2. **Data Encryption**: Consider encrypting sensitive data at rest

3. **Input Validation**: Always validate and sanitize user input

4. **Rate Limiting**: Implement rate limiting for login attempts

5. **Session Management**: Consider using secure tokens instead of localStorage

## Database Operations

### Available Methods

```typescript
// Initialize database
await databaseService.init();

// Create account
await databaseService.createAccount(accountData);

// Authenticate
await databaseService.authenticate(identifier, password);

// Get by email
await databaseService.getAccountByEmail(email);

// Get by username
await databaseService.getAccountByUsername(username);

// Get all accounts
await databaseService.getAllAccounts();

// Update account
await databaseService.updateAccount(id, updates);

// Delete account
await databaseService.deleteAccount(id);

// Clear all (for testing)
await databaseService.clearAllAccounts();
```

## Troubleshooting

### Database Not Initializing

1. Check browser console for errors
2. Ensure IndexedDB is supported (all modern browsers support it)
3. Check for storage quota issues

### Accounts Not Saving

1. Verify form validation is passing
2. Check for duplicate email/username errors
3. Check browser console for errors

### Login Not Working

1. Verify account exists in database
2. Check username/email and password are correct
3. Check browser console for authentication errors

### Data Not Persisting

1. IndexedDB data persists automatically
2. Check browser storage settings
3. Ensure not in private/incognito mode (some browsers clear IndexedDB)

## Future Enhancements

Possible improvements:
- [ ] Password hashing (bcrypt)
- [ ] Account recovery/forgot password
- [ ] Email verification
- [ ] Profile pictures
- [ ] Account settings page
- [ ] Data export/import
- [ ] Migration to SQLite (if needed)
- [ ] Cloud sync (optional)

## Mobile Compatibility

The IndexedDB database works automatically on mobile devices through Capacitor's WebView. No additional configuration needed!

For mobile setup instructions, see `MOBILE_SETUP.md`.



