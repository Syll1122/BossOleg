# Collection Schedule System Setup

This document explains how to set up the collection schedule management system for admins.

## Overview

The Collection Schedule System allows administrators to assign specific collection schedules to trucks/collectors based on:
- **Truck/Collector**: Assign by collector name or truck number
- **Barangay**: Select collection location with autocomplete search
- **Days**: Select one or more days of the week (Mon-Sun)
- **Map Visualization**: View all scheduled locations on an interactive Leaflet map

## Database Setup

### Step 1: Run the SQL Migration

Run the SQL migration file in your Supabase Dashboard → SQL Editor:

**File:** `docs/collection-schedules-setup.sql`

This will:
- Create the `collection_schedules` table
- Add indexes for faster queries
- Add latitude/longitude columns to `barangays` table (if not exist)
- Set up RLS policies

### Step 2: Install Dependencies

```bash
cd admin
npm install leaflet @types/leaflet
```

## Features

### 1. Administrative Scheduling Interface

- **Assignment Key**: Select collector/truck by name or truck number
- **One-to-Many Scheduling**: Each truck can have different schedules
- **Day Selection**: Checkboxes for each day (Mon, Tue, Wed, Thu, Fri, Sat, Sun)

### 2. Barangay Selection with Autocomplete

- Type to search barangay names
- Dropdown list appears as you type
- Navigate with arrow keys or mouse
- Auto-select on click or Enter key

### 3. Leaflet Map Integration

- Interactive map showing all scheduled locations
- Blue markers for existing schedules
- Red marker for currently selected barangay
- Click markers to see schedule details in popup
- Map automatically centers on selected barangay

## How to Use

1. **Access Schedules Page**:
   - Log in to admin panel
   - Click "Schedules" in the sidebar

2. **Create a Schedule**:
   - Select a collector/truck from dropdown
   - Check the days for collection
   - Type and select a barangay
   - Click "Create Schedule"

3. **View on Map**:
   - All schedules appear as markers on the map
   - Selected barangay shows as red marker
   - Click markers to see details

4. **Manage Schedules**:
   - View all schedules in the table below
   - Delete schedules as needed

## Database Schema

### collection_schedules Table

```sql
- id: TEXT (Primary Key)
- collectorId: TEXT (References accounts.id)
- collectorName: TEXT
- truckNo: TEXT
- barangay: TEXT
- days: TEXT[] (Array of day abbreviations)
- latitude: DECIMAL(10,8)
- longitude: DECIMAL(11,8)
- createdAt: TIMESTAMPTZ
- updatedAt: TIMESTAMPTZ
```

## Map Features

- **OpenStreetMap tiles**: Free, open-source map tiles
- **Interactive markers**: Click to see schedule details
- **Auto-centering**: Map centers on selected barangay
- **Responsive**: Works on desktop and mobile

## Notes

- Barangays need latitude/longitude coordinates for map display
- You can manually add coordinates to barangays table if needed
- The system supports multiple schedules per truck (different barangays, different days)
- Days are stored as an array for flexible scheduling






