import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    const channel = supabase.channel(`board:${boardId}:presence`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<OnlineUser>()
        const users: OnlineUser[] = Object.values(state).flat()
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            userName,
            avatarUrl: avatarUrl ?? undefined,
            joinedAt: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [boardId, userId, userName, avatarUrl])

  return { onlineUsers }
}
