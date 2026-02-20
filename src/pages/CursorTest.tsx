/**
 * CursorTest Page (Main Board)
 *
 * Primary board page hosting the collaborative whiteboard canvas.
 * Includes sticky notes, shapes, connectors, frames, text elements,
 * real-time sync, presence, and multi-user cursor tracking.
 */

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type Konva from 'konva'

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
import { AICommandInput } from '../components/ai/AICommandInput'
import { useAuth } from '../contexts/AuthContext'
import { useCursors } from '../hooks/useCursors'
import { usePresence } from '../hooks/usePresence'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useSelection } from '../hooks/useSelection'
import { useAIAgent } from '../hooks/useAIAgent'
import { supabase } from '../lib/supabase'
import type {
  BoardObject,
  ConnectorData,
  FrameData,
  StickyNoteData,
  RectangleData,
  CircleData,
  LineData,
  TextData,
} from '../lib/database.types'

import { LoginPage } from './LoginPage'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STICKY_NOTE_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#95E1D3', '#FFA07A', '#F7DC6F'] as const
const SHAPE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9'] as const
const DUPLICATE_OFFSET = 20

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CursorTestInnerProps {
  boardId: string
  userId: string
  displayName: string
  avatarUrl: string | null
  signOut: () => Promise<void>
}

interface TextEditOverlayContentProps {
  editingId: string
  stickyNotes: (BoardObject & { type: 'sticky_note'; data: StickyNoteData })[]
  textElements: (BoardObject & { type: 'text'; data: TextData })[]
  stageTransform: { x: number; y: number; scale: number }
  onSave: (newText: string) => void
  onClose: () => void
}

function TextEditOverlayContent({
  editingId,
  stickyNotes,
  textElements,
  stageTransform,
  onSave,
  onClose,
}: TextEditOverlayContentProps): ReactNode | null {
  const note = stickyNotes.find(n => n.id === editingId)
  const textElement = textElements.find(t => t.id === editingId)
  const target = note ?? textElement
  if (!target) return null

  const screenX = target.x * stageTransform.scale + stageTransform.x
  const screenY = target.y * stageTransform.scale + stageTransform.y
  const screenW = target.width * stageTransform.scale
  const screenH = (note ? target.height : Math.max(target.height, 40)) * stageTransform.scale
  const color = note ? note.data.color : 'transparent'
  const fontSize = note ? 14 : (textElement?.data.fontSize ?? 16)
  const padding = note ? 8 : 0

  return (
    <TextEditOverlay
      text={target.data.text}
      x={screenX}
      y={screenY}
      width={screenW}
      height={screenH}
      color={color}
      scale={stageTransform.scale}
      fontSize={fontSize}
      padding={padding}
      onSave={onSave}
      onClose={onClose}
    />
  )
}

// ---------------------------------------------------------------------------
// Main Page (Auth Shell)
// ---------------------------------------------------------------------------

export function CursorTest({ boardId }: { boardId: string }) {
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

  return (
    <CursorTestInner
      boardId={boardId}
      userId={user.id}
      displayName={displayName}
      avatarUrl={avatarUrl}
      signOut={signOut}
    />
  )
}

// ---------------------------------------------------------------------------
// Board Canvas (Inner Content)
// ---------------------------------------------------------------------------

