-- CollabBoard Initial Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/siyttvubdfojxbbpnrvz/sql

-- ============================================================================
-- TABLES
-- ============================================================================

-- Boards table: each board is a separate collaborative whiteboard
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Untitled Board',
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board members: tracks who has access to which boards
CREATE TABLE IF NOT EXISTS board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

-- Board objects: all objects on the board (sticky notes, shapes, frames, etc.)
-- Uses a single table with type discriminator and JSONB for type-specific data
CREATE TABLE IF NOT EXISTS board_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sticky_note', 'shape', 'frame', 'connector', 'text')),

  -- Spatial properties (common to all objects)
  x FLOAT NOT NULL DEFAULT 0,
  y FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 100,
  height FLOAT NOT NULL DEFAULT 100,
  rotation FLOAT DEFAULT 0,
  z_index INTEGER DEFAULT 0,

  -- Type-specific properties stored as JSONB
  -- Examples:
  --   sticky_note: {"text": "Hello", "color": "#FFD700"}
  --   shape: {"shapeType": "rectangle", "color": "#00FF00", "strokeColor": "#000", "strokeWidth": 2}
  --   frame: {"title": "Sprint Planning", "backgroundColor": "#F0F0F0"}
  --   connector: {"fromId": "uuid", "toId": "uuid", "style": "arrow"}
  --   text: {"text": "Standalone text", "fontSize": 16, "color": "#000"}
  data JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

-- Index on board_id for fast object queries per board
CREATE INDEX IF NOT EXISTS idx_board_objects_board_id ON board_objects(board_id);

-- Index on board_members for fast access checks
CREATE INDEX IF NOT EXISTS idx_board_members_board_id ON board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user_id ON board_members(user_id);

-- Index on z_index for layer ordering
CREATE INDEX IF NOT EXISTS idx_board_objects_z_index ON board_objects(board_id, z_index);

-- Index on updated_at for last-write-wins conflict resolution
CREATE INDEX IF NOT EXISTS idx_board_objects_updated_at ON board_objects(board_id, updated_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- CRITICAL: Enable RLS on all tables to prevent unauthorized access
-- ============================================================================

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: Boards
-- ============================================================================

-- Users can see boards they are members of
CREATE POLICY "Users can view boards they are members of"
  ON boards FOR SELECT
  USING (
    id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid()
    )
  );

-- Users can create boards (they will automatically become the owner)
CREATE POLICY "Authenticated users can create boards"
  ON boards FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Board owners can update their boards
CREATE POLICY "Board owners can update their boards"
  ON boards FOR UPDATE
  USING (
    id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Board owners can delete their boards
CREATE POLICY "Board owners can delete their boards"
  ON boards FOR DELETE
  USING (
    id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================================
-- RLS POLICIES: Board Members
-- ============================================================================

-- Users can see members of boards they belong to
CREATE POLICY "Users can view board members of their boards"
  ON board_members FOR SELECT
  USING (
    board_id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid()
    )
  );

-- Board owners can add members
CREATE POLICY "Board owners can add members"
  ON board_members FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Board owners can remove members
CREATE POLICY "Board owners can remove members"
  ON board_members FOR DELETE
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================================================
-- RLS POLICIES: Board Objects
-- ============================================================================

-- Users can view objects on boards they are members of
CREATE POLICY "Users can view objects on their boards"
  ON board_objects FOR SELECT
  USING (
    board_id IN (
      SELECT board_id FROM board_members WHERE user_id = auth.uid()
    )
  );

-- Board editors can create objects
CREATE POLICY "Board editors can create objects"
  ON board_objects FOR INSERT
  WITH CHECK (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- Board editors can update objects
CREATE POLICY "Board editors can update objects"
  ON board_objects FOR UPDATE
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- Board editors can delete objects
CREATE POLICY "Board editors can delete objects"
  ON board_objects FOR DELETE
  USING (
    board_id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- ============================================================================
-- HELPER FUNCTION: Auto-add creator as board owner
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_board()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically add the board creator as owner in board_members
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-add board creator as owner
CREATE TRIGGER on_board_created
  AFTER INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_board();

-- ============================================================================
-- HELPER FUNCTION: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_objects_updated_at
  BEFORE UPDATE ON board_objects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- REALTIME CONFIGURATION
-- Enable real-time subscriptions for board objects
-- ============================================================================

-- Enable Realtime for board_objects table
ALTER PUBLICATION supabase_realtime ADD TABLE board_objects;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these after migration to verify setup
-- ============================================================================

-- Verify tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verify policies exist
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
