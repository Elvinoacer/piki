-- ============================================================
-- PIKII — PostGIS Setup Migration
-- Section 3.2: Real-Time Location & Matching
--
-- Run AFTER prisma migrate creates the base tables.
-- Apply with: psql $DATABASE_URL -f setup_postgis.sql
-- Or wrap in a Prisma custom migration (prisma migrate dev --name postgis_setup)
-- ============================================================

-- 1. Enable PostGIS extension
-- (requires superuser or rds_superuser role on RDS/Supabase/Neon)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ──────────────────────────────────────────────────────────────
-- 2. rider_locations: add geography column + spatial index
-- ──────────────────────────────────────────────────────────────

-- Add the geography point column (Prisma Unsupported type)
ALTER TABLE rider_locations
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

-- Spatial index for ST_DWithin radius queries (GIST is required for geo)
CREATE INDEX IF NOT EXISTS idx_rider_locations_location
  ON rider_locations USING GIST (location);

-- Composite index for the hot-path query in findNearbyRiders:
-- WHERE is_online = TRUE AND status = 'AVAILABLE'
CREATE INDEX IF NOT EXISTS idx_rider_locations_online_available
  ON rider_locations (is_online, status)
  WHERE is_online = TRUE AND status = 'AVAILABLE';

-- ──────────────────────────────────────────────────────────────
-- 3. trips: add geography columns for pickup/dropoff
-- ──────────────────────────────────────────────────────────────

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS pickup_location  geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS dropoff_location geography(Point, 4326);

-- Indexes (useful for zone-based queries and spatial joins)
CREATE INDEX IF NOT EXISTS idx_trips_pickup_location
  ON trips USING GIST (pickup_location);

CREATE INDEX IF NOT EXISTS idx_trips_dropoff_location
  ON trips USING GIST (dropoff_location);

-- ──────────────────────────────────────────────────────────────
-- 4. zones: add geography polygon column + spatial index
-- ──────────────────────────────────────────────────────────────

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS boundary geography(Polygon, 4326);

CREATE INDEX IF NOT EXISTS idx_zones_boundary
  ON zones USING GIST (boundary);

-- ──────────────────────────────────────────────────────────────
-- 5. trip_gps_trail: index for efficient trail queries
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gps_trail_trip_time
  ON trip_gps_trail (trip_id, recorded_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 6. Trigger: auto-populate pickup_location / dropoff_location
--    from lat/lng columns on INSERT/UPDATE
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_trip_geography()
RETURNS TRIGGER AS $$
BEGIN
  NEW.pickup_location  = ST_SetSRID(ST_MakePoint(NEW.pickup_lng,  NEW.pickup_lat),  4326)::geography;
  NEW.dropoff_location = ST_SetSRID(ST_MakePoint(NEW.dropoff_lng, NEW.dropoff_lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_trip_geography ON trips;
CREATE TRIGGER trg_sync_trip_geography
  BEFORE INSERT OR UPDATE OF pickup_lat, pickup_lng, dropoff_lat, dropoff_lng
  ON trips
  FOR EACH ROW
  EXECUTE FUNCTION sync_trip_geography();

-- ──────────────────────────────────────────────────────────────
-- 7. Helper view: online available riders with distance function
--    (useful for admin dashboards and debugging)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_online_riders AS
SELECT
  rl.rider_id,
  rl.latitude,
  rl.longitude,
  rl.heading,
  rl.speed_kmh,
  rl.status,
  rl.updated_at,
  rp.rating,
  rp.acceptance_rate
FROM rider_locations rl
JOIN rider_profiles rp ON rp.user_id = rl.rider_id
WHERE rl.is_online = TRUE;
