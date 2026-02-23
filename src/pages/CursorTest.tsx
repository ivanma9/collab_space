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
import { TimelineStrip } from '../components/journey/TimelineStrip'
import { GoalsSidebar } from '../components/journey/GoalsSidebar'
import { useAuth } from '../contexts/AuthContext'
import { useCursors } from '../hooks/useCursors'
import { usePresence } from '../hooks/usePresence'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useSelection } from '../hooks/useSelection'
import { useAIAgent, findOpenArea } from '../hooks/useAIAgent'
import { supabase } from '../lib/supabase'
import type {
  BoardObject,
  BoardSession,
  BoardType,
  ConnectorData,
  FrameData,
  GoalData,
  GoalStatus,
  StickyNoteData,
  TextData,
} from '../lib/database.types'
import { COACHING_TEMPLATES } from '../lib/templates'

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
  const [panTo, setPanTo] = useState<{ x: number; y: number; scale: number; version: number } | undefined>(undefined)
  const [transformVersion, setTransformVersion] = useState(0)
  const [connectorMode, setConnectorMode] = useState<{ fromId: string; fromPoint: { x: number; y: number } } | null>(null)
  const [connectingCursorPos, setConnectingCursorPos] = useState({ x: 0, y: 0 })
  const [activeTool, setActiveTool] = useState<'select' | 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'text' | 'frame'>('select')
  const [activeColor, setActiveColor] = useState<string>("#FFD700")
  const resetZoomRef = useRef<(() => void) | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // --- Journey/session state ---
  const [boardType, setBoardType] = useState<BoardType>('regular')
  const [boardCreatedBy, setBoardCreatedBy] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [sessions, setSessions] = useState<BoardSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [goalsSidebarOpen, setGoalsSidebarOpen] = useState(false)

  const isJourney = boardType === 'journey'
  const isCoach = boardCreatedBy === userId
  const hasActiveSession = sessions.some(s => s.status === 'active')

  // --- Fetch board info (invite code + type) ---
  useEffect(() => {
    const fetchBoard = async () => {
      const { data } = await supabase
        .from('boards')
        .select('invite_code, type, client_name, created_by')
        .eq('id', boardId)
        .single()
      if (data) {
        setInviteCode(data.invite_code)
        setBoardType((data.type as BoardType) ?? 'regular')
        setBoardCreatedBy(data.created_by ?? null)
        setClientName(data.client_name ?? null)
      }
    }
    void fetchBoard()
  }, [boardId])

  // --- Fetch sessions for journey boards ---
  useEffect(() => {
    if (!isJourney) return
    const fetchSessions = async () => {
      const { data } = await supabase
        .from('board_sessions')
        .select('*')
        .eq('board_id', boardId)
        .order('session_number', { ascending: true })
      if (data) {
        const typed = data as BoardSession[]
        setSessions(typed)
        // Auto-select active session if exists
        const active = typed.find(s => s.status === 'active')
        if (active) setActiveSessionId(active.id)
        else if (typed.length > 0) setActiveSessionId(typed[typed.length - 1]!.id)
      }
    }
    void fetchSessions()
  }, [boardId, isJourney])

  // --- Real-time session sync (broadcast session start/end to all clients) ---
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!isJourney) return

    const channel = supabase.channel(`board:${boardId}:sessions`, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'session_started' }, ({ payload }) => {
      const newSession = payload as BoardSession
      setSessions(prev => {
        if (prev.some(s => s.id === newSession.id)) return prev
        return [...prev, newSession]
      })
      setActiveSessionId(newSession.id)
    })

    channel.on('broadcast', { event: 'session_ended' }, ({ payload }) => {
      const { id, ended_at, summary } = payload as { id: string; ended_at: string; summary: string }
      setSessions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'completed' as const, ended_at, summary } : s
      ))
    })

    channel.subscribe()
    sessionChannelRef.current = channel

    return () => {
      channel.unsubscribe()
      sessionChannelRef.current = null
    }
  }, [boardId, isJourney])

  // NOTE: Session handlers defined below after hooks

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

  // --- Session handlers (need createObject/updateObject from hooks above) ---
  const handleStartSession = useCallback(async () => {
    const nextNumber = sessions.length > 0
      ? Math.max(...sessions.map(s => s.session_number)) + 1
      : 1
    const { data, error: sessError } = await supabase
      .from('board_sessions')
      .insert({ board_id: boardId, session_number: nextNumber })
      .select()
      .single()
    if (sessError || !data) return

    const newSession = data as BoardSession
    setSessions(prev => [...prev, newSession])
    setActiveSessionId(newSession.id)

    // Broadcast to other clients
    sessionChannelRef.current?.send({
      type: 'broadcast',
      event: 'session_started',
      payload: newSession,
    })

    // Create a session zone frame and pan canvas to it
    const sessionX = (nextNumber - 1) * 2000
    setStageTransform({ x: -sessionX + 100, y: 50, scale: 1 })
    await createObject({
      board_id: boardId,
      type: 'frame',
      x: sessionX,
      y: 0,
      width: 1800,
      height: 1200,
      rotation: 0,
      z_index: -(sessions.length + 1),
      session_id: newSession.id,
      data: {
        title: `Session #${nextNumber} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        backgroundColor: 'rgba(254, 243, 199, 0.15)',
      },
    } as any)

    // Generate session briefing from past sessions
    if (nextNumber > 1) {
      const completedSessions = sessions.filter(s => s.status === 'completed' && s.summary)
      const lastSummaries = completedSessions.slice(-3)
      const goalObjects = objects.filter(o => o.type === 'goal')
      const activeGoals = goalObjects.filter(o => (o.data as GoalData).status === 'active')

      let briefingText = `📋 Session #${nextNumber} Briefing\n\n`
      if (lastSummaries.length > 0) {
        briefingText += `Previous sessions:\n${lastSummaries.map(s => `• Session #${s.session_number}: ${s.summary}`).join('\n')}\n\n`
      }
      if (activeGoals.length > 0) {
        briefingText += `Active goals:\n${activeGoals.map(o => `• ${(o.data as GoalData).title}`).join('\n')}`
      }
      if (lastSummaries.length === 0 && activeGoals.length === 0) {
        briefingText += 'Welcome to your first session with history! Previous sessions had no summaries yet.'
      }

      await createObject({
        board_id: boardId,
        type: 'sticky_note',
        x: sessionX + 20,
        y: 60,
        width: 300,
        height: 250,
        rotation: 0,
        z_index: objects.length + 1,
        session_id: newSession.id,
        data: {
          text: briefingText,
          color: '#E3F2FD',
        },
      } as any)
    }
  }, [boardId, sessions, objects, createObject])

  const handleEndSession = useCallback(async () => {
    const active = sessions.find(s => s.status === 'active')
    if (!active) return

    // Capture AI summary generator BEFORE marking session completed,
    // since journeyContext.currentSessionNumber becomes undefined after state update
    const summaryGenerator = generateSummaryRef.current

    // 1. Immediately mark session as completed (optimistic UI update)
    const endedAt = new Date().toISOString()
    const placeholderSummary = 'Generating summary...'
    setSessions(prev => prev.map(s =>
      s.id === active.id ? { ...s, status: 'completed' as const, ended_at: endedAt, summary: placeholderSummary } : s
    ))

    // 2. Broadcast to other clients immediately
    sessionChannelRef.current?.send({
      type: 'broadcast',
      event: 'session_ended',
      payload: { id: active.id, ended_at: endedAt, summary: placeholderSummary },
    })

    // 3. Persist the completed status to DB right away
    await supabase
      .from('board_sessions')
      .update({ status: 'completed', ended_at: endedAt, summary: placeholderSummary })
      .eq('id', active.id)

    // 4. Generate AI summary + create sticky note + upsert context in background
    const capturedObjects = [...objects]
    const sessionNumber = active.session_number
    const sessionId = active.id

    void (async () => {
      let summary = 'Session completed.'
      let keyThemes: string[] = []
      const aiResult = await summaryGenerator?.()
      if (aiResult) {
        summary = aiResult.summary
        keyThemes = aiResult.keyThemes
      } else {
        const goalObjects = capturedObjects.filter(o => o.type === 'goal')
        keyThemes = [...new Set(goalObjects.map(o => (o.data as GoalData).title))]
        if (keyThemes.length > 0) {
          summary = `Goals discussed: ${keyThemes.join(', ')}`
        }
      }

      // Update DB with real summary
      await supabase
        .from('board_sessions')
        .update({ summary })
        .eq('id', sessionId)

      // Update local state with real summary
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, summary } : s
      ))

      // Broadcast updated summary to other clients
      sessionChannelRef.current?.send({
        type: 'broadcast',
        event: 'session_ended',
        payload: { id: sessionId, ended_at: endedAt, summary },
      })

      // Create summary sticky note
      const sessionX = (sessionNumber - 1) * 2000
      await createObject({
        board_id: boardId,
        type: 'sticky_note',
        x: sessionX + 1480,
        y: 60,
        width: 300,
        height: 300,
        rotation: 0,
        z_index: capturedObjects.length + 1,
        session_id: sessionId,
        data: {
          text: `📋 Session Summary\n\n${summary}${keyThemes.length > 0 ? `\n\n🏷️ Themes: ${keyThemes.join(', ')}` : ''}`,
          color: '#E8F5E9',
        },
      } as any)

      // Upsert AI context
      const allGoals = capturedObjects.filter(o => o.type === 'goal')
      const allThemes = [...new Set([...keyThemes, ...allGoals.map(o => (o.data as GoalData).title)])]
      await supabase
        .from('session_ai_context')
        .upsert({
          board_id: boardId,
          key_themes: allThemes,
          goal_history: allGoals.map(o => ({
            title: (o.data as GoalData).title,
            status: (o.data as GoalData).status,
            commitments: (o.data as GoalData).commitments,
          })),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'board_id' })
    })()
  }, [boardId, sessions, objects, createObject])

  const panVersionRef = useRef(0)
  const handleSessionClick = useCallback((session: BoardSession) => {
    setActiveSessionId(session.id)
    // Pan canvas to session zone
    const sessionX = (session.session_number - 1) * 2000
    panVersionRef.current += 1
    setPanTo({ x: -sessionX + 100, y: 50, scale: 1, version: panVersionRef.current })
  }, [])

  // --- Helper: get active session_id for tagging new objects ---
  const activeSessionRef = useRef<string | null>(null)
  activeSessionRef.current = isJourney ? (sessions.find(s => s.status === 'active')?.id ?? null) : null

  // Ref for AI summary generator (populated after useAIAgent hook, used by handleEndSession)
  const generateSummaryRef = useRef<(() => Promise<{ summary: string; keyThemes: string[] } | null>) | null>(null)

  // --- Refs (for transformer and create handlers) ---
  const objectsRef = useRef(objects)
  objectsRef.current = objects

  // Object lookup map for O(1) access by id
  const objectMap = useMemo(() => {
    const map = new Map<string, BoardObject>()
    for (const obj of objects) map.set(obj.id, obj)
    return map
  }, [objects])

  // --- Goal handlers (need objectMap + updateObject) ---
  const handleGoalStatusChange = useCallback((goalId: string, newStatus: GoalStatus) => {
    const obj = objectMap.get(goalId)
    if (!obj || obj.type !== 'goal') return
    void updateObject(goalId, {
      data: { ...(obj.data as GoalData), status: newStatus },
    })
  }, [objectMap, updateObject])

  const handleGoalClick = useCallback((goal: BoardObject & { type: 'goal'; data: GoalData }) => {
    setStageTransform({ x: -goal.x + 200, y: -goal.y + 200, scale: 1 })
    selectObject(goal.id)
  }, [selectObject])

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

  // --- Viewport center helper (canvas coordinates) ---
  const getViewportCenter = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
      x: (-stageTransform.x + vw / 2) / stageTransform.scale,
      y: (-stageTransform.y + vh / 2) / stageTransform.scale,
    }
  }, [stageTransform])

  // --- Object creation handlers ---
  const handleCreateStickyNote = useCallback(async (id?: string) => {
    const center = getViewportCenter()
    await createObject({
      id,
      board_id: boardId,
      session_id: activeSessionRef.current,
      type: 'sticky_note',
      x: center.x - 100,
      y: center.y - 75,
      width: 200,
      height: 150,
      rotation: 0,
      z_index: objects.length,
      data: {
        text: 'New sticky note!\nDouble-click to edit',
        color: activeColor,
      },
    })
  }, [boardId, createObject, objects.length, activeColor, getViewportCenter, activeSessionRef])

  const handleCreateRectangle = useCallback(async (id?: string) => {
    const center = getViewportCenter()
    await createObject({
      id,
      board_id: boardId,
      session_id: activeSessionRef.current,
      type: 'rectangle',
      x: center.x - 100,
      y: center.y - 75,
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
  }, [boardId, createObject, objects.length, activeColor, getViewportCenter, activeSessionRef])

  const handleCreateCircle = useCallback(async (id?: string) => {
    const center = getViewportCenter()
    await createObject({
      id,
      board_id: boardId,
      session_id: activeSessionRef.current,
      type: 'circle',
      x: center.x - 100,
      y: center.y - 100,
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
  }, [boardId, createObject, objects.length, activeColor, getViewportCenter, activeSessionRef])

  const handleCreateLine = useCallback(async (id?: string) => {
    const center = getViewportCenter()
    await createObject({
      id,
      board_id: boardId,
      session_id: activeSessionRef.current,
      type: 'line',
      x: center.x - 100,
      y: center.y - 50,
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
  }, [boardId, createObject, objects.length, activeColor, getViewportCenter, activeSessionRef])

  const handleCreateText = useCallback(async (id?: string) => {
    const center = getViewportCenter()
    await createObject({
      id,
      board_id: boardId,
      session_id: activeSessionRef.current,
      type: 'text',
      x: center.x - 100,
      y: center.y - 20,
      width: 200,
      height: 40,
      rotation: 0,
      z_index: objectsRef.current.length,
      data: { text: 'New text', fontSize: 18, color: '#333333' } satisfies TextData,
    })
  }, [boardId, createObject, getViewportCenter, activeSessionRef])

  const handleCreateFrame = useCallback(async (id?: string) => {
    const center = getViewportCenter()
    await createObject({
      id,
      board_id: boardId,
      session_id: activeSessionRef.current,
      type: 'frame',
      x: center.x - 200,
      y: center.y - 150,
      width: 400,
      height: 300,
      rotation: 0,
      z_index: -(objectCounts.frames + 1),  // negative so frames stay behind all regular objects
      data: { title: 'New Frame', backgroundColor: activeColor } satisfies FrameData,
    })
  }, [boardId, createObject, objectCounts.frames, activeColor, getViewportCenter, activeSessionRef])

  const handleCreateConnector = useCallback((toId: string) => {
    if (!connectorMode) return
    createObject({
      board_id: boardId,
      session_id: activeSessionRef.current,
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
  }, [connectorMode, createObject, activeSessionRef])

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

  // Build journey context for AI when in a coaching journey
  const journeyContext = useMemo(() => {
    if (!isJourney) return null
    const activeGoals = objects
      .filter(o => o.type === 'goal')
      .map(o => {
        const d = o.data as GoalData
        return { title: d.title, status: d.status, commitments: d.commitments }
      })
    const activeSession = sessions.find(s => s.status === 'active')
    const recentSummaries = sessions
      .filter(s => s.status === 'completed' && s.summary)
      .slice(-3)
      .map(s => ({ session_number: s.session_number, summary: s.summary! }))
    return {
      clientName: clientName ?? undefined,
      currentSessionNumber: activeSession?.session_number,
      activeGoals,
      recentSummaries,
    }
  }, [isJourney, objects, sessions, clientName])

  const { messages: aiMessages, suggestions: aiSuggestions, isProcessing: aiIsProcessing, sendMessage: aiSendMessage, clearChat: aiClearChat, generateSessionSummary } = useAIAgent({
    boardId,
    objects,
    createObject,
    updateObject,
    journeyContext,
  })
  generateSummaryRef.current = generateSessionSummary

  // --- Apply coaching framework template ---
  const handleApplyTemplate = useCallback(async (templateId: string) => {
    const template = COACHING_TEMPLATES.find(t => t.id === templateId)
    if (!template) return

    const openArea = findOpenArea(objects)
    const baseX = openArea.x
    const baseY = openArea.y

    // Sort slots: frames first (negative zIndexOffset) so they render behind
    const sorted = [...template.slots].sort((a, b) => a.zIndexOffset - b.zIndexOffset)

    for (const slot of sorted) {
      const id = crypto.randomUUID()
      const baseZ = objects.length
      await createObject({
        id,
        board_id: boardId,
        type: slot.type,
        x: baseX + slot.offsetX,
        y: baseY + slot.offsetY,
        width: slot.width,
        height: slot.height,
        rotation: 0,
        z_index: slot.type === 'frame'
          ? slot.zIndexOffset - objectCounts.frames
          : baseZ + slot.zIndexOffset,
        data: slot.data as unknown as BoardObject['data'],
      })
    }
  }, [objects, createObject, boardId, objectCounts.frames])

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
      style={{ cursor: connectorMode ? 'crosshair' : 'default', paddingRight: aiPanelOpen ? 350 : 0, paddingLeft: goalsSidebarOpen ? 300 : 0 }}
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
        <BoardStage onCursorMove={handleCursorMove} onStageClick={() => { setContextMenu(null); if (connectorMode) { setConnectorMode(null) } else { clearSelection() } }} onStageTransformChange={setStageTransform} onMarqueeSelect={handleMarqueeSelect} onResetZoomRef={resetZoomRef} panTo={panTo}>
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
        onApplyTemplate={handleApplyTemplate}
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

      {/* Journey: Timeline Strip */}
      {isJourney && (
        <TimelineStrip
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSessionClick={handleSessionClick}
          onStartSession={handleStartSession}
          onEndSession={handleEndSession}
          hasActiveSession={hasActiveSession}
          isCoach={isCoach}
        />
      )}

      {/* Journey: Goals Sidebar */}
      {isJourney && (
        <GoalsSidebar
          isOpen={goalsSidebarOpen}
          onClose={() => setGoalsSidebarOpen(false)}
          objects={objects}
          onGoalClick={handleGoalClick}
          onStatusChange={handleGoalStatusChange}
        />
      )}

      {/* Journey: Goals toggle button */}
      {isJourney && !goalsSidebarOpen && (
        <button
          onClick={() => setGoalsSidebarOpen(true)}
          className="fixed bottom-20 left-4 z-20 w-10 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center transition"
          title="Open Goals"
        >
          🎯
        </button>
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
        templates={COACHING_TEMPLATES}
        onApplyTemplate={handleApplyTemplate}
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
