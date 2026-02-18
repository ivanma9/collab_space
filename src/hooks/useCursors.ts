/**
 * useCursors Hook
 *
 * Manages multiplayer cursor positions using Supabase Broadcast.
 * This is Pattern B architecture - cursors use Broadcast (no database).
 *
 * Performance target: <50ms latency for cursor updates
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { CursorPosition } from '../lib/database.types'
import { getUserColor } from '../lib/userColors'

interface UseCursorsOptions {
  boardId: string
  userId: string
  userName: string
  throttleMs?: number
}

interface UseCursorsReturn {
  cursors: Map<string, CursorPosition>
  broadcastCursor: (x: number, y: number) => void
  isConnected: boolean
}


/**
 * Hook for managing multiplayer cursors with Supabase Broadcast
 */
export function useCursors({
  boardId,
  userId,
  userName,
  throttleMs = 50, // Throttle to ~20 updates/second (50ms)
}: UseCursorsOptions): UseCursorsReturn {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(
    new Map()
  )
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastBroadcastTime = useRef<number>(0)
  const userColor = useRef<string>(getUserColor(userId))

  /**
   * Broadcast cursor position to other users
   * Throttled to prevent overwhelming the network
   */
  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now()

      // Throttle: only broadcast if enough time has passed
      if (now - lastBroadcastTime.current < throttleMs) {
        return
      }

      lastBroadcastTime.current = now

      if (!channelRef.current) return

      const cursorData: CursorPosition = {
        userId,
        userName,
        x,
        y,
        color: userColor.current,
      }

      // Broadcast using Supabase Broadcast (Pattern B - no database)
      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor',
        payload: cursorData,
      })
    },
    [boardId, userId, userName, throttleMs]
  )

  /**
   * Set up Supabase Broadcast channel for cursors
   */
  useEffect(() => {
    // Create a unique channel for this board
    const channel = supabase.channel(`board:${boardId}:cursors`, {
      config: {
        broadcast: {
          self: false, // Don't receive our own broadcasts
        },
      },
    })

    // Listen for cursor broadcasts from other users
    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const cursorData = payload as CursorPosition

        // Update cursors map with new position
        setCursors((prev) => {
          const next = new Map(prev)
          next.set(cursorData.userId, cursorData)
          return next
        })
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Cursor channel connected')
          setIsConnected(true)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Cursor channel error')
          setIsConnected(false)
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Cursor channel timed out')
          setIsConnected(false)
        }
      })

    channelRef.current = channel

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up cursor channel')
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [boardId])

  /**
   * Remove stale cursors (users who haven't moved in 5 seconds)
   */
  useEffect(() => {
    const STALE_TIMEOUT = 5000 // 5 seconds

    const interval = setInterval(() => {
      setCursors((prev) => {
        const next = new Map(prev)
        let changed = false

        // This is a simplified stale detection
        // In production, you'd track lastSeen timestamps
        // For now, we'll rely on Presence for user tracking

        return changed ? next : prev
      })
    }, STALE_TIMEOUT)

    return () => clearInterval(interval)
  }, [])

  return {
    cursors,
    broadcastCursor,
    isConnected,
  }
}
