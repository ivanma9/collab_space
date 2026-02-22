import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BoardObject } from '../lib/database.types'

const PADDING = 40

export function findOpenArea(objects: BoardObject[]): { x: number; y: number; width: number; height: number } {
  if (objects.length === 0) {
    return { x: 100, y: 100, width: 2000, height: 2000 }
  }

  // Ignore connectors (they have 0,0 position and no real footprint)
  const placed = objects.filter((o) => o.type !== 'connector')
  if (placed.length === 0) {
    return { x: 100, y: 100, width: 2000, height: 2000 }
  }

  // Compute bounding box of all existing objects
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const obj of placed) {
    minX = Math.min(minX, obj.x)
    minY = Math.min(minY, obj.y)
    maxX = Math.max(maxX, obj.x + obj.width)
    maxY = Math.max(maxY, obj.y + obj.height)
  }

  // Try placing to the right of existing content first
  const rightX = maxX + PADDING
  const rightArea = { x: rightX, y: minY, width: 2000, height: maxY - minY + 1000 }

  // Check if right area has enough room (it always does on infinite canvas, but check for gaps)
  // Also offer below as an alternative
  const belowY = maxY + PADDING
  const belowArea = { x: minX, y: belowY, width: maxX - minX + 1000, height: 2000 }

  // Prefer right if the board is more tall than wide, below if more wide than tall
  const boardWidth = maxX - minX
  const boardHeight = maxY - minY

  return boardHeight > boardWidth ? belowArea : rightArea
}

export const STICKY_COLORS: Record<string, string> = {
  yellow: '#FFD700',
  pink: '#FF6B6B',
  blue: '#4ECDC4',
  green: '#95E1D3',
  orange: '#FFA07A',
  purple: '#9B59B6',
}

export const SHAPE_COLORS: Record<string, string> = {
  red: '#FF6B6B',
  blue: '#4ECDC4',
  green: '#95E1D3',
  yellow: '#FFD700',
  orange: '#FFA07A',
  purple: '#9B59B6',
  gray: '#636E72',
  white: '#FFFFFF',
}

export interface UseAIAgentOptions {
  boardId: string
  objects: BoardObject[]
  createObject: (obj: Omit<BoardObject, 'id' | 'created_at' | 'updated_at' | 'created_by'> & { id?: string }) => Promise<void>
  updateObject: (id: string, updates: Partial<BoardObject>) => Promise<void>
}

