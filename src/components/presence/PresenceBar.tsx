import type { OnlineUser } from '../../hooks/usePresence'

interface PresenceBarProps {
  onlineUsers: OnlineUser[]
  currentUserId: string
}

export function PresenceBar({ onlineUsers, currentUserId }: PresenceBarProps) {
  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-lg px-3 py-2">
      <span className="text-xs text-gray-500 font-medium">{onlineUsers.length} online</span>
      <div className="flex -space-x-2">
        {onlineUsers.map((u) => (
          <div
            key={u.userId}
            title={u.userName}
            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white ${
              u.userId === currentUserId ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{ backgroundColor: stringToColor(u.userId) }}
          >
            {u.avatarUrl ? (
              <img src={u.avatarUrl} alt={u.userName} className="w-full h-full rounded-full object-cover" />
            ) : (
              u.userName.charAt(0).toUpperCase()
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function stringToColor(str: string): string {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]!
}
