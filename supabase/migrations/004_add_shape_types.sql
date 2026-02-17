-- Add rectangle, circle, and line as valid board object types
-- The original constraint only included: sticky_note, shape, frame, connector, text
-- This migration updates it to also include the new individual shape types

-- Drop the existing check constraint (auto-named by PostgreSQL)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT tc.constraint_name
    INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_name = 'board_objects'
        AND tc.table_schema = 'public'
        AND tc.constraint_type = 'CHECK'
        AND cc.check_clause LIKE '%sticky_note%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE board_objects DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No matching constraint found - may already be updated';
    END IF;
END $$;

-- Add updated constraint with all shape types
ALTER TABLE board_objects
    ADD CONSTRAINT board_objects_type_check
    CHECK (type IN ('sticky_note', 'shape', 'frame', 'connector', 'text', 'rectangle', 'circle', 'line'));
