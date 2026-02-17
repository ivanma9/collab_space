/**
 * Supabase Client Configuration
 *
 * Creates a singleton Supabase client instance for the application.
 * Uses environment variables for configuration.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL']
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY']

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  )
}

/**
 * Supabase client instance
 *
 * Features enabled:
 * - Auth: Automatic session management and Google OAuth
 * - Realtime: WebSocket connections for board_objects changes
 * - Broadcast: Low-latency cursor position sharing
 * - Presence: Track who's online on each board
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting for Realtime messages
    },
  },
})

/**
 * Helper function to get the current user
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * Helper function to sign out
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
