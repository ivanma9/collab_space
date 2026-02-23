/**
 * TypeScript types for Supabase database schema
 *
 * These types provide type safety when querying the database.
 * They match the schema defined in supabase/migrations/
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type BoardType = 'regular' | 'journey'
export type SessionStatus = 'active' | 'completed'
export type GoalStatus = 'active' | 'completed' | 'stalled'

export type Database = {
  public: {
    Tables: {
      boards: {
        Row: {
          id: string
          name: string
          invite_code: string
          type: BoardType
          client_name: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string
          invite_code?: string
          type?: BoardType
          client_name?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          type?: BoardType
          client_name?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      board_members: {
        Row: {
          id: string
          board_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
          joined_at: string
        }
        Insert: {
          id?: string
          board_id: string
          user_id: string
          role?: 'owner' | 'editor' | 'viewer'
          joined_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          user_id?: string
          role?: 'owner' | 'editor' | 'viewer'
          joined_at?: string
        }
        Relationships: []
      }
      board_objects: {
        Row: {
          id: string
          board_id: string
          type: 'sticky_note' | 'shape' | 'frame' | 'connector' | 'text' | 'rectangle' | 'circle' | 'line' | 'goal'
          x: number
          y: number
          width: number
          height: number
          rotation: number
          z_index: number
          data: Json
          session_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          type: 'sticky_note' | 'shape' | 'frame' | 'connector' | 'text' | 'rectangle' | 'circle' | 'line' | 'goal'
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          z_index?: number
          data?: Json
          session_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          type?: 'sticky_note' | 'shape' | 'frame' | 'connector' | 'text' | 'rectangle' | 'circle' | 'line' | 'goal'
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          z_index?: number
          data?: Json
          session_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      board_sessions: {
        Row: {
          id: string
          board_id: string
          session_number: number
          started_at: string
          ended_at: string | null
          summary: string | null
          status: SessionStatus
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          session_number: number
          started_at?: string
          ended_at?: string | null
          summary?: string | null
          status?: SessionStatus
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          session_number?: number
          started_at?: string
          ended_at?: string | null
          summary?: string | null
          status?: SessionStatus
          created_at?: string
        }
        Relationships: []
      }
      session_ai_context: {
        Row: {
          id: string
          board_id: string
          key_themes: string[]
          client_notes: string
          goal_history: Json
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          key_themes?: string[]
          client_notes?: string
          goal_history?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          key_themes?: string[]
          client_notes?: string
          goal_history?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// Application-level types with discriminated unions for type safety
// ============================================================================

/**
 * Base type for all board objects
 */
export interface BaseBoardObject {
  id: string
  board_id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  z_index: number
  session_id?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Sticky Note specific data
 */
export interface StickyNoteData {
  text: string
  color: string // Hex color like "#FFD700"
}

/**
 * Shape specific data (legacy)
 */
export interface ShapeData {
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line'
  color: string
  strokeColor?: string
  strokeWidth?: number
}

/**
 * Rectangle specific data
 */
export interface RectangleData {
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

/**
 * Circle specific data
 */
export interface CircleData {
  radius: number
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

/**
 * Line specific data
 */
export interface LineData {
  points: number[] // [x1, y1, x2, y2]
  strokeColor: string
  strokeWidth: number
}

/**
 * Frame specific data
 */
export interface FrameData {
  title: string
  backgroundColor?: string
}

/**
 * Connector specific data
 */
export interface ConnectorData {
  fromId: string
  toId: string
  style: 'line' | 'arrow' | 'dashed'
}

/**
 * Text element specific data
 */
export interface TextData {
  text: string
  fontSize: number
  color: string
  fontFamily?: string
}

/**
 * Goal specific data for coaching journeys
 */
export interface GoalData {
  title: string
  status: GoalStatus
  commitments: string[]
  due_date?: string
  created_session_id?: string
  completed_session_id?: string
}

/**
 * Discriminated union for type-safe board objects
 *
 * Usage:
 * if (obj.type === 'sticky_note') {
 *   // TypeScript knows obj.data is StickyNoteData
 *   console.log(obj.data.text)
 * }
 */
export type BoardObject =
  | (BaseBoardObject & { type: 'sticky_note'; data: StickyNoteData })
  | (BaseBoardObject & { type: 'shape'; data: ShapeData })
  | (BaseBoardObject & { type: 'frame'; data: FrameData })
  | (BaseBoardObject & { type: 'connector'; data: ConnectorData })
  | (BaseBoardObject & { type: 'text'; data: TextData })
  | (BaseBoardObject & { type: 'rectangle'; data: RectangleData })
  | (BaseBoardObject & { type: 'circle'; data: CircleData })
  | (BaseBoardObject & { type: 'line'; data: LineData })
  | (BaseBoardObject & { type: 'goal'; data: GoalData })

/**
 * Board type
 */
export type Board = Database['public']['Tables']['boards']['Row']

/**
 * Board session type
 */
export type BoardSession = Database['public']['Tables']['board_sessions']['Row']

/**
 * Session AI context type
 */
export type SessionAIContext = Database['public']['Tables']['session_ai_context']['Row']

/**
 * Board member type
 */
export type BoardMember = Database['public']['Tables']['board_members']['Row']

/**
 * User profile (from auth.users)
 */
export interface UserProfile {
  id: string
  email?: string
  full_name?: string
  avatar_url?: string
}

/**
 * Cursor position for multiplayer cursors
 */
export interface CursorPosition {
  userId: string
  userName: string
  x: number
  y: number
  color: string
}

/**
 * Presence data for tracking who's online
 */
export interface PresenceData {
  userId: string
  userName: string
  avatarUrl?: string
  joinedAt: string
}
