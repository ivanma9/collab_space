/**
 * Shared user color utility
 * Used by both RemoteCursor (via useCursors) and PresenceBar
 * so that cursor colors always match avatar colors.
 */

const USER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
]

export function getUserColor(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc)
  }, 0)
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]!
}
