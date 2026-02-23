import { memo } from 'react'
import { Arrow, Line } from 'react-konva'
import type { BoardObject, ConnectorData } from '../../lib/database.types'

interface ConnectorProps {
  object: BoardObject & { type: 'connector'; data: ConnectorData }
  objectMap: Map<string, BoardObject>
  isSelected?: boolean
  onSelect?: (id: string, multiSelect?: boolean) => void
}

function getCenterPoint(obj: BoardObject) {
  return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 }
}

export const Connector = memo(function Connector({ object, objectMap, isSelected, onSelect }: ConnectorProps) {
  const from = objectMap.get(object.data.fromId)
  const to = objectMap.get(object.data.toId)

  if (!from || !to) return null

  const start = getCenterPoint(from)
  const end = getCenterPoint(to)
  const strokeColor = isSelected ? '#4A90E2' : '#555555'
  const strokeWidth = isSelected ? 3 : 2

  const handleClick = (e: { evt: MouseEvent }) => {
    onSelect?.(object.id, e.evt.metaKey || e.evt.ctrlKey)
  }

  if (object.data.style === 'line') {
    return (
      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        onClick={handleClick}
        hitStrokeWidth={10}
        data-testid={`connector-${object.id}`}
      />
    )
  }

  return (
    <Arrow
      points={[start.x, start.y, end.x, end.y]}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      fill={strokeColor}
      pointerLength={12}
      pointerWidth={10}
      dash={object.data.style === 'dashed' ? [8, 4] : undefined}
      onClick={handleClick}
      hitStrokeWidth={10}
      data-testid={`connector-${object.id}`}
    />
  )
})
