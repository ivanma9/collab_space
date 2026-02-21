import { useEffect, useRef } from 'react'
import type { BoardObject } from '../lib/database.types'

interface BoardCardProps {
  id: string
  name: string
  inviteCode: string
  objects: BoardObject[]
  onClick: () => void
}

const PREVIEW_W = 280
const PREVIEW_H = 160

function drawPreview(ctx: CanvasRenderingContext2D, objects: BoardObject[]) {
  ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H)

  // Background
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)

  if (objects.length === 0) {
    // Dot grid placeholder
    ctx.fillStyle = '#d1d5db'
    for (let x = 12; x < PREVIEW_W; x += 20) {
      for (let y = 12; y < PREVIEW_H; y += 20) {
        ctx.beginPath()
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const obj of objects) {
    minX = Math.min(minX, obj.x)
    minY = Math.min(minY, obj.y)
    maxX = Math.max(maxX, obj.x + (obj.width || 0))
    maxY = Math.max(maxY, obj.y + (obj.height || 0))
  }

  const pad = 16
  const bboxW = maxX - minX || 1
  const bboxH = maxY - minY || 1
  const scale = Math.min((PREVIEW_W - pad * 2) / bboxW, (PREVIEW_H - pad * 2) / bboxH, 1)
  const offsetX = pad + ((PREVIEW_W - pad * 2) - bboxW * scale) / 2
  const offsetY = pad + ((PREVIEW_H - pad * 2) - bboxH * scale) / 2

  const tx = (worldX: number) => offsetX + (worldX - minX) * scale
  const ty = (worldY: number) => offsetY + (worldY - minY) * scale

  // Sort by z_index
  const sorted = [...objects].sort((a, b) => a.z_index - b.z_index)

  for (const obj of sorted) {
    if (obj.width <= 0 || obj.height <= 0) continue
    const x = tx(obj.x)
    const y = ty(obj.y)
    const w = obj.width * scale
    const h = obj.height * scale

    ctx.save()

    if (obj.type === 'sticky_note') {
      const d = obj.data
      ctx.fillStyle = d.color
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      roundRect(ctx, x, y, w, h, 2)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.font = `${Math.max(7, 9 * scale)}px Arial`
      ctx.fillText(d.text, x + 3, y + 10 * scale, w - 6)

    } else if (obj.type === 'rectangle') {
      const d = obj.data
      ctx.fillStyle = d.fillColor
      ctx.strokeStyle = d.strokeColor
      ctx.lineWidth = Math.max(0.5, d.strokeWidth * scale)
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)

    } else if (obj.type === 'circle') {
      const d = obj.data
      ctx.fillStyle = d.fillColor
      ctx.strokeStyle = d.strokeColor
      ctx.lineWidth = Math.max(0.5, d.strokeWidth * scale)
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

    } else if (obj.type === 'line') {
      const d = obj.data
      const pts = d.points
      if (pts.length >= 4) {
        ctx.strokeStyle = d.strokeColor
        ctx.lineWidth = Math.max(0.5, d.strokeWidth * scale)
        ctx.beginPath()
        ctx.moveTo(tx(obj.x + pts[0]!), ty(obj.y + pts[1]!))
        for (let i = 2; i + 1 < pts.length; i += 2) {
          ctx.lineTo(tx(obj.x + pts[i]!), ty(obj.y + pts[i + 1]!))
        }
        ctx.stroke()
      }

    } else if (obj.type === 'frame') {
      const d = obj.data
      ctx.fillStyle = d.backgroundColor ?? '#ffffff'
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
      if (d.title) {
        ctx.fillStyle = '#475569'
        ctx.font = `bold ${Math.max(6, 8 * scale)}px Arial`
        ctx.fillText(d.title, x + 3, y + 10, w)
      }

    } else if (obj.type === 'text') {
      const d = obj.data
      ctx.fillStyle = d.color
      ctx.font = `${Math.max(7, (d.fontSize ?? 14) * scale)}px ${d.fontFamily ?? 'Arial'}`
      ctx.fillText(d.text, x, y + 12 * scale, w)
    }

    ctx.restore()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export function BoardCard({ id: _id, name, inviteCode, objects, onClick }: BoardCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawPreview(ctx, objects)
  }, [objects])

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-xl shadow hover:shadow-lg transition-shadow overflow-hidden text-left w-full"
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="w-full block"
        style={{ aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}` }}
      />
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors truncate">
          {name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{inviteCode}</p>
      </div>
    </button>
  )
}
