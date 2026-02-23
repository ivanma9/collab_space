/**
 * GridDots - Dot grid background for the canvas
 *
 * Uses a single Konva Shape with a custom sceneFunc to draw all dots in one
 * pass, which is far more performant than individual Circle nodes.
 */

import { memo } from 'react'
import { Shape } from 'react-konva'
import type Konva from 'konva'

interface GridDotsProps {
  width: number
  height: number
  stageX: number
  stageY: number
  scale: number
}

const GRID_SPACING = 50
const DOT_COLOR = '#d0d0d0'

export const GridDots = memo(function GridDots({ width, height, stageX, stageY, scale }: GridDotsProps) {
  const sceneFunc = (ctx: Konva.Context, shape: Konva.Shape) => {
    // Compute visible world-coordinate bounds
    const visibleX = -stageX / scale
    const visibleY = -stageY / scale
    const visibleWidth = width / scale
    const visibleHeight = height / scale

    // Dot radius is constant in screen pixels
    const dotRadius = 1.5 / scale

    // Find the first grid line in each axis that is within (or just before) the visible area
    const startX = Math.floor(visibleX / GRID_SPACING) * GRID_SPACING
    const startY = Math.floor(visibleY / GRID_SPACING) * GRID_SPACING
    const endX = visibleX + visibleWidth + GRID_SPACING
    const endY = visibleY + visibleHeight + GRID_SPACING

    ctx.beginPath()
    ctx.fillStyle = DOT_COLOR

    for (let x = startX; x < endX; x += GRID_SPACING) {
      for (let y = startY; y < endY; y += GRID_SPACING) {
        ctx.moveTo(x + dotRadius, y)
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
      }
    }

    ctx.fillShape(shape)
  }

  return (
    <Shape
      sceneFunc={sceneFunc}
      fill={DOT_COLOR}
      listening={false}
      perfectDrawEnabled={false}
    />
  )
})
