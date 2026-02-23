import { useCallback, useEffect, useRef } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BaseBoardObject, GoalData, GoalStatus } from '../../lib/database.types'

type GoalObject = BaseBoardObject & { type: 'goal'; data: GoalData }

interface GoalCardProps {
  object: GoalObject
  isSelected: boolean
  onUpdate: (id: string, updates: Partial<GoalObject>) => void
  onSelect: (id: string, multiSelect?: boolean) => void
  onMount: (id: string, node: Konva.Group) => void
  onUnmount: (id: string) => void
}

const STATUS_CONFIG: Record<GoalStatus, { bg: string; badge: string; badgeText: string; border: string }> = {
  active: { bg: '#FFFBEB', badge: '#F59E0B', badgeText: 'Active', border: '#FCD34D' },
  completed: { bg: '#F0FDF4', badge: '#10B981', badgeText: 'Done', border: '#86EFAC' },
  stalled: { bg: '#FFF7ED', badge: '#F97316', badgeText: 'Stalled', border: '#FDBA74' },
}

const PADDING = 12
const BADGE_W = 52
const BADGE_H = 18
const CHECKBOX_SIZE = 12
const LINE_HEIGHT = 18

export function GoalCard({ object, isSelected, onUpdate, onSelect, onMount, onUnmount }: GoalCardProps) {
  const groupRef = useRef<Konva.Group>(null)
  const { data } = object
  const config = STATUS_CONFIG[data.status]
  const completedCount = data.commitments.filter(c => c.startsWith('[x] ')).length

  useEffect(() => {
    if (groupRef.current) onMount(object.id, groupRef.current)
    return () => onUnmount(object.id)
  }, [object.id, onMount, onUnmount])

  const handleClick = useCallback(() => {
    onSelect(object.id)
  }, [object.id, onSelect])

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    onUpdate(object.id, { x: e.target.x(), y: e.target.y() })
  }, [object.id, onUpdate])

  // Calculate content height dynamically
  const titleHeight = 20
  const commitmentsHeight = data.commitments.length * LINE_HEIGHT
  const dueDateHeight = data.due_date ? 20 : 0
  const contentHeight = PADDING + titleHeight + 8 + BADGE_H + 8 + commitmentsHeight + dueDateHeight + PADDING
  const cardHeight = Math.max(object.height, contentHeight)

  return (
    <Group
      ref={groupRef}
      x={object.x}
      y={object.y}
      width={object.width}
      height={cardHeight}
      draggable
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
    >
      {/* Card background */}
      <Rect
        width={object.width}
        height={cardHeight}
        fill={config.bg}
        stroke={isSelected ? '#3B82F6' : config.border}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={8}
        shadowColor="rgba(0,0,0,0.08)"
        shadowBlur={6}
        shadowOffsetY={2}
      />

      {/* Left accent bar */}
      <Rect
        x={0}
        y={8}
        width={4}
        height={cardHeight - 16}
        fill={config.badge}
        cornerRadius={2}
      />

      {/* Title */}
      <Text
        x={PADDING + 4}
        y={PADDING}
        text={data.title}
        fontSize={14}
        fontFamily="system-ui, sans-serif"
        fontStyle="bold"
        fill="#1F2937"
        width={object.width - PADDING * 2 - 4}
        ellipsis
        wrap="none"
      />

      {/* Status badge */}
      <Rect
        x={PADDING + 4}
        y={PADDING + titleHeight + 4}
        width={BADGE_W}
        height={BADGE_H}
        fill={config.badge}
        cornerRadius={9}
      />
      <Text
        x={PADDING + 4 + 8}
        y={PADDING + titleHeight + 7}
        text={config.badgeText}
        fontSize={10}
        fontFamily="system-ui, sans-serif"
        fontStyle="bold"
        fill="white"
      />

      {/* Commitment count */}
      {data.commitments.length > 0 && (
        <Text
          x={PADDING + 4 + BADGE_W + 8}
          y={PADDING + titleHeight + 7}
          text={`${completedCount}/${data.commitments.length}`}
          fontSize={10}
          fontFamily="system-ui, sans-serif"
          fill="#9CA3AF"
        />
      )}

      {/* Commitments list */}
      {data.commitments.map((commitment, i) => {
        const isChecked = commitment.startsWith('[x] ')
        const text = commitment.replace(/^\[x?\] /, '')
        const yPos = PADDING + titleHeight + 8 + BADGE_H + 8 + i * LINE_HEIGHT

        return (
          <Group key={i}>
            {/* Checkbox */}
            <Rect
              x={PADDING + 4}
              y={yPos + 2}
              width={CHECKBOX_SIZE}
              height={CHECKBOX_SIZE}
              fill={isChecked ? '#10B981' : 'white'}
              stroke={isChecked ? '#10B981' : '#D1D5DB'}
              strokeWidth={1}
              cornerRadius={2}
            />
            {isChecked && (
              <Text
                x={PADDING + 6}
                y={yPos + 1}
                text="✓"
                fontSize={10}
                fill="white"
                fontStyle="bold"
              />
            )}
            {/* Label */}
            <Text
              x={PADDING + 4 + CHECKBOX_SIZE + 6}
              y={yPos + 1}
              text={text}
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fill={isChecked ? '#9CA3AF' : '#374151'}
              textDecoration={isChecked ? 'line-through' : undefined}
              width={object.width - PADDING * 2 - CHECKBOX_SIZE - 14}
              ellipsis
              wrap="none"
            />
          </Group>
        )
      })}

      {/* Due date */}
      {data.due_date && (
        <Text
          x={PADDING + 4}
          y={cardHeight - PADDING - 12}
          text={`Due: ${new Date(data.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          fontSize={10}
          fontFamily="system-ui, sans-serif"
          fill="#9CA3AF"
        />
      )}
    </Group>
  )
}