function CursorTestInner({ boardId, userId, displayName, avatarUrl, signOut }: CursorTestInnerProps) {
  const currentUser = { id: userId, name: displayName }
  const navigate = useNavigate()

  // --- Local UI state ---
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stageTransform, setStageTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [transformVersion, setTransformVersion] = useState(0)
  const [connectorMode, setConnectorMode] = useState<{ fromId: string } | null>(null)

  // --- Fetch invite code for sharing ---
  useEffect(() => {
    const fetchInvite = async () => {
      const { data } = await supabase
        .from('boards')
        .select('invite_code')
        .eq('id', boardId)
        .single()
      if (data) setInviteCode(data.invite_code)
    }
    void fetchInvite()
  }, [boardId])

  // --- Real-time sync hooks ---
  const { onlineUsers } = usePresence({
    boardId: boardId,
    userId,
    userName: displayName,
    avatarUrl,
  })

  const { cursors, broadcastCursor, isConnected } = useCursors({
    boardId: boardId,
    userId: currentUser.id,
    userName: currentUser.name,
  })

  const {
    objects,
    createObject,
    updateObject,
    deleteObject,
    isLoading,
    error,
  } = useRealtimeSync({
    boardId: boardId,
    userId: currentUser.id,
  })

  const { isSelected, selectObject, clearSelection, selectedIds, selectMultiple } = useSelection()

  // --- Refs (for transformer and create handlers) ---
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
    setTransformVersion(v => v + 1)
  }, [updateObject])

  const handleDuplicate = useCallback(() => {
    if (selectedIds.size === 0) return
    let zOffset = 0
    selectedIds.forEach(id => {
      const source = objects.find(o => o.id === id)
      if (!source) return
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentionally omitting for createObject
      const { id: _omit, created_at: _omit2, updated_at: _omit3, created_by: _omit4, ...rest } = source
      void createObject({
        ...rest,
        x: source.x + DUPLICATE_OFFSET,
        y: source.y + DUPLICATE_OFFSET,
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

  // --- Object creation handlers ---
  const handleCreateStickyNote = useCallback(async () => {
    const randomColor = STICKY_NOTE_COLORS[Math.floor(Math.random() * STICKY_NOTE_COLORS.length)] ?? '#FFD700'

    await createObject({
      board_id: boardId,
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
  }, [boardId, createObject, cursorPos, objects.length])

  const handleCreateRectangle = useCallback(async () => {
    const randomFill = SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)] ?? '#FF6B6B'

    await createObject({
      board_id: boardId,
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
  }, [boardId, createObject, cursorPos, objects.length])

  const handleCreateCircle = useCallback(async () => {
    const randomFill = SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)] ?? '#4ECDC4'

    await createObject({
      board_id: boardId,
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
  }, [boardId, createObject, cursorPos, objects.length])

  const handleCreateLine = useCallback(async () => {
    await createObject({
      board_id: boardId,
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
  }, [boardId, createObject, cursorPos, objects.length])

  const handleCreateText = useCallback(async () => {
    await createObject({
      board_id: boardId,
      type: 'text',
      x: cursorPos.x || 300,
      y: cursorPos.y || 300,
      width: 200,
      height: 40,
      rotation: 0,
      z_index: objectsRef.current.length,
      data: { text: 'New text', fontSize: 18, color: '#000000' } satisfies TextData,
    })
  }, [boardId, createObject, cursorPos])

  // --- Filtered object lists (by type for rendering) ---
  const { stickyNotes, shapes, connectors, textElements, frames } = useMemo(
    () => ({
      stickyNotes: objects.filter(
        (obj): obj is BoardObject & { type: 'sticky_note'; data: StickyNoteData } =>
          obj.type === 'sticky_note'
      ),
      shapes: objects.filter(
        (obj): obj is BoardObject & { type: 'rectangle' | 'circle' | 'line'; data: RectangleData | CircleData | LineData } =>
          obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line'
      ),
      connectors: objects.filter(
        (obj): obj is BoardObject & { type: 'connector'; data: ConnectorData } =>
          obj.type === 'connector'
      ),
      textElements: objects.filter(
        (obj): obj is BoardObject & { type: 'text'; data: TextData } =>
          obj.type === 'text'
      ),
      frames: objects.filter(
        (obj): obj is BoardObject & { type: 'frame'; data: FrameData } =>
          obj.type === 'frame'
      ),
    }),
    [objects]
  )

  const handleCreateFrame = useCallback(async () => {
    await createObject({
      board_id: boardId,
      type: 'frame',
      x: cursorPos.x || 100,
      y: cursorPos.y || 100,
      width: 400,
      height: 300,
      rotation: 0,
      z_index: -(frames.length + 1),  // negative so frames stay behind all regular objects
      data: { title: 'New Frame', backgroundColor: 'rgba(240,240,240,0.5)' } satisfies FrameData,
    })
  }, [boardId, createObject, cursorPos, frames.length])

  const handleCreateConnector = useCallback((toId: string) => {
    if (!connectorMode) return
    createObject({
      board_id: boardId,
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

  // --- AI agent ---
  const { executeCommand, isProcessing: aiIsProcessing, lastResult: aiLastResult, error: aiError } = useAIAgent({
    boardId,
    objects,
    createObject,
    updateObject,
  })

  // --- Object interaction handlers ---
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
      void updateObject(editingId, { data: { text: newText, color: note.data.color } as StickyNoteData })
      setEditingId(null)
      return
    }
    const textElement = textElements.find(t => t.id === editingId)
    if (textElement) {
      void updateObject(editingId, { data: { ...textElement.data, text: newText } as TextData })
    }
    setEditingId(null) // always close, even if object was deleted remotely
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
        <button
          onClick={() => navigate({ to: '/' })}
          className="text-xs text-blue-500 hover:underline"
        >
          ← My Boards
        </button>

        <div className="space-y-1 text-sm">
          <div className="flex items-center space-x-2" data-testid="connection-status" data-status={isConnected ? 'connected' : 'disconnected'}>
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
            data-testid="sticky-note-tool"
          >
            {isLoading ? 'Creating...' : '+ Add Sticky Note'}
          </button>

          <button
            onClick={handleCreateRectangle}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 rounded text-white font-medium transition"
            data-testid="rectangle-tool"
          >
            {isLoading ? 'Creating...' : '+ Add Rectangle'}
          </button>

          <button
            onClick={handleCreateCircle}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-green-500 hover:bg-green-600 disabled:bg-gray-300 rounded text-white font-medium transition"
            data-testid="circle-tool"
          >
            {isLoading ? 'Creating...' : '+ Add Circle'}
          </button>

          <button
            onClick={handleCreateLine}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 rounded text-white font-medium transition"
            data-testid="line-tool"
          >
            {isLoading ? 'Creating...' : '+ Add Line'}
          </button>

          <button
            onClick={handleCreateText}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 rounded text-white font-medium transition"
            data-testid="text-tool"
          >
            {isLoading ? 'Creating...' : '+ Add Text'}
          </button>

          <button
            onClick={handleCreateFrame}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 rounded text-white font-medium transition"
            data-testid="frame-tool"
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
            onClick={() => setShowShare(v => !v)}
            className="w-full px-3 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 rounded text-white font-medium transition"
          >
            Share Board
          </button>

          {showShare && inviteCode && (
            <div className="bg-gray-50 border rounded p-3 space-y-2 text-xs">
              <div>
                <p className="text-gray-500 font-medium mb-1">Invite code</p>
                <p className="font-mono text-lg font-bold text-gray-800 tracking-widest">{inviteCode}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">Invite link</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`)
                  }}
                  className="w-full text-left bg-white border rounded px-2 py-1 font-mono text-gray-600 hover:bg-gray-100 truncate transition"
                  title="Click to copy"
                >
                  {window.location.origin}/join/{inviteCode}
                </button>
                <p className="text-gray-400 mt-1">Click link to copy</p>
              </div>
            </div>
          )}

          <button
            onClick={signOut}
            className="w-full px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
            data-testid="sign-out-button"
          >
            Sign out ({displayName})
          </button>
        </div>
      </div>

      {/* Presence Bar */}
      <PresenceBar onlineUsers={onlineUsers} currentUserId={userId} />

      {/* Canvas */}
      <div
        data-testid="board-stage"
        data-transform={JSON.stringify(stageTransform)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
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
          transformVersion={transformVersion}
          onTransformEnd={handleTransformEnd}
        />

        {/* Render all remote cursors */}
        {Array.from(cursors.values()).map((cursor) => (
          <RemoteCursor key={cursor.userId} cursor={cursor} />
        ))}

        {/* Grid background (optional visual aid) */}
        {/* You can add a grid here later for better spatial reference */}
      </BoardStage>
      </div>

      {/* Text edit overlay (sticky note or text element) */}
      {editingId && (
        <TextEditOverlayContent
          editingId={editingId}
          stickyNotes={stickyNotes}
          textElements={textElements}
          stageTransform={stageTransform}
          onSave={handleSaveEdit}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Latency Warning */}
      {!isConnected && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          ⚠️ Not connected to Supabase Realtime
        </div>
      )}

      <AICommandInput
        onSubmit={executeCommand}
        isProcessing={aiIsProcessing}
        lastResult={aiLastResult}
        error={aiError}
      />
    </div>
  )
}
