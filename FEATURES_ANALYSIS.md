# Admin Schedules Feature Analysis

## Overview
Comprehensive analysis of all features in the Admin Collection Schedules page (`admin/src/pages/Schedules.tsx`).

---

## 1. CORE FEATURES

### 1.1 Collector/Truck Assignment
- **Dropdown Selection**: Select collector/truck from dropdown
- **Display Format**: Shows "Collector Name (Truck No)" or "Collector Name (No Truck)"
- **Auto-Reset**: Changing collector clears all form fields (barangay, streets, coordinates, temporary schedules)
- **Required Field**: Must be selected before creating schedule

**Interaction**: 
- When collector changes, all location data (flags, selected streets, barangay) is cleared
- Removes all temporary schedule markers from map
- Resets flag marker reference

---

### 1.2 Collection Days Selection
- **Days Grid**: 7-day grid (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- **Multi-Select**: Can select multiple days
- **Conflict Prevention**: Prevents selecting days already scheduled for the selected collector
- **Visual Feedback**:
  - Selected days: Blue border, light blue background
  - Disabled days: Grayed out, "not-allowed" cursor, asterisk (*) indicator
  - Tooltip shows why day is disabled
- **Smart Toggle**: Allows unchecking days even if they're in other schedules
- **Helper Text**: Shows message about already scheduled days

**Interaction**:
- Checks existing schedules for the selected collector
- Excludes current schedule being edited (if in edit mode)
- Days are stored as array: `['Mon', 'Tue', 'Wed']`
- Required field for form submission

---

### 1.3 Location Selection Methods

#### A. Map Flag Dropping (Press F / Toggle Button)
- **Keyboard Shortcut**: Press `F` key to toggle map pick mode
- **Visual Indicator**: 
  - Button changes: "Pick Location on Map (Press F)" ↔ "📍 Click on map to drop flag (Press F to toggle)"
  - Cursor changes to crosshair when active
  - Warning banner appears: "Click on the map to drop a flag at the collection location. Press F again to cancel."
- **Click-to-Drop**: Click anywhere on map to drop red flag marker
- **Reverse Geocoding**: Automatically extracts street and barangay from coordinates using Nominatim API
- **Multiple Flags**: Can drop multiple flags (stays in pick mode until toggled off)
- **Barangay Matching**: 
  - Tries to match reverse-geocoded barangay against database
  - Checks multiple address fields (suburb, neighbourhood, city_district, quarter, village, city)
  - Performs exact and partial matching
  - Filters out "district" names
- **Flag Popup**: Each flag shows street name, barangay, and "Remove" button
- **Temporary Storage**: Flags stored in `temporarySchedules` array until form submission

**Interaction**:
- F key handler only works when NOT typing in input fields
- Prevents default browser behavior when F is pressed
- Map click handler only active when `mapPickModeRef.current === true`
- Each flag click creates a temporary schedule entry
- Flags persist until manually removed or form is submitted/cancelled

#### B. Manual Location Entry (Fallback)
- **Barangay Autocomplete**: Type to search and select barangay from database
- **Street Addition**: Manual street entry (though mostly used via map flags)
- **Coordinate Storage**: Stores coordinates when barangay has lat/lng in database

---

### 1.4 Location Tags Display
- **Combined Display**: Shows "Barangay / Street" format in tag style
- **Clickable Tags**: Click tag to center map on that location's coordinates
- **Remove Button**: X button on each tag to remove location
- **Hover Effects**: Visual feedback on hover
- **Empty State**: Shows "Drop flags on the map to add locations" when empty
- **Counter Display**: "Clear All Flags (N)" button shows count of flags

**Interaction**:
- Tags created from `temporarySchedules` array (map flags)
- Clicking tag updates `selectedBarangayCoords` and centers map
- Removing tag removes corresponding marker from map
- Removing last tag clears barangay selection

---

### 1.5 Map Features

#### A. Base Map
- **Technology**: Leaflet.js with OpenStreetMap tiles
- **Initial View**: Centered on Quezon City (14.6760, 121.0437), zoom level 12
- **Attribution**: "© OpenStreetMap contributors"

#### B. Location Search (Map Section)
- **Search Bar**: "Search for a location (e.g., Quezon City, Manila, Street Name)"
- **Forward Geocoding**: Uses Nominatim API with Philippines country filter
- **Dropdown Results**: Shows location suggestions with name and address
- **Minimum Query Length**: Requires 3+ characters
- **Behavior**: Selecting result centers map (does NOT add marker)
- **Debouncing**: Search triggers on input change

#### C. Schedule Markers (Existing Schedules)
- **Color Coding**: Each collector gets unique color from 18-color palette
  - Colors: blue, red, green, orange, yellow, violet, grey, gold, black, pink, cadetblue, darkgreen, darkblue, darkred, darkpurple, lightblue, lightgreen, lightred
  - Colors assigned sequentially based on sorted collector IDs
- **Popup Information**: Shows collector name, truck number, barangay, street(s), days
- **Multiple Markers**: One marker per coordinate pair (supports arrays of lat/lng)
- **Filtering**: Doesn't show markers for locations already marked by temporary flags

#### D. Temporary Flag Markers (Red)
- **Color**: Red markers for user-selected locations
- **Popup**: Shows street, barangay, and "Remove" button
- **Unique IDs**: Each flag has unique ID: `${Date.now()}-${Math.random()...}`
- **Persistence**: Flags remain until removed or form submitted

#### E. Map Interaction
- **Click Handler**: Only active when `mapPickModeRef.current === true`
- **Zoom Controls**: Standard Leaflet zoom controls
- **Auto-Centering**: Map centers on selected barangay coordinates (if available)
- **Marker Management**: 
  - Clears existing schedule markers when schedules change
  - Preserves temporary flag markers during updates
  - Removes markers when schedules/collections deleted

---

### 1.6 Schedule Management

#### A. Create Schedule
- **Form Validation**:
  - Requires collector selection
  - Requires at least one day selected
  - Requires at least one location (flag or manual entry)
- **Data Collection**: 
  - Collects all temporary schedules (flags)
  - Combines into single schedule entry with arrays for multiple locations
  - Stores: latitudes[], longitudes[], barangay_names[], street_names[]
- **Barangay Validation**: Ensures barangay exists in database before creation
- **Success Message**: Shows count of schedules created
- **Form Reset**: Clears all fields, removes flags, resets map pick mode after success

#### B. Edit Schedule
- **Trigger**: Click "Edit" button on schedule row
- **Form Population**: 
  - Sets collector, days, barangay
  - Recreates temporary flag markers from saved coordinates
  - Loads all streets/barangays as flags on map
- **Scroll Behavior**: Automatically scrolls to top (form section)
- **Update Mode**: Submit button changes to "Update Schedule"
- **Cancel Button**: Appears when editing, resets form

#### C. Delete Schedule
- **Confirmation Dialog**: Browser confirm() before deletion
- **Cascade**: Deletes schedule from database
- **Reload**: Refreshes schedule list after deletion

#### D. View Schedules
- **Collector Grouping**: Schedules grouped by collector/truck
- **Collector Buttons**: Toggle buttons showing "Collector Name (Truck No)"
- **Panel Display**: Clicking collector button shows their schedules in table
- **Table Columns**:
  - Collector
  - Truck No
  - Location (barangay with streets below)
  - Days (as colored tags)
  - Actions (Edit/Delete buttons)
- **Close Button**: X button to collapse schedule panel
- **Empty State**: Shows "No schedules created yet" when no schedules exist

---

## 2. DATA STRUCTURES

### Schedule Interface
```typescript
{
  id: string;
  collector_id: string;
  barangay_id: string;
  street_ids?: string[];        // Array of street IDs
  days: string[];                // ['Mon', 'Tue', ...]
  created_at: string;
  updated_at: string;
  latitude?: number[];           // Array of latitude coordinates
  longitude?: number[];          // Array of longitude coordinates
  truck_no?: string;
  barangay_name?: string[];      // Array of barangay names
  street_name?: string[];        // Array of street names
}
```

### Temporary Schedule (Flag)
```typescript
{
  id: string;                    // Unique ID for removal
  street: string;
  barangay: string;
  barangayId?: string;
  latitude: number;
  longitude: number;
  marker: L.Marker;              // Leaflet marker reference
}
```

---

## 3. KEYBOARD SHORTCUTS

### F Key - Toggle Map Pick Mode
- **Activation**: Press `F` or `Shift+F` (case insensitive)
- **Restrictions**: 
  - Only works when NOT typing in input/textarea
  - Not active when input field is focused
  - Ignores if Ctrl/Cmd/Alt modifiers are pressed
- **Action**: Toggles `mapPickMode` state
- **Visual Feedback**: 
  - Cursor changes to crosshair
  - Button text updates
  - Warning banner appears/disappears

---

## 4. API INTEGRATIONS

### 4.1 Supabase Database
- **Collections**:
  - `collection_schedules` - Main schedules table
  - `barangays` - Location data with optional lat/lng
  - `accounts` - Collector/truck information (filtered by role='collector')
- **Operations**:
  - SELECT: Load schedules, barangays, collectors
  - INSERT: Create new schedules
  - UPDATE: Edit existing schedules
  - DELETE: Remove schedules

### 4.2 Nominatim (OpenStreetMap)
- **Reverse Geocoding**: Convert coordinates → address
  - Endpoint: `https://nominatim.openstreetmap.org/reverse`
  - Parameters: lat, lon, format=json, zoom=18, addressdetails=1
  - User-Agent: 'WasteCollectionApp/1.0'
- **Forward Geocoding**: Convert address → coordinates
  - Endpoint: `https://nominatim.openstreetmap.org/search`
  - Parameters: q (query), format=json, limit=10, countrycodes=ph
  - Used for location search feature

---

## 5. STATE MANAGEMENT

### Core State Variables
1. **Collectors**: List of collector accounts
2. **Schedules**: All existing schedules
3. **Loading**: Initial data load status
4. **Editing**: `editingScheduleId` - tracks which schedule is being edited
5. **Selected Collector**: Current form selection
6. **Selected Days**: Array of selected days
7. **Barangays**: Full list from database
8. **Selected Barangay**: Currently selected barangay name
9. **Selected Streets**: Array of selected street names
10. **Temporary Schedules**: Array of flag markers (not yet saved)
11. **Map Pick Mode**: Boolean toggle for flag dropping
12. **Selected Collector for Panel**: Which collector's schedules to display
13. **Location Search**: Search query and results for map navigation

---

## 6. FEATURE INTERACTIONS

### Create Flow
1. Select collector → clears previous selections
2. Select days → checks conflicts with existing schedules
3. Press F or click button → enables map pick mode
4. Click map → drops flag, reverse geocodes, extracts street/barangay
5. Flag appears → stored in temporarySchedules, shows in location tags
6. Repeat 4-5 for multiple locations
7. Submit → validates, creates schedule with all flags, clears form

### Edit Flow
1. Click Edit → populates form, recreates flags from saved data
2. Modify selections → same as create flow
3. Update → saves changes, clears form
4. Cancel → discards changes, clears form

### View Flow
1. Click collector button → shows that collector's schedules
2. Table displays → shows all schedules for selected collector
3. Click Edit → switches to edit flow
4. Click Delete → confirms and removes schedule

### Map Interaction Flow
1. Search location → centers map (no marker)
2. Toggle pick mode → enables flag dropping
3. Click map → drops flag, geocodes, extracts data
4. Flag popup → can remove individual flag
5. Location tags → click to center map, X to remove
6. Clear All → removes all flags at once

---

## 7. VALIDATION RULES

1. **Collector Required**: Must select before submission
2. **Days Required**: At least one day must be selected
3. **Location Required**: Must have flags OR manual entry
4. **Day Conflicts**: Cannot select day already scheduled for collector (unless editing that schedule)
5. **Barangay Exists**: Barangay must exist in database before saving

---

## 8. UI/UX FEATURES

### Visual Feedback
- **Hover States**: Buttons, tags, checkboxes show hover effects
- **Disabled States**: Grayed out days with tooltips
- **Active States**: Selected collector button highlighted
- **Loading State**: "Loading schedules..." message
- **Empty States**: Helpful messages when no data

### Responsive Design
- **Grid Layout**: 2-column (form + map) on desktop, 1-column on mobile
- **Days Grid**: 7 columns on desktop, 4 columns on mobile
- **Flexible Tags**: Location tags wrap to multiple lines

### Accessibility
- **Keyboard Support**: F key for map pick mode
- **Tooltips**: Explains disabled days
- **Labels**: All form fields properly labeled
- **Focus States**: Visual focus indicators on inputs

---

## 9. EDGE CASES HANDLED

1. **Missing Barangay Data**: Falls back to manual selection if geocoding fails
2. **No Street Name**: Allows creation with barangay only
3. **Multiple Coordinates**: Supports arrays for multiple locations per schedule
4. **Barangay Not in Database**: Shows error with available barangays list
5. **Map Container Not Ready**: Retries initialization with requestAnimationFrame
6. **Geocoding Failures**: Shows alert, allows manual entry
7. **Collector Change**: Clears all location data to prevent confusion
8. **Edit Mode**: Excludes current schedule from conflict checking
9. **Marker Cleanup**: Prevents duplicate markers, properly removes on delete
10. **Input Focus**: F key doesn't activate when typing

---

## 10. TECHNICAL DETAILS

### React Hooks Used
- `useState`: All form and UI state
- `useEffect`: Data loading, map initialization, keyboard handlers, marker updates
- `useRef`: Map instance, container reference, flag marker, pick mode flag, removal function

### Performance Optimizations
- **Marker Filtering**: Only adds markers not already in temporary schedules
- **Debounced Search**: Location search requires 3+ characters
- **Conditional Rendering**: Only renders schedule panels when selected
- **Map Initialization**: Only once, with cleanup on unmount

### Error Handling
- **Try-Catch Blocks**: Around API calls and map initialization
- **User Alerts**: Success/error messages for all operations
- **Console Logging**: Error details logged for debugging
- **Graceful Degradation**: Falls back to manual entry if geocoding fails

---

## SUMMARY

The Schedules page is a comprehensive location-based scheduling system with:
- **5 main sections**: Form, Map, Location Tags, Search, Schedule List
- **3 location input methods**: Map flags (F key), manual entry, search
- **4 CRUD operations**: Create, Read (View), Update (Edit), Delete
- **18 marker colors** for visual distinction
- **Multiple validation layers** to ensure data integrity
- **Rich interactions** between map, form, and schedule display

All features work together to provide an intuitive interface for managing collection schedules with geographic precision.

