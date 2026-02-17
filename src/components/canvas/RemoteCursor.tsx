/**
 * RemoteCursor - Renders a remote user's cursor on the canvas
 *
 * Shows a colored cursor with the user's name label
 */

import { Group, Circle, Text } from 'react-konva'
import type { CursorPosition } from '../../lib/database.types'

interface RemoteCursorProps {
  cursor: CursorPosition
}

export function RemoteCursor({ cursor }: RemoteCursorProps) {
  return (
    <Group x={cursor.x} y={cursor.y}>
      {/* Cursor circle */}
      <Circle
        radius={8}
        fill={cursor.color}
        stroke="#ffffff"
        strokeWidth={2}
        shadowColor="black"
        shadowBlur={4}
        shadowOpacity={0.3}
      />

      {/* User name label */}
      <Group x={12} y={12}>
        {/* Label background */}
        <Text
          text={cursor.userName}
          fontSize={12}
          fontFamily="sans-serif"
          fill="#ffffff"
          padding={4}
          cornerRadius={4}
          shadowColor="black"
          shadowBlur={2}
          shadowOpacity={0.5}
        />
        {/* Label with color */}
        <Text
          text={cursor.userName}
          fontSize={12}
          fontFamily="sans-serif"
          fill={cursor.color}
          padding={4}
          stroke="#ffffff"
          strokeWidth={0.5}
        />
      </Group>
    </Group>
  )
}
