# Login Status Tracking in Database

## Overview
This feature tracks whether users are logged in or not in the database. This information is stored in the `accounts` table and is used to determine if collectors are online/offline for truck location display.

## Database Schema

### Added Columns to `accounts` Table
- `is_online` (BOOLEAN) - `true` if user is logged in, `false` if logged out
- `last_login_at` (TIMESTAMPTZ) - Timestamp of last login
- `last_logout_at` (TIMESTAMPTZ) - Timestamp of last logout

## How It Works

### Login Flow
1. User enters credentials and submits login form
2. `authenticate()` method validates credentials with Supabase Auth
3. If successful, `setUserOnlineStatus(userId, true)` is called
4. Database updates:
   - `isOnline = true`
   - `lastLoginAt = NOW()`
   - `updatedAt = NOW()`

### Logout Flow
1. User clicks logout
2. `logout()` function in `auth.ts` is called
3. `setUserOnlineStatus(userId, false)` is called
4. Database updates:
   - `isOnline = false`
   - `lastLogoutAt = NOW()`
   - `updatedAt = NOW()`

### Truck Location Logic
When displaying trucks on the resident map:
1. Check collector's login status: `isOnline` field
2. Check last truck update time: `status.updatedAt`
3. Collector is considered **ONLINE** if:
   - `isOnline = true` (logged in) AND
   - Last update was < 5 minutes ago
4. If ONLINE: Show truck at actual GPS coordinates
5. If OFFLINE: Show truck at default location `14.683718, 121.076555`

## Database Methods

### `setUserOnlineStatus(userId, isOnline)`
- Updates `isOnline`, `lastLoginAt` or `lastLogoutAt` in accounts table
- Called automatically on login/logout

### `getUserOnlineStatus(userId)`
- Returns `true` if user is logged in, `false` otherwise
- Used to check individual user status

### `getUsersOnlineStatus(userIds[])`
- Batch query to check multiple users at once
- More efficient than individual queries
- Returns `Map<userId, isOnline>`

## Setup

### Step 1: Run SQL Migration
Run `supabase-add-login-status.sql` in Supabase SQL Editor to add the columns.

### Step 2: Code is Already Updated
- Login automatically sets `is_online = true`
- Logout automatically sets `is_online = false`
- Truck view checks login status before showing GPS

## Benefits

1. **Accurate Online Status**: Database tracks actual login/logout events
2. **Better Offline Detection**: Combines login status with update time for accuracy
3. **Efficient Queries**: Batch checking multiple users at once
4. **Real-time Tracking**: Status updates immediately on login/logout

## Usage

The login status is automatically maintained - no manual intervention needed:
- ✅ Login sets user as online
- ✅ Logout sets user as offline
- ✅ Truck locations use login status to determine if GPS should be shown

