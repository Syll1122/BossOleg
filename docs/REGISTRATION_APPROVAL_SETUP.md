# Registration Approval System Setup

This document explains how to set up the collector registration approval system.

## Overview

The system allows admins to approve or reject collector registrations. Collectors cannot log in until their registration is approved.

## Features

- ✅ Collectors register with `pending` status
- ✅ Admin can approve/reject registrations via admin panel
- ✅ Email notifications sent when approved/rejected
- ✅ Registration history tracking
- ✅ Collectors blocked from login until approved

## Database Setup

### Step 1: Run the SQL Migration

Run the SQL migration file in your Supabase Dashboard → SQL Editor:

**File:** `docs/registration-approval-setup.sql`

This will:
- Create the `registration_history` table
- Add indexes for faster queries
- Set up RLS policies
- Update existing collector accounts

### Step 2: Verify Table Structure

The `accounts` table should have:
- `registrationStatus` column (TEXT, CHECK: 'pending', 'approved', 'rejected')

## EmailJS Configuration

The EmailJS service is configured with:

- **Service ID:** `service_07debef`
- **Public Key:** `s_FkJwQn8_G5O-33a`
- **Accepted Template:** `template_obv438r`
- **Rejected Template:** `template_untxk7j`

Make sure these templates in EmailJS include:
- `to_email` - Recipient email
- `user_name` - User's name
- `collector_name` - Collector's name (optional, defaults to user_name)

## Admin Panel Setup

1. **Install EmailJS package:**
   ```bash
   cd admin
   npm install @emailjs/browser
   ```

2. **Access Registration Page:**
   - Log in to admin panel
   - Click "Registrations" in the sidebar
   - View pending registrations and approve/reject them

## How It Works

### For Collectors

1. **Registration:**
   - Collector signs up with role "collector"
   - Account is created with `registrationStatus: 'pending'`
   - Collector sees message: "Your registration is pending approval"

2. **Login Attempt:**
   - If status is `pending`: Shows "Registration pending approval"
   - If status is `rejected`: Shows "Registration has been rejected"
   - If status is `approved`: Login succeeds

### For Admins

1. **View Pending Registrations:**
   - Go to "Registrations" page in admin panel
   - See all collectors with `pending` status

2. **Approve Registration:**
   - Click "Approve" button
   - Status changes to `approved`
   - Email sent to collector (using EmailJS)
   - Entry added to history

3. **Reject Registration:**
   - Click "Reject" button
   - Enter optional rejection notes
   - Status changes to `rejected`
   - Email sent to collector (using EmailJS)
   - Entry added to history

4. **View History:**
   - See all approval/rejection actions
   - View who reviewed and when
   - See rejection notes

## Files Modified/Created

### Main App
- `src/pages/SignUpPage.tsx` - Sets pending status for collectors
- `src/pages/LoginPage.tsx` - Checks registration status before login
- `src/services/database-supabase.ts` - Auto-sets pending status for collectors

### Admin Panel
- `admin/src/pages/Registrations.tsx` - New page for managing registrations
- `admin/src/services/api.ts` - Added approval/rejection functions
- `admin/src/services/emailService.ts` - EmailJS integration for notifications
- `admin/src/App.tsx` - Added registrations route
- `admin/src/components/Layout.tsx` - Added registrations nav item

### Database
- `docs/registration-approval-setup.sql` - SQL migration file

## Testing

1. **Test Registration:**
   - Register a new collector account
   - Verify status is `pending` in database
   - Try to login - should be blocked

2. **Test Approval:**
   - Log in as admin
   - Go to Registrations page
   - Approve the collector
   - Check email was sent
   - Try collector login - should succeed

3. **Test Rejection:**
   - Reject a pending registration
   - Check email was sent
   - Try collector login - should show rejection message

## Notes

- Residents and Admins are automatically approved (no approval needed)
- Only Collectors require approval
- Emails are sent via EmailJS using the configured templates
- History is stored in `registration_history` table
- The system auto-refreshes every 30 seconds to show new registrations




