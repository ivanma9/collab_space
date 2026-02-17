/**
 * BoardStage - Main canvas component using Konva
 *
 * Features:
 * - Infinite canvas with pan and zoom
 * - Mouse/touch drag support
 * - Wheel zoom support
 * - Cursor position tracking
 * - Drag-to-select (marquee selection)
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'

interface BoardStageProps {
  children?: React.ReactNode
  onCursorMove?: (x: number, y: number) => void
  onStageClick?: () => void
  onStageTransformChange?: (pos: { x: number; y: number; scale: number }) => void
  onMarqueeSelect?: (rect: { x: number; y: number; width: number; height: number }) => void
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
  onStageClick,
  onStageTransformChange,
  onMarqueeSelect,
  width = window.innerWidth,
  height = window.innerHeight,
}: BoardStageProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(INITIAL_SCALE)

  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const marqueeStart = useRef<{ x: number; y: number } | null>(null)
  const isDraggingMarquee = useRef(false)

  useEffect(() => {
    onStageTransformChange?.({ x: stagePos.x, y: stagePos.y, scale: stageScale })
  }, [stagePos, stageScale, onStageTransformChange])

  /**
   * Handle mouse down to start marquee selection
   */
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only on left click directly on stage background (not on objects)
    if (e.target !== e.currentTarget) return
    if (e.evt.button !== 0) return
    const stage = stageRef.current
    if (!stage) return
    const transform = stage.getAbsoluteTransform().copy().invert()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const canvasPos = transform.point(pointer)
    marqueeStart.current = canvasPos
    isDraggingMarquee.current = false
  }, [])

  /**
   * Handle mouse move to track cursor position and draw marquee
   */
  const handleMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const transform = stage.getAbsoluteTransform().copy().invert()
      const canvasPos = transform.point(pointer)

      // Cursor broadcast
      onCursorMove?.(canvasPos.x, canvasPos.y)

      // Marquee drawing
      if (marqueeStart.current) {
        isDraggingMarquee.current = true
        const x = Math.min(marqueeStart.current.x, canvasPos.x)
        const y = Math.min(marqueeStart.current.y, canvasPos.y)
        const width = Math.abs(canvasPos.x - marqueeStart.current.x)
        const height = Math.abs(canvasPos.y - marqueeStart.current.y)
        setMarquee({ x, y, width, height })
      }
    },
    [onCursorMove]
  )

  /**
   * Handle mouse up to finish marquee selection
   */
  const handleMouseUp = useCallback(() => {
    if (marquee && isDraggingMarquee.current && onMarqueeSelect) {
      onMarqueeSelect(marquee)
    }
    setMarquee(null)
    marqueeStart.current = null
    isDraggingMarquee.current = false
  }, [marquee, onMarqueeSelect])

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

  /**
   * Handle stage click to clear selection
   */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // When a marquee drag just finished, don't fire the click (clear selection)
      if (isDraggingMarquee.current) return
      // Only trigger if clicking the stage itself (not a child)
      if (e.target === e.currentTarget) {
        onStageClick?.()
      }
    },
    [onStageClick]
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleStageClick}
      style={{ cursor: 'default' }}
    >
      <Layer>
        {children}
        {marquee && (
          <Rect
            x={marquee.x}
            y={marquee.y}
            width={marquee.width}
            height={marquee.height}
            fill="rgba(74, 144, 226, 0.1)"
            stroke="#4A90E2"
            strokeWidth={1 / stageScale}
            dash={[4 / stageScale, 4 / stageScale]}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  )
}
