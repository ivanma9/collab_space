/**
 * BoardStage - Main canvas component using Konva
 *
 * Features:
 * - Infinite canvas with pan and zoom
 * - Mouse/touch drag support
 * - Wheel zoom support
 * - Cursor position tracking
 */

import { useRef, useState, useCallback } from 'react'
import { Stage, Layer } from 'react-konva'
import type Konva from 'konva'

interface BoardStageProps {
  children?: React.ReactNode
  onCursorMove?: (x: number, y: number) => void
  width?: number
  height?: number
}

const INITIAL_SCALE = 1
const MIN_SCALE = 0.1
const MAX_SCALE = 5
const ZOOM_SPEED = 0.1

export function BoardStage({
  children,
  onCursorMove,
  width = window.innerWidth,
  height = window.innerHeight,
}: BoardStageProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(INITIAL_SCALE)

  /**
   * Handle mouse move to track cursor position
   */
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!onCursorMove || !stageRef.current) return

      const stage = stageRef.current
      const pointerPosition = stage.getPointerPosition()

      if (pointerPosition) {
        // Convert screen coordinates to canvas coordinates
        const transform = stage.getAbsoluteTransform().copy().invert()
        const canvasPos = transform.point(pointerPosition)

        onCursorMove(canvasPos.x, canvasPos.y)
      }
    },
    [onCursorMove]
  )

  /**
   * Handle wheel zoom
   */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()

      const stage = stageRef.current
      if (!stage) return

      const oldScale = stage.scaleX()
      const pointer = stage.getPointerPosition()

      if (!pointer) return

      // Calculate new scale
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const newScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, oldScale + direction * ZOOM_SPEED)
      )

      // Calculate new position to zoom toward pointer
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      }

      setStageScale(newScale)
      setStagePos(newPos)
    },
    []
  )

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      draggable={false}
      x={stagePos.x}
      y={stagePos.y}
      scaleX={stageScale}
      scaleY={stageScale}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      style={{ cursor: 'default' }}
    >
      <Layer>{children}</Layer>
    </Stage>
  )
}
