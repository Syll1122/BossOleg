# Collection Time Migration Guide

This migration adds the `collection_time` column to the `collection_schedules` table to store the scheduled collection start time for each route.

## Migration File

**File:** `docs/supabase-migration-add-collection-time.sql`

## How to Run

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-migration-add-collection-time.sql`
4. Click **Run** to execute the migration

## What This Migration Does

1. **Adds `collection_time` column** to `collection_schedules` table
   - Data type: `TEXT`
   - Default value: `'08:00'`
   - Format: HH:MM (24-hour format, e.g., 08:00, 14:30, 23:59)

2. **Updates existing records** with NULL or empty time values to default `'08:00'`

3. **Adds validation constraint** to ensure time format is valid (HH:MM in 24-hour format)

## Database Schema

After running this migration, the `collection_schedules` table will have:

```sql
collection_time TEXT DEFAULT '08:00'
```

### Column Details

- **Name:** `collection_time`
- **Type:** `TEXT`
- **Default:** `'08:00'`
- **Format:** HH:MM (24-hour format)
- **Examples:** 
  - `'08:00'` (8:00 AM)
  - `'14:30'` (2:30 PM)
  - `'23:59'` (11:59 PM)
- **Constraint:** Must match pattern `^([0-1][0-9]|2[0-3]):[0-5][0-9]$`

## Verification

After running the migration, you can verify it worked by running this query:

```sql
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'collection_schedules' 
AND column_name = 'collection_time';
```

Expected result:
- `column_name`: `collection_time`
- `data_type`: `text`
- `column_default`: `'08:00'`
- `is_nullable`: `YES`

## Rollback (if needed)

If you need to remove the column:

```sql
-- Remove the constraint first
ALTER TABLE collection_schedules 
DROP CONSTRAINT IF EXISTS collection_schedules_collection_time_format_check;

-- Remove the column
ALTER TABLE collection_schedules 
DROP COLUMN IF EXISTS collection_time;
```

## Notes

- The migration is **idempotent** - it's safe to run multiple times
- Existing schedules without a time will be set to `'08:00'` by default
- The time format validation ensures data integrity
- The column is nullable, but the application code should always provide a time value

