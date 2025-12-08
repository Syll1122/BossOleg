# Offline Truck Location Feature

## Overview
This feature handles truck location display when collectors are offline. When a collector hasn't updated their location in the last 5 minutes, their truck is displayed at a default location instead of showing outdated GPS coordinates.

## Default Location
- **Coordinates**: `14.683718, 121.076555`
- **When Used**: When collector is offline or hasn't updated location in 5+ minutes

## How It Works

### Online Detection
- A collector is considered **ONLINE** if their truck status was updated within the last **5 minutes** (`OFFLINE_THRESHOLD_MS = 5 * 60 * 1000`)
- An **ONLINE** collector's truck shows their actual GPS coordinates from the database
- An **OFFLINE** collector's truck shows the default location

### Location Logic
1. **Check last update time**: Compare `status.updatedAt` with current time
2. **If online** (updated < 5 min ago):
   - Use actual GPS coordinates (`status.latitude`, `status.longitude`)
   - Show real-time position on map
   - Enable proximity notifications
   
3. **If offline** (no update in 5+ min):
   - Use default location: `14.683718, 121.076555`
   - Show truck at default position
   - Disable proximity notifications (don't notify for default location)

## User Experience

### Truck Popup Display
- **Online trucks**: Show "Online (Real-time GPS)" with green indicator
- **Offline trucks**: Show "Offline (Default Location)" with gray indicator

### Console Logging
- Online: `Using GPS coordinates for truck BCG 12*5 (ONLINE): 14.6820187 121.0749382`
- Offline: `Using default location for truck BCG 12*5 (OFFLINE, last update: 420s ago)`

## Configuration

You can adjust the offline threshold in `ResidentTruckView.tsx`:
```typescript
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // Change this value to adjust offline detection
```

- **5 minutes** (current): Default, good for normal operation
- **2 minutes**: More strict - considers offline sooner
- **10 minutes**: More lenient - keeps showing GPS longer

## Benefits

1. **Prevents confusion**: Residents don't see outdated/stale GPS positions
2. **Clear status**: Visual indicator shows when truck position is real-time vs default
3. **Better UX**: All offline trucks grouped at one location for easy identification
4. **Accurate notifications**: Proximity alerts only trigger for real GPS positions

## Technical Details

### Files Modified
- `src/pages/resident/ResidentTruckView.tsx`
  - Added `DEFAULT_OFFLINE_LOCATION` constant
  - Added `OFFLINE_THRESHOLD_MS` constant
  - Updated `loadAllTrucks()` to check online status
  - Updated `updateTruckStatuses()` to check online status
  - Updated `createTruckPopup()` to show online/offline status

### Data Flow
```
Collector updates status → Database (truck_status table)
                          ↓
Resident views map → Checks last update time
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                  ↓
    < 5 min ago                        ≥ 5 min ago
    (ONLINE)                            (OFFLINE)
         ↓                                  ↓
  Use actual GPS                  Use default location
  (Real-time tracking)            (14.683718, 121.076555)
```

## Testing

To test offline functionality:
1. Have a collector start collecting (truck should show at real GPS)
2. Wait 5+ minutes without collector updating
3. Refresh resident map - truck should move to default location
4. Collector updates again - truck should return to real GPS

## Notes

- The default location coordinates can be changed in the code if needed
- Offline threshold can be adjusted based on your requirements
- All trucks (regardless of truck number) use the same default location when offline