export function useAIAgent({ boardId, objects, createObject, updateObject }: UseAIAgentOptions) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function executeCommand(command: string) {
    setIsProcessing(true)
    setError(null)
    setLastResult(null)

    const boardState = objects.map((obj) => ({
      id: obj.id,
      type: obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      data: obj.data,
    }))

    try {
      const openArea = findOpenArea(objects)
      const { data, error: fnError } = await supabase.functions.invoke('ai-agent', {
        body: { command, boardState, boardId, openArea },
      })
      if (fnError) throw fnError

      if (!data.toolCalls?.length) {
        setError("The AI couldn't determine the correct action. Please try rephrasing your request.")
        setIsProcessing(false)
        return
      }

      let zOffset = 0
      let totalCreated = 0
      for (const call of data.toolCalls) {
        try {
          await executeToolCall(call, objects.length + zOffset)
          if (call.name === 'bulkCreateObjects') {
            const bulkCount = call.input?.count ?? 0
            totalCreated += bulkCount
            zOffset += bulkCount
          } else {
            totalCreated++
            zOffset++
          }
        } catch (err) {
          console.error(`Tool call "${call.name}" failed, skipping:`, err)
        }
      }
      setLastResult(`Done — created ${totalCreated} object(s)`)
    } catch (err) {
      setError('AI command failed. Try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function executeToolCall(call: { name: string; input: any }, zIndex: number) {
    const { input } = call

    const mergeData = (objectId: string, patch: Record<string, any>) => {
      const existing = objects.find((o) => o.id === objectId)
      return updateObject(objectId, { data: { ...(existing?.data as any), ...patch } })
    }

    switch (call.name) {
      case 'createStickyNote':
        return createObject({
          id: input.id,
          board_id: boardId,
          type: 'sticky_note',
          x: input.x, y: input.y, width: 200, height: 200,
          rotation: 0, z_index: zIndex,
          data: { text: input.text, color: STICKY_COLORS[input.color] ?? input.color },
        })
      case 'createShape': {
        const color = SHAPE_COLORS[input.color] ?? input.color
        const shapeType = input.shapeType as 'rectangle' | 'circle' | 'line'
        const shapeData =
          shapeType === 'circle'
            ? { radius: Math.min(input.width, input.height) / 2, fillColor: color, strokeColor: '#2D3436', strokeWidth: 2 }
            : shapeType === 'line'
            ? { points: [0, 0, input.width, input.height], strokeColor: color, strokeWidth: 4 }
            : { fillColor: color, strokeColor: '#2D3436', strokeWidth: 2 }
        return createObject({
          id: input.id,
          board_id: boardId,
          type: shapeType,
          x: input.x, y: input.y, width: input.width, height: input.height,
          rotation: 0, z_index: zIndex,
          data: shapeData,
        })
      }
      case 'createFrame':
        return createObject({
          id: input.id,
          board_id: boardId,
          type: 'frame',
          x: input.x, y: input.y, width: input.width, height: input.height,
          rotation: 0, z_index: -(objects.filter((o) => o.type === 'frame').length + 1),
          data: { title: input.title, backgroundColor: 'rgba(240,240,240,0.5)' },
        })
      case 'createTextBox':
        return createObject({
          id: input.id,
          board_id: boardId,
          type: 'text',
          x: input.x, y: input.y, width: 200, height: 50,
          rotation: 0, z_index: zIndex,
          data: { text: input.text, fontSize: input.fontSize ?? 16, color: input.color ?? '#000000' },
        })
      case 'createConnector':
        return createObject({
          id: input.id,
          board_id: boardId,
          type: 'connector',
          x: 0, y: 0, width: 0, height: 0,
          rotation: 0, z_index: zIndex,
          data: { fromId: input.fromId, toId: input.toId, style: input.style },
        })
      case 'moveObject':
        return updateObject(input.objectId, { x: input.x, y: input.y })
      case 'resizeObject':
        return updateObject(input.objectId, { width: input.width, height: input.height })
      case 'updateStickyNoteText':
      case 'updateTextBoxContent':
        return mergeData(input.objectId, { text: input.newText })
      case 'changeColor': {
        const colorHex = SHAPE_COLORS[input.color] ?? STICKY_COLORS[input.color] ?? input.color
        return mergeData(input.objectId, { color: colorHex, fillColor: colorHex })
      }
      case 'getBoardState':
        return
      case 'bulkCreateObjects': {
        const { objectType, count, startX, startY, columns, template } = input
        const w = template.width ?? (objectType === 'sticky_note' ? 200 : objectType === 'frame' ? 800 : objectType === 'text' ? 200 : 150)
        const h = template.height ?? (objectType === 'sticky_note' ? 200 : objectType === 'frame' ? 600 : objectType === 'text' ? 50 : 100)
        const gap = 20
        const chunkSize = 50

        for (let chunk = 0; chunk < count; chunk += chunkSize) {
          const batch: Promise<void>[] = []
          const end = Math.min(chunk + chunkSize, count)
          for (let i = chunk; i < end; i++) {
            const col = i % columns
            const row = Math.floor(i / columns)
            const x = startX + col * (w + gap)
            const y = startY + row * (h + gap)
            const n = i + 1
            const id = crypto.randomUUID()

            const resolveTemplate = (s: string | undefined) => s?.replace(/\{n\}/g, String(n))

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let objData: Record<string, any> = {}
            let type: string = objectType

            switch (objectType) {
              case 'sticky_note':
                objData = {
                  text: resolveTemplate(template.text) ?? `Note ${n}`,
                  color: STICKY_COLORS[template.color] ?? template.color ?? STICKY_COLORS['yellow'],
                }
                break
              case 'shape': {
                const color = SHAPE_COLORS[template.color] ?? template.color ?? SHAPE_COLORS['blue']
                const shapeType = template.shapeType ?? 'rectangle'
                type = shapeType
                objData = shapeType === 'circle'
                  ? { radius: Math.min(w, h) / 2, fillColor: color, strokeColor: '#2D3436', strokeWidth: 2 }
                  : shapeType === 'line'
                  ? { points: [0, 0, w, h], strokeColor: color, strokeWidth: 4 }
                  : { fillColor: color, strokeColor: '#2D3436', strokeWidth: 2 }
                break
              }
              case 'frame':
                objData = {
                  title: resolveTemplate(template.title) ?? `Frame ${n}`,
                  backgroundColor: 'rgba(240,240,240,0.5)',
                }
                break
              case 'text':
                objData = {
                  text: resolveTemplate(template.text) ?? `Text ${n}`,
                  fontSize: template.fontSize ?? 16,
                  color: template.color ?? '#000000',
                }
                break
            }

            const zIdx = objectType === 'frame'
              ? -(objects.filter((o) => o.type === 'frame').length + i + 1)
              : zIndex + i

            batch.push(
              createObject({
                id,
                board_id: boardId,
                type: type as BoardObject['type'],
                x, y, width: w, height: h,
                rotation: 0,
                z_index: zIdx,
                data: objData as BoardObject['data'],
              })
            )
          }
          await Promise.all(batch)
        }
        return
      }
    }
  }

  return { executeCommand, isProcessing, lastResult, error }
}
