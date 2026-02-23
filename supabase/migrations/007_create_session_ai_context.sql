-- Session AI context: stores persistent AI memory for coaching journeys

CREATE TABLE IF NOT EXISTS session_ai_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL UNIQUE,
  key_themes TEXT[] DEFAULT '{}',
  client_notes TEXT DEFAULT '',
  goal_history JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by board
CREATE INDEX idx_session_ai_context_board_id ON session_ai_context(board_id);

-- Enable RLS
ALTER TABLE session_ai_context ENABLE ROW LEVEL SECURITY;

-- RLS policies: same pattern as board_objects
CREATE POLICY "Users can view AI context for their boards"
  ON session_ai_context FOR SELECT
  USING (
    board_id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Board editors can create AI context"
  ON session_ai_context FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Board editors can update AI context"
  ON session_ai_context FOR UPDATE
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );
