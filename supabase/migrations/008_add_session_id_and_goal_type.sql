-- Add session_id to board_objects for tagging objects to sessions
ALTER TABLE board_objects
  ADD COLUMN session_id UUID REFERENCES board_sessions(id) ON DELETE SET NULL;

-- Index for fast queries by session
CREATE INDEX idx_board_objects_session_id ON board_objects(session_id);

-- Update type constraint to include 'goal'
ALTER TABLE board_objects DROP CONSTRAINT IF EXISTS board_objects_type_check;
ALTER TABLE board_objects
  ADD CONSTRAINT board_objects_type_check
  CHECK (type IN ('sticky_note', 'shape', 'frame', 'connector', 'text', 'rectangle', 'circle', 'line', 'goal'));
