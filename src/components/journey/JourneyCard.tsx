import type { Board, BoardSession } from '../../lib/database.types'

interface JourneyCardProps {
  board: Board
  sessions: BoardSession[]
  onClick: () => void
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  completed: '#6B7280',
}

export function JourneyCard({ board, sessions, onClick }: JourneyCardProps) {
  const lastSession = sessions.length > 0
    ? sessions.reduce((a, b) => (a.session_number > b.session_number ? a : b))
    : null
  const activeSession = sessions.find(s => s.status === 'active')
  const completedCount = sessions.filter(s => s.status === 'completed').length

  const lastDate = lastSession
    ? new Date(lastSession.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-xl shadow hover:shadow-lg transition-all duration-200 overflow-hidden text-left w-full border border-gray-100 hover:border-amber-200"
    >
      {/* Header bar with warm gradient */}
      <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      <div className="px-5 py-4 space-y-3">
        {/* Title + client */}
        <div>
          <p className="font-semibold text-gray-800 group-hover:text-amber-700 transition-colors truncate text-base">
            {board.name}
          </p>
          {board.client_name && (
            <p className="text-sm text-gray-500 mt-0.5">
              with {board.client_name}
            </p>
          )}
        </div>

        {/* Session timeline dots */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-1.5">
            {sessions
              .sort((a, b) => a.session_number - b.session_number)
              .slice(-8)
              .map(session => (
                <div
                  key={session.id}
                  className="w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-110"
                  style={{ backgroundColor: STATUS_COLORS[session.status] ?? '#6B7280' }}
                  title={`Session ${session.session_number} — ${session.status}`}
                />
              ))}
            {sessions.length > 8 && (
              <span className="text-xs text-gray-400 ml-1">+{sessions.length - 8}</span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
            {completedCount > 0 && (
              <span>{completedCount} completed</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeSession && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                In session
              </span>
            )}
            {lastDate && !activeSession && (
              <span>Last: {lastDate}</span>
            )}
          </div>
        </div>

        {/* Share board link for client */}
        <div
          className="text-xs text-amber-600 hover:text-amber-500 cursor-pointer pt-1"
          onClick={(e) => {
            e.stopPropagation()
            const url = `${window.location.origin}/board/${board.id}`
            navigator.clipboard.writeText(url)
            const el = e.currentTarget
            el.textContent = 'Link copied!'
            setTimeout(() => { el.textContent = 'Share board link' }, 2000)
          }}
        >
          Share board link
        </div>
      </div>
    </button>
  )
}
