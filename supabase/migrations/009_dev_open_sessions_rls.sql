-- DEV ONLY: Open RLS policies for board_sessions and session_ai_context
-- Matches the pattern from 002_test_board_setup.sql for board_objects
-- IMPORTANT: Remove before production!

-- board_sessions: drop strict policies, add open ones
DROP POLICY IF EXISTS "Users can view sessions on their boards" ON board_sessions;
DROP POLICY IF EXISTS "Board editors can create sessions" ON board_sessions;
DROP POLICY IF EXISTS "Board editors can update sessions" ON board_sessions;
DROP POLICY IF EXISTS "Board editors can delete sessions" ON board_sessions;

CREATE POLICY "Allow all to view board_sessions (DEV ONLY)"
  ON board_sessions FOR SELECT USING (true);

CREATE POLICY "Allow all to create board_sessions (DEV ONLY)"
  ON board_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all to update board_sessions (DEV ONLY)"
  ON board_sessions FOR UPDATE USING (true);

CREATE POLICY "Allow all to delete board_sessions (DEV ONLY)"
  ON board_sessions FOR DELETE USING (true);

-- session_ai_context: drop strict policies, add open ones
DROP POLICY IF EXISTS "Users can view AI context for their boards" ON session_ai_context;
DROP POLICY IF EXISTS "System can upsert AI context" ON session_ai_context;

CREATE POLICY "Allow all to view session_ai_context (DEV ONLY)"
  ON session_ai_context FOR SELECT USING (true);

CREATE POLICY "Allow all to insert session_ai_context (DEV ONLY)"
  ON session_ai_context FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all to update session_ai_context (DEV ONLY)"
  ON session_ai_context FOR UPDATE USING (true);

CREATE POLICY "Allow all to delete session_ai_context (DEV ONLY)"
  ON session_ai_context FOR DELETE USING (true);
