-- Test Board Setup for Development
-- This creates a test board that's accessible without authentication
-- IMPORTANT: Remove these policies before production deployment!

-- Temporarily disable RLS for board_objects during testing
-- This allows the cursor test to work with mock users
DROP POLICY IF EXISTS "Users can view objects on their boards" ON board_objects;
DROP POLICY IF EXISTS "Board editors can create objects" ON board_objects;
DROP POLICY IF EXISTS "Board editors can update objects" ON board_objects;
DROP POLICY IF EXISTS "Board editors can delete objects" ON board_objects;

-- Create permissive policies for development/testing
-- These allow anyone to read/write board_objects for easier testing

CREATE POLICY "Allow all to view board_objects (DEV ONLY)"
  ON board_objects FOR SELECT
  USING (true);

CREATE POLICY "Allow all to create board_objects (DEV ONLY)"
  ON board_objects FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all to update board_objects (DEV ONLY)"
  ON board_objects FOR UPDATE
  USING (true);

CREATE POLICY "Allow all to delete board_objects (DEV ONLY)"
  ON board_objects FOR DELETE
  USING (true);

-- Note: When you implement real authentication, run this to restore secure policies:
-- DROP these permissive policies and recreate the original RLS policies from 001_initial_schema.sql
