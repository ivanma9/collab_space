/**
 * RemoteCursor - Renders a remote user's cursor on the canvas
 *
 * Shows a colored cursor with the user's name label
 */

import { Group, Circle, Label, Tag, Text } from 'react-konva'
import type { CursorPosition } from '../../lib/database.types'

interface RemoteCursorProps {
  cursor: CursorPosition
}

export function RemoteCursor({ cursor }: RemoteCursorProps) {
  return (
    <Group x={cursor.x} y={cursor.y} data-testid={`remote-cursor-${cursor.userName}`}>
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

      {/* User name label — colored pill with white text for maximum contrast */}
      <Label x={12} y={12}>
        <Tag
          fill={cursor.color}
          cornerRadius={4}
          shadowColor="black"
          shadowBlur={4}
          shadowOpacity={0.35}
        />
        <Text
          text={cursor.userName}
          fontSize={12}
          fontFamily="sans-serif"
          fontStyle="bold"
          fill="#ffffff"
          padding={4}
        />
      </Label>
    </Group>
  )
}
