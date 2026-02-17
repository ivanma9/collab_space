/**
 * CursorTest Page
 *
 * Test page for validating cursor sync latency with Pattern B architecture.
 *
 * Testing Instructions:
 * 1. Open this page in two browser windows side-by-side
 * 2. Move your mouse in one window
 * 3. Observe the cursor appear in the other window
 * 4. Target: Cursor sync should feel instant (<50ms latency)
 */

import { useState, useEffect } from 'react'
import { BoardStage } from '../components/canvas/BoardStage'
import { RemoteCursor } from '../components/canvas/RemoteCursor'
import { StickyNote } from '../components/canvas/StickyNote'
import { useCursors } from '../hooks/useCursors'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useSelection } from '../hooks/useSelection'
import type { BoardObject, StickyNoteData } from '../lib/database.types'

// Generate a mock user ID for testing (in production, this comes from Supabase Auth)
const generateMockUser = () => {
  const storedUserId = localStorage.getItem('test_user_id')
  const storedUserName = localStorage.getItem('test_user_name')

  if (storedUserId && storedUserName) {
    return { id: storedUserId, name: storedUserName }
  }

  const id = `user_${Math.random().toString(36).substring(7)}`
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
  const name = names[Math.floor(Math.random() * names.length)]!

  localStorage.setItem('test_user_id', id)
  localStorage.setItem('test_user_name', name)

  return { id, name }
}

// Fixed test board ID for all users (must be a valid UUID)
const TEST_BOARD_ID = '00000000-0000-0000-0000-000000000001'

export function CursorTest() {
  const [currentUser] = useState(generateMockUser)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

  const { cursors, broadcastCursor, isConnected } = useCursors({
    boardId: TEST_BOARD_ID,
    userId: currentUser.id,
    userName: currentUser.name,
  })

  const { objects, createObject, updateObject, deleteObject, isLoading, error } = useRealtimeSync({
    boardId: TEST_BOARD_ID,
    userId: currentUser.id,
  })

  const { isSelected, selectObject, clearSelection, selectedIds } = useSelection()

  // Delete selected objects on Delete/Backspace key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        selectedIds.forEach((id) => { deleteObject(id) })
        clearSelection()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, deleteObject, clearSelection])

  // Broadcast cursor position whenever it changes
  const handleCursorMove = (x: number, y: number) => {
    setCursorPos({ x, y })
    broadcastCursor(x, y)
  }

  // Create a sticky note at current cursor position
  const handleCreateStickyNote = async () => {
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
        text: 'New sticky note!\nDouble-click to edit (coming soon)',
        color: randomColor,
      },
    })
  }

  // Filter sticky notes from all objects
  const stickyNotes = objects.filter(
    (obj): obj is BoardObject & { type: 'sticky_note'; data: StickyNoteData } =>
      obj.type === 'sticky_note'
  )

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-100">
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
            <strong>Sticky Notes:</strong> {stickyNotes.length}
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
              localStorage.removeItem('test_user_id')
              localStorage.removeItem('test_user_name')
              window.location.reload()
            }}
            className="w-full px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
          >
            Generate New User ID
          </button>
        </div>
      </div>

      {/* Canvas */}
      <BoardStage onCursorMove={handleCursorMove} onStageClick={clearSelection}>
        {/* Render all sticky notes */}
        {stickyNotes.map((note) => (
          <StickyNote
            key={note.id}
            object={note}
            onUpdate={updateObject}
            onSelect={selectObject}
            isSelected={isSelected(note.id)}
          />
        ))}

        {/* Render all remote cursors */}
        {Array.from(cursors.values()).map((cursor) => (
          <RemoteCursor key={cursor.userId} cursor={cursor} />
        ))}

        {/* Grid background (optional visual aid) */}
        {/* You can add a grid here later for better spatial reference */}
      </BoardStage>

      {/* Latency Warning */}
      {!isConnected && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          ⚠️ Not connected to Supabase Realtime
        </div>
      )}
    </div>
  )
}
