import { useEffect, useRef } from 'react'
import { Group, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject, TextData } from '../../lib/database.types'

interface TextElementProps {
  object: BoardObject & { type: 'text'; data: TextData }
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  onSelect?: (id: string, multiSelect?: boolean) => void
  isSelected?: boolean
  isEditing?: boolean
  onStartEdit?: (id: string) => void
  onMount?: (id: string, node: Konva.Group) => void
  onUnmount?: (id: string) => void
}

export function TextElement({ object, onUpdate, onSelect, isSelected, isEditing, onStartEdit, onMount, onUnmount }: TextElementProps) {
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
      onDblClick={() => { onSelect?.(object.id); onStartEdit?.(object.id) }}
    >
      <Text
        text={isEditing ? '' : (object.data.text || 'Double-click to edit')}
        fontSize={object.data.fontSize || 16}
        fill={object.data.color || '#000000'}
        fontFamily={object.data.fontFamily || 'Arial, sans-serif'}
        stroke={isSelected ? '#4A90E2' : undefined}
        strokeWidth={isSelected ? 0.5 : 0}
        width={object.width}
        wrap="word"
      />
    </Group>
  )
}
