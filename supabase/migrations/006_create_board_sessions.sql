-- Board sessions: tracks individual coaching sessions within a journey board

CREATE TABLE IF NOT EXISTS board_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  session_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, session_number)
);

-- Index for fast session queries per board
CREATE INDEX idx_board_sessions_board_id ON board_sessions(board_id);

-- Enable RLS
ALTER TABLE board_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies: mirror board_objects pattern (access via board_members)
CREATE POLICY "Users can view sessions on their boards"
  ON board_sessions FOR SELECT
  USING (
    board_id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Board editors can create sessions"
  ON board_sessions FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Board editors can update sessions"
  ON board_sessions FOR UPDATE
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "Board editors can delete sessions"
  ON board_sessions FOR DELETE
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );
