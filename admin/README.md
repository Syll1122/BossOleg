# Admin Panel - Waste Collection Management

A separate admin website for managing the waste collection mobile app data.

## Features

- 🔐 **Admin Authentication** - Secure login for admin users only
- 📊 **Dashboard** - Overview with statistics and metrics
- 👥 **Users Management** - View, filter, and manage all users (residents, collectors, admins)
- 📝 **Reports Management** - View, filter, and update report statuses
- 🚛 **Truck Status Monitoring** - Real-time tracking of collection trucks with GPS coordinates

## Setup

1. **Install Dependencies**
   ```bash
   cd admin
   npm install
   ```

2. **Configure Environment Variables**
   
   Create a `.env` file in the `admin` directory:
   ```env
   VITE_SUPABASE_URL=https://ddyudqmtqtusnhycomcw.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeXVkcW10cXR1c25oeWNvbWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODY0MzQsImV4cCI6MjA4MDY2MjQzNH0.0I-Exw6_H_gLbsxS8EdTZDiwmRqiKORKlock-GhNQhg
   ```

   Or the values are already configured as fallbacks in the code.

3. **Run Development Server**
   ```bash
   npm run dev
   ```

   The admin panel will open at `http://localhost:3000`

4. **Build for Production**
   ```bash
   npm run build
   ```

## Login

You need an admin account to access the panel. The account must have `role: 'admin'` in the database.

- Login with email or username
- Password authentication
- Session stored in localStorage (expires after 24 hours)

## Pages

### Dashboard
- Statistics overview
- Total users, residents, collectors, admins
- Reports summary (total, pending, resolved)
- Truck status summary
- Auto-refreshes every 30 seconds

### Users
- View all users in a table
- Filter by role (all, residents, collectors, admins)
- Delete users
- View user details (email, username, barangay, truck number, etc.)

### Reports
- View all reports from residents
- Filter by status (all, pending, reviewed, resolved)
- Update report status
- Delete reports
- Auto-refreshes every 30 seconds

### Trucks
- Real-time truck status monitoring
- View GPS coordinates with map links
- Toggle collecting status
- Mark trucks as full/not full
- Auto-refreshes every 10 seconds

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Routing
- **Supabase** - Database connection (same as mobile app)

## Notes

- The admin panel connects to the same Supabase database as the mobile app
- All operations are performed with the anon key (same as mobile app)
- Session management is handled via localStorage
- The panel is completely separate from the mobile app codebase


