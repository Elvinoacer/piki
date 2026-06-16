-- prisma/migrations/YYYYMMDDHHMMSS_add_trip_search_vector/migration.sql
-- Feature 3.14 — Search, History & Receipts
-- Run via: npx prisma migrate dev --name add_trip_search_vector

-- Add S3 key for receipt PDF
ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "receiptUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "receiptSentAt" TIMESTAMPTZ;

-- Add generated tsvector column for full-text search on addresses.
-- STORED means Postgres computes it on write and stores it on disk
-- (fast reads, tiny write overhead — ideal for search).
ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce("pickupAddress", '') || ' ' || coalesce("dropoffAddress", '')
    )
  ) STORED;

-- GIN index on the tsvector column — enables sub-millisecond FTS
CREATE INDEX IF NOT EXISTS "idx_trip_search_vector"
  ON "Trip" USING GIN ("search_vector");

-- Composite indexes for filter queries
CREATE INDEX IF NOT EXISTS "idx_trip_client_date"
  ON "Trip" ("clientId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_trip_rider_date"
  ON "Trip" ("riderId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "idx_trip_status"
  ON "Trip" ("status");

CREATE INDEX IF NOT EXISTS "idx_trip_type"
  ON "Trip" ("type");
