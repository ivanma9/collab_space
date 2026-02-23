import { Group, Rect, Text } from 'react-konva'
import type { BoardSession } from '../../lib/database.types'

interface SessionZoneProps {
  session: BoardSession
  x: number
  y: number
  width: number
  height: number
  isActive: boolean
}

const HEADER_HEIGHT = 36
const BORDER_RADIUS = 8

export function SessionZone({ session, x, y, width, height, isActive }: SessionZoneProps) {
  const date = new Date(session.started_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const label = `Session #${session.session_number} — ${date}`
  const borderColor = isActive ? '#F59E0B' : '#D1D5DB'
  const headerBg = isActive ? '#FEF3C7' : '#F3F4F6'
  const textColor = isActive ? '#92400E' : '#6B7280'

  return (
    <Group x={x} y={y} listening={false}>
      {/* Background */}
      <Rect
        width={width}
        height={height}
        fill="rgba(255, 255, 255, 0.02)"
        stroke={borderColor}
        strokeWidth={isActive ? 2 : 1}
        cornerRadius={BORDER_RADIUS}
        dash={isActive ? undefined : [8, 4]}
      />

      {/* Header bar */}
      <Rect
        width={width}
        height={HEADER_HEIGHT}
        fill={headerBg}
        cornerRadius={[BORDER_RADIUS, BORDER_RADIUS, 0, 0]}
      />

      {/* Session label */}
      <Text
        x={12}
        y={10}
        text={label}
        fontSize={13}
        fontFamily="system-ui, sans-serif"
        fontStyle="bold"
        fill={textColor}
      />

      {/* Live indicator */}
      {isActive && session.status === 'active' && (
        <>
          <Rect
            x={width - 70}
            y={10}
            width={56}
            height={18}
            fill="#10B981"
            cornerRadius={9}
          />
          <Text
            x={width - 62}
            y={13}
            text="LIVE"
            fontSize={10}
            fontFamily="system-ui, sans-serif"
            fontStyle="bold"
            fill="white"
          />
        </>
      )}
    </Group>
  )
}
