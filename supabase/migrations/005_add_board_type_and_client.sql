-- Add board type ('regular' | 'journey') and client_name to boards table
-- Existing boards default to 'regular'

ALTER TABLE boards
  ADD COLUMN type TEXT NOT NULL DEFAULT 'regular'
    CHECK (type IN ('regular', 'journey')),
  ADD COLUMN client_name TEXT;
