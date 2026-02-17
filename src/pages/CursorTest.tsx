/**
 * CursorTest Page (Main Board)
 *
 * Primary board page hosting the collaborative whiteboard canvas.
 * Includes sticky notes, shapes, connectors, frames, text elements,
 * real-time sync, presence, and multi-user cursor tracking.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BoardStage } from '../components/canvas/BoardStage'
import { Connector } from '../components/canvas/Connector'
import { Frame } from '../components/canvas/Frame'
import { RemoteCursor } from '../components/canvas/RemoteCursor'
import { Shape } from '../components/canvas/Shape'
import { StickyNote } from '../components/canvas/StickyNote'
import { SelectionTransformer } from '../components/canvas/SelectionTransformer'
import { TextEditOverlay } from '../components/canvas/TextEditOverlay'
import { TextElement } from '../components/canvas/TextElement'
import { PresenceBar } from '../components/presence/PresenceBar'
import { useCursors } from '../hooks/useCursors'
import { usePresence } from '../hooks/usePresence'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useSelection } from '../hooks/useSelection'
import { useAIAgent } from '../hooks/useAIAgent'
import type { BoardOperation } from '../hooks/useAIAgent'
import { AICommandInput } from '../components/ai/AICommandInput'
import type { BoardObject, ConnectorData, FrameData, StickyNoteData, RectangleData, CircleData, LineData, TextData } from '../lib/database.types'
import { useAuth } from '../contexts/AuthContext'
import { LoginPage } from './LoginPage'
import type Konva from 'konva'

// Fixed test board ID for all users (must be a valid UUID)
const TEST_BOARD_ID = '00000000-0000-0000-0000-000000000001'

export function CursorTest() {
  const { user, displayName, avatarUrl, signOut, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <CursorTestInner userId={user.id} displayName={displayName} avatarUrl={avatarUrl} signOut={signOut} />
}

function CursorTestInner({ userId, displayName, avatarUrl, signOut }: {
  userId: string
  displayName: string
  avatarUrl: string | null
  signOut: () => Promise<void>
}) {
  const currentUser = { id: userId, name: displayName }
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stageTransform, setStageTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [connectorMode, setConnectorMode] = useState<{ fromId: string } | null>(null)

  const { onlineUsers } = usePresence({
    boardId: TEST_BOARD_ID,
    userId,
    userName: displayName,
    avatarUrl,
  })

  const { cursors, broadcastCursor, isConnected } = useCursors({
    boardId: TEST_BOARD_ID,
    userId: currentUser.id,
    userName: currentUser.name,
  })

  const { objects, createObject, updateObject, deleteObject, isLoading, error } = useRealtimeSync({
    boardId: TEST_BOARD_ID,
    userId: currentUser.id,
  })

  const { isSelected, selectObject, clearSelection, selectedIds, selectMultiple } = useSelection()

  const objectsRef = useRef(objects)
  objectsRef.current = objects

  const nodeRefs = useRef<Map<string, Konva.Group>>(new Map())

  const handleNodeMount = useCallback((id: string, node: Konva.Group) => {
    nodeRefs.current.set(id, node)
  }, [])

  const handleNodeUnmount = useCallback((id: string) => {
    nodeRefs.current.delete(id)
  }, [])

  const selectedNodes = useMemo(() =>
    Array.from(selectedIds)
      .map(id => nodeRefs.current.get(id))
      .filter((n): n is Konva.Group => n != null),
    [selectedIds]
  )

  const handleTransformEnd = useCallback((id: string, updates: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }) => {
    const obj = objectsRef.current.find(o => o.id === id)
    if (!obj) return
    updateObject(id, {
      x: updates.x,
      y: updates.y,
      width: Math.max(20, obj.width * updates.scaleX),
      height: Math.max(20, obj.height * updates.scaleY),
      rotation: updates.rotation,
    })
  }, [updateObject])

  const handleDuplicate = useCallback(() => {
    if (selectedIds.size === 0) return
    const OFFSET = 20
    let zOffset = 0
    selectedIds.forEach(id => {
      const obj = objects.find(o => o.id === id)
      if (!obj) return
      const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...rest } = obj
      createObject({
        ...rest,
        x: obj.x + OFFSET,
        y: obj.y + OFFSET,
        z_index: objects.length + zOffset++,
      })
    })
  }, [selectedIds, objects, createObject])

  // Delete selected objects on Delete/Backspace key; duplicate with Cmd+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        selectedIds.forEach((id) => { deleteObject(id) })
        clearSelection()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        handleDuplicate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, deleteObject, clearSelection, handleDuplicate])

  // Broadcast cursor position whenever it changes
  const handleCursorMove = useCallback((x: number, y: number) => {
    setCursorPos({ x, y })
    broadcastCursor(x, y)
  }, [broadcastCursor])

  // Handle marquee (drag-to-select) selection
  const handleMarqueeSelect = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const selected = objects.filter(obj =>
      obj.x < rect.x + rect.width &&
      obj.x + obj.width > rect.x &&
      obj.y < rect.y + rect.height &&
      obj.y + obj.height > rect.y
    )
    selectMultiple(selected.map(o => o.id))  // always call — empty array clears selection
  }, [objects, selectMultiple])

  // Create a sticky note at current cursor position
  const handleCreateStickyNote = useCallback(async () => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#FFA07A', '#F7DC6F']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]!

    await createObject({
      board_id: TEST_BOARD_ID,
      type: 'sticky_note',
      x: cursorPos.x || 100,
      y: cursorPos.y || 100,
      width: 200,
      height: 150,
      rotation: 0,
      z_index: objects.length,
      data: {
        text: 'New sticky note!\nDouble-click to edit',
        color: randomColor,
      },
    })
  }, [createObject, cursorPos, objects.length])

  // Create a rectangle at current cursor position
  const handleCreateRectangle = useCallback(async () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9']
    const randomFill = colors[Math.floor(Math.random() * colors.length)]!

    await createObject({
      board_id: TEST_BOARD_ID,
      type: 'rectangle',
      x: cursorPos.x || 150,
      y: cursorPos.y || 150,
      width: 200,
      height: 150,
      rotation: 0,
      z_index: objects.length,
      data: {
        fillColor: randomFill,
        strokeColor: '#2D3436',
        strokeWidth: 2,
      },
    })
  }, [createObject, cursorPos, objects.length])

  // Create a circle at current cursor position
  const handleCreateCircle = useCallback(async () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9']
    const randomFill = colors[Math.floor(Math.random() * colors.length)]!

    await createObject({
      board_id: TEST_BOARD_ID,
      type: 'circle',
      x: cursorPos.x || 200,
      y: cursorPos.y || 200,
      width: 200,
      height: 200,
      rotation: 0,
      z_index: objects.length,
      data: {
        radius: 100,
        fillColor: randomFill,
        strokeColor: '#2D3436',
        strokeWidth: 2,
      },
    })
  }, [createObject, cursorPos, objects.length])

  // Create a line at current cursor position
  const handleCreateLine = useCallback(async () => {
    await createObject({
      board_id: TEST_BOARD_ID,
      type: 'line',
      x: cursorPos.x || 100,
      y: cursorPos.y || 100,
      width: 200,
      height: 100,
      rotation: 0,
      z_index: objects.length,
      data: {
        points: [0, 0, 200, 100],
        strokeColor: '#2D3436',
        strokeWidth: 4,
      },
    })
  }, [createObject, cursorPos, objects.length])

  const handleCreateText = useCallback(async () => {
    await createObject({
      board_id: TEST_BOARD_ID,
      type: 'text',
      x: cursorPos.x || 300,
      y: cursorPos.y || 300,
      width: 200,
      height: 40,
      rotation: 0,
      z_index: objectsRef.current.length,
      data: { text: 'New text', fontSize: 18, color: '#000000' } satisfies TextData,
    })
  }, [createObject, cursorPos])

  // Filter sticky notes from all objects
  const stickyNotes = objects.filter(
    (obj): obj is BoardObject & { type: 'sticky_note'; data: StickyNoteData } =>
      obj.type === 'sticky_note'
  )

  const shapes = objects.filter(
    (obj): obj is BoardObject & { type: 'rectangle' | 'circle' | 'line'; data: RectangleData | CircleData | LineData } =>
      obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line'
  )

  const connectors = objects.filter(
    (obj): obj is BoardObject & { type: 'connector'; data: ConnectorData } =>
      obj.type === 'connector'
  )

  const textElements = objects.filter(
    (obj): obj is BoardObject & { type: 'text'; data: TextData } =>
      obj.type === 'text'
  )

  const frames = objects.filter(
    (obj): obj is BoardObject & { type: 'frame'; data: FrameData } =>
      obj.type === 'frame'
  )

  const handleCreateFrame = useCallback(async () => {
    await createObject({
      board_id: TEST_BOARD_ID,
      type: 'frame',
      x: cursorPos.x || 100,
      y: cursorPos.y || 100,
      width: 400,
      height: 300,
      rotation: 0,
      z_index: -(frames.length + 1),  // negative so frames stay behind all regular objects
      data: { title: 'New Frame', backgroundColor: 'rgba(240,240,240,0.5)' } satisfies FrameData,
    })
  }, [createObject, cursorPos, frames.length])

  const handleCreateConnector = useCallback((toId: string) => {
    if (!connectorMode) return
    createObject({
      board_id: TEST_BOARD_ID,
      type: 'connector',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      z_index: objectsRef.current.length,
      data: { fromId: connectorMode.fromId, toId, style: 'arrow' } as ConnectorData,
    })
    setConnectorMode(null)
  }, [connectorMode, createObject])

  const handleAIOperation = useCallback(async (op: BoardOperation) => {
    switch (op.tool) {
      case 'createStickyNote': {
        const p = op.params as { text: string; x: number; y: number; color?: string }
        await createObject({
          board_id: TEST_BOARD_ID, type: 'sticky_note',
          x: p.x, y: p.y, width: 200, height: 150, rotation: 0,
          z_index: objectsRef.current.length,
          data: { text: p.text, color: p.color ?? '#FFD700' },
        })
        break
      }
      case 'createShape': {
        const p = op.params as { type: 'rectangle' | 'circle'; x: number; y: number; width: number; height: number; fillColor?: string }
        await createObject({
          board_id: TEST_BOARD_ID, type: p.type,
          x: p.x, y: p.y, width: p.width, height: p.height, rotation: 0,
          z_index: objectsRef.current.length,
          data: p.type === 'circle'
            ? { radius: Math.min(p.width, p.height) / 2, fillColor: p.fillColor ?? '#4ECDC4', strokeColor: '#2D3436', strokeWidth: 2 }
            : { fillColor: p.fillColor ?? '#4ECDC4', strokeColor: '#2D3436', strokeWidth: 2 },
        })
        break
      }
      case 'createFrame': {
        const p = op.params as { title: string; x: number; y: number; width: number; height: number }
        await createObject({
          board_id: TEST_BOARD_ID, type: 'frame',
          x: p.x, y: p.y, width: p.width, height: p.height, rotation: 0,
          z_index: -(objectsRef.current.filter(o => o.type === 'frame').length + 1),
          data: { title: p.title, backgroundColor: 'rgba(240,240,240,0.5)' },
        })
        break
      }
      case 'createConnector': {
        const p = op.params as { fromId: string; toId: string; style?: string }
        await createObject({
          board_id: TEST_BOARD_ID, type: 'connector',
          x: 0, y: 0, width: 0, height: 0, rotation: 0,
          z_index: objectsRef.current.length,
          data: { fromId: p.fromId, toId: p.toId, style: (p.style ?? 'arrow') as 'arrow' | 'line' | 'dashed' },
        })
        break
      }
      case 'moveObject': {
        const p = op.params as { objectId: string; x: number; y: number }
        updateObject(p.objectId, { x: p.x, y: p.y })
        break
      }
      case 'updateText': {
        const p = op.params as { objectId: string; newText: string }
        const obj = objectsRef.current.find(o => o.id === p.objectId)
        if (!obj) break
        const d = obj.data as unknown as Record<string, unknown>
        updateObject(p.objectId, { data: { ...d, text: p.newText } as any })
        break
      }
    }
  }, [createObject, updateObject])

  const { executeCommand, isProcessing: aiProcessing, lastResult: aiResult, error: aiError } = useAIAgent({
    boardId: TEST_BOARD_ID,
    onOperation: handleAIOperation,
  })

  const handleObjectClick = useCallback((id: string, multiSelect = false) => {
    if (connectorMode) {
      if (id !== connectorMode.fromId) {
        handleCreateConnector(id)
      }
      return
    }
    selectObject(id, multiSelect)
  }, [connectorMode, handleCreateConnector, selectObject])

  // Handle starting edit on a sticky note or text element
  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  // Handle saving edited text
  const handleSaveEdit = useCallback((newText: string) => {
    if (!editingId) return
    const note = stickyNotes.find(n => n.id === editingId)
    if (note) {
      updateObject(editingId, { data: { text: newText, color: note.data.color } as StickyNoteData })
      setEditingId(null)
      return
    }
    const textEl = textElements.find(t => t.id === editingId)
    if (textEl) {
      updateObject(editingId, { data: { ...textEl.data, text: newText } as TextData })
    }
    setEditingId(null)  // always close, even if object was deleted remotely
  }, [editingId, stickyNotes, textElements, updateObject])

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-gray-100"
      style={{ cursor: connectorMode ? 'crosshair' : 'default' }}
    >
      {/* Info Panel */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 space-y-2 max-w-sm">
        <h1 className="text-xl font-bold text-gray-800">
          Cursor Sync Test
        </h1>

        <div className="space-y-1 text-sm">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-700">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="text-gray-600">
            <strong>Your ID:</strong> {currentUser.name} ({currentUser.id.slice(0, 8)}...)
          </div>

          <div className="text-gray-600">
            <strong>Remote Cursors:</strong> {cursors.size}
          </div>

          <div className="text-gray-600">
            <strong>Objects:</strong> {objects.length} (Notes: {stickyNotes.length}, Shapes: {shapes.length}, Connectors: {connectors.length}, Text: {textElements.length}, Frames: {frames.length})
          </div>

          <div className="text-gray-600">
            <strong>Selected:</strong> {selectedIds.size}
          </div>

          <div className="text-gray-600">
            <strong>Your Position:</strong> ({Math.round(cursorPos.x)},{' '}
            {Math.round(cursorPos.y)})
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        <div className="border-t pt-2 mt-2">
          <p className="text-xs text-gray-500">
            <strong>Instructions:</strong>
            <br />
            1. Open in two browser windows
            <br />
            2. Move your mouse in one window
            <br />
            3. See the cursor in the other window
            <br />
            <strong>Target:</strong> Instant cursor sync (&lt;50ms)
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleCreateStickyNote}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded text-white font-medium transition"
          >
            {isLoading ? 'Creating...' : '+ Add Sticky Note'}
          </button>

          <button
            onClick={handleCreateRectangle}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 rounded text-white font-medium transition"
          >
            {isLoading ? 'Creating...' : '+ Add Rectangle'}
          </button>

          <button
            onClick={handleCreateCircle}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-green-500 hover:bg-green-600 disabled:bg-gray-300 rounded text-white font-medium transition"
          >
            {isLoading ? 'Creating...' : '+ Add Circle'}
          </button>

          <button
            onClick={handleCreateLine}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 rounded text-white font-medium transition"
          >
            {isLoading ? 'Creating...' : '+ Add Line'}
          </button>

          <button
            onClick={handleCreateText}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 rounded text-white font-medium transition"
          >
            {isLoading ? 'Creating...' : '+ Add Text'}
          </button>

          <button
            onClick={handleCreateFrame}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 rounded text-white font-medium transition"
          >
            {isLoading ? 'Creating...' : '+ Add Frame'}
          </button>

          <button
            onClick={() => {
              selectedIds.forEach((id) => { deleteObject(id) })
              clearSelection()
            }}
            disabled={selectedIds.size === 0}
            className="w-full px-3 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-gray-300 rounded text-white font-medium transition"
          >
            {selectedIds.size > 0 ? `Delete Selected (${selectedIds.size})` : 'Delete Selected'}
          </button>

          <button
            onClick={() => {
              if (connectorMode) {
                setConnectorMode(null)
              } else if (selectedIds.size === 1) {
                const fromId = Array.from(selectedIds)[0]!
                setConnectorMode({ fromId })
                clearSelection()
              }
            }}
            disabled={!connectorMode && selectedIds.size !== 1}
            className={`w-full px-3 py-2 text-sm rounded text-white font-medium transition ${
              connectorMode
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300'
            }`}
          >
            {connectorMode ? 'Cancel Connect (click target)' : 'Connect (select 1 first)'}
          </button>

          <button
            onClick={signOut}
            className="w-full px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
          >
            Sign out ({displayName})
          </button>
        </div>
      </div>

      {/* Presence Bar */}
      <PresenceBar onlineUsers={onlineUsers} currentUserId={userId} />

      {/* Canvas */}
      <BoardStage onCursorMove={handleCursorMove} onStageClick={clearSelection} onStageTransformChange={setStageTransform} onMarqueeSelect={handleMarqueeSelect}>
        {/* Render frames first (behind everything) */}
        {frames.map((frame) => (
          <Frame
            key={frame.id}
            object={frame}
            onUpdate={updateObject}
            onSelect={handleObjectClick}
            isSelected={isSelected(frame.id)}
            onMount={handleNodeMount}
            onUnmount={handleNodeUnmount}
          />
        ))}

        {/* Render connectors (behind shapes) */}
        {connectors.map(c => (
          <Connector
            key={c.id}
            object={c}
            allObjects={objects}
            isSelected={isSelected(c.id)}
            onSelect={handleObjectClick}
          />
        ))}

        {/* Render shapes (lower z-index) */}
        {shapes.map((shape) => (
          <Shape
            key={shape.id}
            object={shape}
            onUpdate={updateObject}
            onSelect={handleObjectClick}
            isSelected={isSelected(shape.id)}
            onMount={handleNodeMount}
            onUnmount={handleNodeUnmount}
          />
        ))}

        {/* Render all sticky notes */}
        {stickyNotes.map((note) => (
          <StickyNote
            key={note.id}
            object={note}
            onUpdate={updateObject}
            onSelect={handleObjectClick}
            isSelected={isSelected(note.id)}
            onStartEdit={handleStartEdit}
            onMount={handleNodeMount}
            onUnmount={handleNodeUnmount}
          />
        ))}

        {/* Render all text elements */}
        {textElements.map((textEl) => (
          <TextElement
            key={textEl.id}
            object={textEl}
            onUpdate={updateObject}
            onSelect={handleObjectClick}
            isSelected={isSelected(textEl.id)}
            isEditing={editingId === textEl.id}
            onStartEdit={handleStartEdit}
            onMount={handleNodeMount}
            onUnmount={handleNodeUnmount}
          />
        ))}

        <SelectionTransformer
          selectedNodes={selectedNodes}
          onTransformEnd={handleTransformEnd}
        />

        {/* Render all remote cursors */}
        {Array.from(cursors.values()).map((cursor) => (
          <RemoteCursor key={cursor.userId} cursor={cursor} />
        ))}

        {/* Grid background (optional visual aid) */}
        {/* You can add a grid here later for better spatial reference */}
      </BoardStage>

      {/* Text edit overlay */}
      {editingId && (() => {
        const note = stickyNotes.find(n => n.id === editingId)
        const textEl = textElements.find(t => t.id === editingId)
        const obj = note ?? textEl
        if (!obj) return null
        const screenX = obj.x * stageTransform.scale + stageTransform.x
        const screenY = obj.y * stageTransform.scale + stageTransform.y
        const screenW = obj.width * stageTransform.scale
        const screenH = (note ? obj.height : Math.max(obj.height, 40)) * stageTransform.scale
        const color = note ? note.data.color : 'transparent'
        const fontSize = note ? 14 : (textEl?.data.fontSize ?? 16)
        const padding = note ? 8 : 0
        return (
          <TextEditOverlay
            text={obj.data.text}
            x={screenX}
            y={screenY}
            width={screenW}
            height={screenH}
            color={color}
            scale={stageTransform.scale}
            fontSize={fontSize}
            padding={padding}
            onSave={handleSaveEdit}
            onClose={() => setEditingId(null)}
          />
        )
      })()}

      {/* Latency Warning */}
      {!isConnected && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          ⚠️ Not connected to Supabase Realtime
        </div>
      )}

      <AICommandInput
        onSubmit={executeCommand}
        isProcessing={aiProcessing}
        lastResult={aiResult}
        error={aiError}
      />
    </div>
  )
}
