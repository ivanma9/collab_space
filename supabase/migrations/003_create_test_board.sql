-- Create a test board for development
-- This board is used by the cursor test page

-- First, modify the trigger to handle NULL created_by
DROP TRIGGER IF EXISTS on_board_created ON boards;

CREATE OR REPLACE FUNCTION handle_new_board()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add board member if created_by is not NULL
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO board_members (board_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_board_created
  AFTER INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_board();

-- Now insert test board (only if it doesn't exist)
INSERT INTO boards (id, name, created_by, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Board (Development)',
  NULL, -- No creator for test board (for testing without auth)
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
