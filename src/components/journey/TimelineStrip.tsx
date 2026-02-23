import { useRef, useEffect } from 'react'
import type { BoardSession } from '../../lib/database.types'

interface TimelineStripProps {
  sessions: BoardSession[]
  activeSessionId: string | null
  onSessionClick: (session: BoardSession) => void
  onStartSession: () => void
  onEndSession: () => void
  hasActiveSession: boolean
  isCoach: boolean
}

export function TimelineStrip({
  sessions,
  activeSessionId,
  onSessionClick,
  onStartSession,
  onEndSession,
  hasActiveSession,
  isCoach,
}: TimelineStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active session
  useEffect(() => {
    if (!activeSessionId || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-session-id="${activeSessionId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center' })
  }, [activeSessionId])

  const sorted = [...sessions].sort((a, b) => a.session_number - b.session_number)

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 max-w-[80vw]">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-2">
        {/* Session markers */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide max-w-[60vw]"
        >
          {sorted.map(session => {
            const isActive = session.id === activeSessionId
            const isLive = session.status === 'active'
            const date = new Date(session.started_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })

            return (
              <button
                key={session.id}
                data-session-id={session.id}
                onClick={() => onSessionClick(session)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                    : isLive
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                title={`Session ${session.session_number} — ${date}`}
              >
                {isLive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <span>#{session.session_number}</span>
                <span className="text-[10px] opacity-70">{date}</span>
              </button>
            )
          })}

          {sorted.length === 0 && (
            <span className="text-xs text-gray-400 px-2">No sessions yet</span>
          )}
        </div>

        {/* Session controls — only coach (board creator) can start/end sessions */}
        {isCoach && (
          <>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            {hasActiveSession ? (
              <button
                onClick={onEndSession}
                className="flex-shrink-0 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-all"
              >
                End Session
              </button>
            ) : (
              <button
                onClick={onStartSession}
                className="flex-shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all"
              >
                Start Session
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
