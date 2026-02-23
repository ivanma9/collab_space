/**
 * CursorTest Page (Main Board)
 *
 * Primary board page hosting the collaborative whiteboard canvas.
 * Includes sticky notes, shapes, connectors, frames, text elements,
 * real-time sync, presence, and multi-user cursor tracking.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type Konva from 'konva'

import { BoardStage } from '../components/canvas/BoardStage'
import { ObjectRenderer } from '../components/canvas/ObjectRenderer'
import { TextEditOverlayContent } from '../components/canvas/TextEditOverlayContent'
import { AIPanel } from '../components/ai/AIPanel'
import { CanvasHUD } from '../components/canvas/CanvasHUD'
import { ContextMenu } from '../components/canvas/ContextMenu'
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
  const resetZoomRef = useRef<(() => void) | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

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

  // Object lookup map for O(1) access by id
  const objectMap = useMemo(() => {
    const map = new Map<string, BoardObject>()
    for (const obj of objects) map.set(obj.id, obj)
    return map
  }, [objects])

  // Single-pass object counts (replaces typed filter arrays)
  const objectCounts = useMemo(() => {
    let notes = 0, shapes = 0, connectors = 0, text = 0, frames = 0
    for (const o of objects) {
      if (o.type === 'sticky_note') notes++
      else if (o.type === 'rectangle' || o.type === 'circle' || o.type === 'line') shapes++
      else if (o.type === 'connector') connectors++
      else if (o.type === 'text') text++
      else if (o.type === 'frame') frames++
    }
    return { notes, shapes, connectors, text, frames }
  }, [objects])

  // Sorted render order for z_index-based layering
  const sortedObjects = useMemo(() =>
    [...objects].sort((a, b) => a.z_index - b.z_index),
    [objects]
  )

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

  // Force transformer to re-measure when selected objects change dimensions (e.g. text auto-resize)
  const selectedDimensionKey = useMemo(() =>
    Array.from(selectedIds).map(id => {
      const obj = objectMap.get(id)
      return obj ? `${obj.id}:${obj.width}:${obj.height}` : ''
    }).join(','),
    [objectMap, selectedIds]
  )
  useEffect(() => {
    if (selectedIds.size > 0) setTransformVersion(v => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDimensionKey])

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
      const source = objectMap.get(id)
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
  }, [selectedIds, objectMap, objects.length, createObject])

  const handleColorChange = useCallback((color: string) => {
    setActiveColor(color)
    if (selectedIds.size === 0) return

    selectedIds.forEach((id) => {
      const obj = objectMap.get(id)
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
  }, [selectedIds, objectMap, updateObject])

  // --- Layer ordering ---
  const handleBringToFront = useCallback(() => {
    if (selectedIds.size === 0) return
    const maxZ = Math.max(...objects.map(o => o.z_index))
    let offset = 1
    selectedIds.forEach(id => {
      updateObject(id, { z_index: maxZ + offset })
      offset++
    })
  }, [selectedIds, objects, updateObject])

  const handleSendToBack = useCallback(() => {
    if (selectedIds.size === 0) return
    // Find min z_index among non-frame objects so frames stay behind
    const nonFrameObjects = objects.filter(o => o.type !== 'frame')
    const minZ = nonFrameObjects.length > 0 ? Math.min(...nonFrameObjects.map(o => o.z_index)) : 0
    let offset = 1
    selectedIds.forEach(id => {
      const obj = objectMap.get(id)
      if (!obj || obj.type === 'frame') return
      updateObject(id, { z_index: minZ - offset })
      offset++
    })
  }, [selectedIds, objects, updateObject])

  const handleBringForward = useCallback(() => {
    if (selectedIds.size === 0) return
    const sortedObjs = [...objects].sort((a, b) => a.z_index - b.z_index)
    selectedIds.forEach(id => {
      const idx = sortedObjs.findIndex(o => o.id === id)
      if (idx === -1 || idx >= sortedObjs.length - 1) return
      const current = sortedObjs[idx]!
      const above = sortedObjs[idx + 1]!
      if (above.type === 'frame' && current.type !== 'frame') return
      updateObject(id, { z_index: above.z_index })
      updateObject(above.id, { z_index: current.z_index })
    })
  }, [selectedIds, objects, updateObject])

  const handleSendBackward = useCallback(() => {
    if (selectedIds.size === 0) return
    const sortedObjs = [...objects].sort((a, b) => a.z_index - b.z_index)
    selectedIds.forEach(id => {
      const idx = sortedObjs.findIndex(o => o.id === id)
      if (idx <= 0) return
      const current = sortedObjs[idx]!
      const below = sortedObjs[idx - 1]!
      if (below.type === 'frame' && current.type !== 'frame') return
      updateObject(id, { z_index: below.z_index })
      updateObject(below.id, { z_index: current.z_index })
    })
  }, [selectedIds, objects, updateObject])

  // Sync activeColor from the first selected object when selection changes
  useEffect(() => {
    if (selectedIds.size === 0) return
    const firstId = Array.from(selectedIds)[0]!
    const obj = objectMap.get(firstId)
    if (!obj) return

    let color: string | undefined
    if (obj.type === "sticky_note") color = obj.data.color
    else if (obj.type === "rectangle") color = obj.data.fillColor
    else if (obj.type === "circle") color = obj.data.fillColor
    else if (obj.type === "line") color = obj.data.strokeColor
    else if (obj.type === "text") color = obj.data.color
    else if (obj.type === "frame") color = obj.data.backgroundColor

    if (color) setActiveColor(color)
  }, [selectedIds, objectMap])

  // Delete selected objects on Delete/Backspace key; duplicate with Cmd+D; Escape cancels connecting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && connectorMode) {
        setConnectorMode(null)
        return
      }
      // Layer ordering shortcuts
      if (e.key === ']') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        if (e.metaKey || e.ctrlKey) {
          handleBringToFront()
        } else {
          handleBringForward()
        }
        return
      }
      if (e.key === '[') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        if (e.metaKey || e.ctrlKey) {
          handleSendToBack()
        } else {
          handleSendBackward()
        }
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
  }, [selectedIds, deleteObject, clearSelection, handleDuplicate, connectorMode, handleBringToFront, handleSendToBack, handleBringForward, handleSendBackward])

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
  const handleCreateStickyNote = useCallback(async (id?: string) => {
    await createObject({
      id,
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

  const handleCreateRectangle = useCallback(async (id?: string) => {
    await createObject({
      id,
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

  const handleCreateCircle = useCallback(async (id?: string) => {
    await createObject({
      id,
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

  const handleCreateLine = useCallback(async (id?: string) => {
    await createObject({
      id,
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

  const handleCreateText = useCallback(async (id?: string) => {
    await createObject({
      id,
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

  const handleCreateFrame = useCallback(async (id?: string) => {
    await createObject({
      id,
      board_id: boardId,
      type: 'frame',
      x: cursorPos.x || 100,
      y: cursorPos.y || 100,
      width: 400,
      height: 300,
      rotation: 0,
      z_index: -(objectCounts.frames + 1),  // negative so frames stay behind all regular objects
      data: { title: 'New Frame', backgroundColor: activeColor } satisfies FrameData,
    })
  }, [boardId, createObject, cursorPos, objectCounts.frames, activeColor])

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

  // Drag-to-connect: complete connection on mouseup over a target object
  const connectingCursorRef = useRef(connectingCursorPos)
  connectingCursorRef.current = connectingCursorPos
  const connectorModeRef = useRef(connectorMode)
  connectorModeRef.current = connectorMode

  useEffect(() => {
    if (!connectorMode) return
    const handleMouseUp = () => {
      const mode = connectorModeRef.current
      if (!mode) return
      const pos = connectingCursorRef.current
      const target = objectsRef.current.find(obj => {
        if (obj.id === mode.fromId || obj.type === 'connector') return false
        return pos.x >= obj.x && pos.x <= obj.x + obj.width &&
               pos.y >= obj.y && pos.y <= obj.y + obj.height
      })
      if (target) {
        handleCreateConnector(target.id)
      }
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [connectorMode, handleCreateConnector])

  // --- AI agent ---
  const [aiPanelOpen, setAIPanelOpen] = useState(false)
  const { messages: aiMessages, suggestions: aiSuggestions, isProcessing: aiIsProcessing, sendMessage: aiSendMessage, clearChat: aiClearChat } = useAIAgent({
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
    const creators: Record<string, ((id?: string) => void) | undefined> = {
      sticky_note: handleCreateStickyNote,
      rectangle: handleCreateRectangle,
      circle: handleCreateCircle,
      line: handleCreateLine,
      text: handleCreateText,
      frame: handleCreateFrame,
    }
    const creator = creators[tool]
    if (creator) {
      // Generate a stable UUID so the object keeps the same ID from optimistic update through DB persist
      const id = crypto.randomUUID()
      creator(id)
      // Auto-select the newly created object
      selectObject(id)
      // Reset to select after creating
      setActiveTool('select')
    }
  }, [handleCreateStickyNote, handleCreateRectangle, handleCreateCircle, handleCreateLine, handleCreateText, handleCreateFrame, selectObject])

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
    const obj = objectMap.get(editingId)
    if (obj?.type === 'sticky_note') {
      void updateObject(editingId, { data: { text: newText, color: (obj.data as StickyNoteData).color } as StickyNoteData })
      setEditingId(null)
      return
    }
    if (obj?.type === 'text') {
      void updateObject(editingId, { data: { ...(obj.data as TextData), text: newText } as TextData })
    }
    setEditingId(null) // always close, even if object was deleted remotely
  }, [editingId, objectMap, updateObject])

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-gray-100"
      style={{ cursor: connectorMode ? 'crosshair' : 'default', paddingRight: aiPanelOpen ? 350 : 0 }}
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
        onContextMenu={(e) => {
          e.preventDefault()
          if (selectedIds.size > 0) {
            setContextMenu({ x: e.clientX, y: e.clientY })
          }
        }}
      >
        <BoardStage onCursorMove={handleCursorMove} onStageClick={() => { setContextMenu(null); if (connectorMode) { setConnectorMode(null) } else { clearSelection() } }} onStageTransformChange={setStageTransform} onMarqueeSelect={handleMarqueeSelect} onResetZoomRef={resetZoomRef}>
        <ObjectRenderer
          sortedObjects={sortedObjects}
          objectMap={objectMap}
          selectedIds={selectedIds}
          editingId={editingId}
          connectorMode={connectorMode}
          connectingCursorPos={connectingCursorPos}
          cursors={cursors}
          selectedNodes={selectedNodes}
          transformVersion={transformVersion}
          nodeRefs={nodeRefs}
          isSelected={isSelected}
          onUpdate={updateObject}
          onSelect={handleObjectClick}
          onMount={handleNodeMount}
          onUnmount={handleNodeUnmount}
          onStartEdit={handleStartEdit}
          onStartConnect={handleStartConnect}
          onTransformEnd={handleTransformEnd}
        />
      </BoardStage>
      </div>

      {/* Text edit overlay */}
      {editingId && (
        <TextEditOverlayContent
          editingObject={objectMap.get(editingId)}
          stageTransform={stageTransform}
          onSave={handleSaveEdit}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Canvas HUD: cursor coords + zoom */}
      <CanvasHUD
        cursorX={cursorPos.x}
        cursorY={cursorPos.y}
        zoomPercent={stageTransform.scale * 100}
        onResetZoom={() => resetZoomRef.current?.()}
      />

      {/* Connection status dot */}
      <div
        className="absolute bottom-4 left-4 z-10"
        data-testid="connection-status"
        data-status={isConnected ? 'connected' : 'disconnected'}
        title={isConnected ? 'Connected' : 'Disconnected'}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {/* AI Panel */}
      <AIPanel
        isOpen={aiPanelOpen}
        onClose={() => setAIPanelOpen(false)}
        messages={aiMessages}
        suggestions={aiSuggestions}
        isProcessing={aiIsProcessing}
        onSendMessage={aiSendMessage}
        onClearChat={aiClearChat}
      />

      {/* AI Panel toggle button */}
      {!aiPanelOpen && (
        <button
          onClick={() => setAIPanelOpen(true)}
          className="fixed bottom-20 right-4 z-20 w-10 h-10 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transition"
          title="Open AI Agent"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        </button>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onBringToFront={handleBringToFront}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onSendToBack={handleSendToBack}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

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
      />

      {/* Error display */}
      {error && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm shadow-md">
          {error}
        </div>
      )}

      {/* Hidden testing affordances */}
      <div
        data-testid="object-counts"
        data-notes={objectCounts.notes}
        data-shapes={objectCounts.shapes}
        data-connectors={objectCounts.connectors}
        data-text={objectCounts.text}
        data-frames={objectCounts.frames}
        data-total={objects.length}
        className="hidden"
      />
      <div
        data-testid="board-invite-code"
        data-code={inviteCode ?? ''}
        className="hidden"
      />
      <div
        data-testid="remote-cursor-count"
        data-count={cursors.size}
        className="hidden"
      />
    </div>
  )
}
