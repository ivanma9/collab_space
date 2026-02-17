import { useEffect, useRef } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject, FrameData } from '../../lib/database.types'

interface FrameProps {
  object: BoardObject & { type: 'frame'; data: FrameData }
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  onSelect?: (id: string, multiSelect?: boolean) => void
  isSelected?: boolean
  onMount?: (id: string, node: Konva.Group) => void
  onUnmount?: (id: string) => void
}

export function Frame({ object, onUpdate, onSelect, isSelected, onMount, onUnmount }: FrameProps) {
  const groupRef = useRef<Konva.Group>(null)
  const lastDrag = useRef(0)

  const onMountRef = useRef(onMount)
  const onUnmountRef = useRef(onUnmount)
  onMountRef.current = onMount
  onUnmountRef.current = onUnmount

  useEffect(() => {
    if (groupRef.current) onMountRef.current?.(object.id, groupRef.current)
    return () => onUnmountRef.current?.(object.id)
  }, [object.id])

  const TITLE_HEIGHT = 32

  return (
    <Group
      ref={groupRef}
      id={object.id}
      x={object.x}
      y={object.y}
      draggable
      onDragMove={() => {
        const now = Date.now()
        if (now - lastDrag.current < 50) return
        lastDrag.current = now
        if (groupRef.current) onUpdate(object.id, { x: groupRef.current.x(), y: groupRef.current.y() })
      }}
      onDragEnd={() => {
        if (groupRef.current) onUpdate(object.id, { x: groupRef.current.x(), y: groupRef.current.y() })
      }}
      onClick={(e) => onSelect?.(object.id, e.evt.metaKey || e.evt.ctrlKey)}
    >
      {/* Frame background */}
      <Rect
        width={object.width}
        height={object.height}
        fill={object.data.backgroundColor ?? 'rgba(240, 240, 240, 0.5)'}
        stroke={isSelected ? '#4A90E2' : '#CCCCCC'}
        strokeWidth={isSelected ? 2 : 1.5}
        dash={isSelected ? undefined : [8, 4]}
        cornerRadius={8}
      />
      {/* Title bar */}
      <Rect
        width={object.width}
        height={TITLE_HEIGHT}
        fill={isSelected ? '#4A90E2' : '#E8E8E8'}
        cornerRadius={[8, 8, 0, 0]}
      />
      {/* Title text */}
      <Text
        text={object.data.title}
        x={12}
        y={8}
        fontSize={14}
        fontStyle="bold"
        fill={isSelected ? '#FFFFFF' : '#444444'}
        width={object.width - 24}
        ellipsis
      />
    </Group>
  )
}
