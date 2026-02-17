/**
 * TypeScript types for Supabase database schema
 *
 * These types provide type safety when querying the database.
 * They match the schema defined in supabase/migrations/001_initial_schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      boards: {
        Row: {
          id: string
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
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
      }
      board_objects: {
        Row: {
          id: string
          board_id: string
          type: 'sticky_note' | 'shape' | 'frame' | 'connector' | 'text'
          x: number
          y: number
          width: number
          height: number
          rotation: number
          z_index: number
          data: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          type: 'sticky_note' | 'shape' | 'frame' | 'connector' | 'text'
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          z_index?: number
          data?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          type?: 'sticky_note' | 'shape' | 'frame' | 'connector' | 'text'
          x?: number
          y?: number
          width?: number
          height?: number
          rotation?: number
          z_index?: number
          data?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
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
 * Shape specific data
 */
export interface ShapeData {
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'line'
  color: string
  strokeColor?: string
  strokeWidth?: number
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

/**
 * Board type
 */
export type Board = Database['public']['Tables']['boards']['Row']

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
