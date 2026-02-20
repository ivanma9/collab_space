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
import { ConnectionHandles } from '../components/canvas/ConnectionHandles'
import { Connector } from '../components/canvas/Connector'
import { Frame } from '../components/canvas/Frame'
import { RemoteCursor } from '../components/canvas/RemoteCursor'
import { Shape } from '../components/canvas/Shape'
import { StickyNote } from '../components/canvas/StickyNote'
import { SelectionTransformer } from '../components/canvas/SelectionTransformer'
import { TempConnectorLine } from '../components/canvas/TempConnectorLine'
import { TextEditOverlay } from '../components/canvas/TextEditOverlay'
import { TextElement } from '../components/canvas/TextElement'
import { AICommandInput } from '../components/ai/AICommandInput'
import { BoardToolbar } from '../components/toolbar/BoardToolbar'
import { BoardTopBar } from '../components/toolbar/BoardTopBar'
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
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [stageTransform, setStageTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [transformVersion, setTransformVersion] = useState(0)
  const [connectorMode, setConnectorMode] = useState<{ fromId: string; fromPoint: { x: number; y: number } } | null>(null)
  const [connectingCursorPos, setConnectingCursorPos] = useState({ x: 0, y: 0 })
  const [activeTool, setActiveTool] = useState<'select' | 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'text' | 'frame'>('select')
  const [activeColor, setActiveColor] = useState<string>("#FFD700")

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

  const handleColorChange = useCallback((color: string) => {
    setActiveColor(color)
    if (selectedIds.size === 0) return

    selectedIds.forEach((id) => {
      const obj = objects.find((o) => o.id === id)
      if (!obj) return

      if (obj.type === "sticky_note") {
        void updateObject(id, { data: { ...obj.data, color } })
      } else if (obj.type === "rectangle") {
        void updateObject(id, { data: { ...obj.data, fillColor: color } })
      } else if (obj.type === "circle") {
        void updateObject(id, { data: { ...obj.data, fillColor: color } })
      } else if (obj.type === "line") {
        void updateObject(id, { data: { ...obj.data, strokeColor: color } })
      } else if (obj.type === "text") {
        void updateObject(id, { data: { ...obj.data, color } })
      } else if (obj.type === "frame") {
        void updateObject(id, { data: { ...obj.data, backgroundColor: color } })
      }
      // connector: no color field in ConnectorData — skip intentionally
    })
  }, [selectedIds, objects, updateObject])

  // Sync activeColor from the first selected object when selection changes
  useEffect(() => {
    if (selectedIds.size === 0) return
    const firstId = Array.from(selectedIds)[0]!
    const obj = objects.find((o) => o.id === firstId)
    if (!obj) return

    let color: string | undefined
    if (obj.type === "sticky_note") color = obj.data.color
    else if (obj.type === "rectangle") color = obj.data.fillColor
    else if (obj.type === "circle") color = obj.data.fillColor
    else if (obj.type === "line") color = obj.data.strokeColor
    else if (obj.type === "text") color = obj.data.color
    else if (obj.type === "frame") color = obj.data.backgroundColor

    if (color) setActiveColor(color)
  }, [selectedIds, objects])

  // Delete selected objects on Delete/Backspace key; duplicate with Cmd+D; Escape cancels connecting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectorMode) {
        setConnectorMode(null)
        return
      }
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
  }, [selectedIds, deleteObject, clearSelection, handleDuplicate, connectorMode])

  // Broadcast cursor position whenever it changes
  const handleCursorMove = useCallback((x: number, y: number) => {
    setCursorPos({ x, y })
    broadcastCursor(x, y)
    if (connectorMode) {
      setConnectingCursorPos({ x, y })
    }
  }, [broadcastCursor, connectorMode])

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
        color: activeColor,
      },
    })
  }, [boardId, createObject, cursorPos, objects.length, activeColor])

  const handleCreateRectangle = useCallback(async () => {
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
        fillColor: activeColor,
        strokeColor: '#2D3436',
        strokeWidth: 2,
      },
    })
  }, [boardId, createObject, cursorPos, objects.length, activeColor])

  const handleCreateCircle = useCallback(async () => {
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
        fillColor: activeColor,
        strokeColor: '#2D3436',
        strokeWidth: 2,
      },
    })
  }, [boardId, createObject, cursorPos, objects.length, activeColor])

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
        strokeColor: activeColor,
        strokeWidth: 4,
      },
    })
  }, [boardId, createObject, cursorPos, objects.length, activeColor])

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
      data: { text: 'New text', fontSize: 18, color: activeColor } satisfies TextData,
    })
  }, [boardId, createObject, cursorPos, activeColor])

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
      data: { title: 'New Frame', backgroundColor: activeColor } satisfies FrameData,
    })
  }, [boardId, createObject, cursorPos, frames.length, activeColor])

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

  const handleStartConnect = useCallback((objectId: string, point: { x: number; y: number }) => {
    setConnectorMode({ fromId: objectId, fromPoint: point })
    setConnectingCursorPos(point)
    clearSelection()
  }, [clearSelection])

  // --- AI agent ---
  const { executeCommand, isProcessing: aiIsProcessing, lastResult: aiLastResult, error: aiError } = useAIAgent({
    boardId,
    objects,
    createObject,
    updateObject,
  })

  // --- Toolbar tool selection ---
  const handleToolSelect = useCallback((tool: typeof activeTool) => {
    setConnectorMode(null)
    setActiveTool(tool)

    // Immediately create the object for non-select tools
    const creators: Record<string, (() => void) | undefined> = {
      sticky_note: handleCreateStickyNote,
      rectangle: handleCreateRectangle,
      circle: handleCreateCircle,
      line: handleCreateLine,
      text: handleCreateText,
      frame: handleCreateFrame,
    }
    const creator = creators[tool]
    if (creator) {
      creator()
      // Reset to select after creating
      setActiveTool('select')
    }
  }, [handleCreateStickyNote, handleCreateRectangle, handleCreateCircle, handleCreateLine, handleCreateText, handleCreateFrame])

  const handleDelete = useCallback(() => {
    selectedIds.forEach((id) => { deleteObject(id) })
    clearSelection()
  }, [selectedIds, deleteObject, clearSelection])

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
      {/* Top Bar */}
      <BoardTopBar
        displayName={displayName}
        inviteCode={inviteCode}
        onlineUsers={onlineUsers}
        currentUserId={userId}
        onNavigateBack={() => navigate({ to: '/' })}
        onSignOut={signOut}
      />

      {/* Canvas */}
      <div
        data-testid="board-stage"
        data-transform={JSON.stringify(stageTransform)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <BoardStage onCursorMove={handleCursorMove} onStageClick={() => { if (connectorMode) { setConnectorMode(null) } else { clearSelection() } }} onStageTransformChange={setStageTransform} onMarqueeSelect={handleMarqueeSelect}>
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

        {/* Render shapes */}
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

        {/* Render sticky notes */}
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

        {/* Render text elements */}
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

        {/* Connection handle dots on selected objects */}
        {!connectorMode && Array.from(selectedIds).map(id => {
          const obj = objects.find(o => o.id === id)
          if (!obj || obj.type === 'connector') return null
          return (
            <ConnectionHandles
              key={`handles-${id}`}
              object={obj}
              onStartConnect={handleStartConnect}
            />
          )
        })}

        {/* Temp connector line while connecting */}
        {connectorMode && (
          <TempConnectorLine
            fromPoint={connectorMode.fromPoint}
            toPoint={connectingCursorPos}
          />
        )}

        {/* Remote cursors */}
        {Array.from(cursors.values()).map((cursor) => (
          <RemoteCursor key={cursor.userId} cursor={cursor} />
        ))}
      </BoardStage>
      </div>

      {/* Text edit overlay */}
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

      {/* Connection status dot */}
      <div
        className="absolute bottom-4 left-4 z-10"
        data-testid="connection-status"
        data-status={isConnected ? 'connected' : 'disconnected'}
        title={isConnected ? 'Connected' : 'Disconnected'}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {/* AI Command Input */}
      <AICommandInput
        onSubmit={executeCommand}
        isProcessing={aiIsProcessing}
        lastResult={aiLastResult}
        error={aiError}
      />

      {/* Bottom Toolbar */}
      <BoardToolbar
        activeTool={activeTool}
        onToolSelect={handleToolSelect}
        onDelete={handleDelete}
        canDelete={selectedIds.size > 0}
        deleteCount={selectedIds.size}
        isLoading={isLoading}
        activeColor={activeColor}
        onColorChange={handleColorChange}
        hasSelection={selectedIds.size > 0}
      />

      {/* Error display */}
      {error && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm shadow-md">
          {error}
        </div>
      )}
    </div>
  )
}
