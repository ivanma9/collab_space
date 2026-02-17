import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface OnlineUser {
  userId: string
  userName: string
  avatarUrl?: string
  joinedAt: string
}

interface UsePresenceOptions {
  boardId: string
  userId: string
  userName: string
  avatarUrl?: string | null
}

export function usePresence({ boardId, userId, userName, avatarUrl }: UsePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Keep userName and avatarUrl in refs so the track effect always has fresh values
  const userNameRef = useRef(userName)
  const avatarUrlRef = useRef(avatarUrl)
  userNameRef.current = userName
  avatarUrlRef.current = avatarUrl

  // Effect 1: Create channel (only on boardId/userId change — stable for the session)
  useEffect(() => {
    const channel = supabase.channel(`board:${boardId}:presence`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const seen = new Set<string>()
        const users: OnlineUser[] = Object.values(state)
          .flat()
          .filter(
            (u) =>
              typeof (u as Record<string, unknown>)['userId'] === 'string' &&
              typeof (u as Record<string, unknown>)['userName'] === 'string'
          )
          .map((u) => u as unknown as OnlineUser)
          .filter((u) => {
            if (seen.has(u.userId)) return false
            seen.add(u.userId)
            return true
          })
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            userName: userNameRef.current,
            avatarUrl: avatarUrlRef.current ?? undefined,
            joinedAt: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [boardId, userId]) // Only boardId and userId — stable for the session

  // Effect 2: Re-track when userName or avatarUrl change (without recreating channel)
  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return
    // Only re-track if already subscribed
    channel.track({
      userId,
      userName,
      avatarUrl: avatarUrl ?? undefined,
      joinedAt: new Date().toISOString(),
    })
  }, [userId, userName, avatarUrl])

  return { onlineUsers }
}
