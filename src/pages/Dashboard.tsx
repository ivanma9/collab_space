import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LoginPage } from './LoginPage'
import type { BoardObject, Board } from '../lib/database.types'
import { BoardCard } from '../components/BoardCard'

const EMPTY_OBJECTS: BoardObject[] = []

export function Dashboard() {
  const { user, displayName, signOut, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return <DashboardInner userId={user.id} displayName={displayName} signOut={signOut} />
}

function DashboardInner({ userId, displayName, signOut }: {
  userId: string
  displayName: string
  signOut: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Board[]>([])
  const [boardObjects, setBoardObjects] = useState<Record<string, BoardObject[]>>({})
  const [newBoardName, setNewBoardName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('board_members')
      .select('boards(id, name, invite_code, created_by, created_at)')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) { setError(error.message); return }
        const boardList = (data ?? [])
          .map((row: any) => row.boards)
          .filter(Boolean) as Board[]
        setBoards(boardList)
        if (boardList.length > 0) {
          const ids = boardList.map(b => b.id)
          supabase
            .from('board_objects')
            .select('*')
            .in('board_id', ids)
            .limit(500)
            .then(({ data, error: objError }) => {
              if (objError) { setError(objError.message); return }
              if (!data) return
              const grouped: Record<string, BoardObject[]> = {}
              for (const obj of data) {
                if (!grouped[obj.board_id]) grouped[obj.board_id] = []
                grouped[obj.board_id]!.push({ ...obj, data: obj.data } as unknown as BoardObject)
              }
              setBoardObjects(grouped)
            })
        }
      })
  }, [userId])

  async function handleCreateBoard() {
    if (!newBoardName.trim()) return
    setIsCreating(true)
    setError(null)
    const { data, error } = await supabase
      .from('boards')
      .insert({ name: newBoardName.trim(), created_by: userId })
      .select()
      .single()

    setIsCreating(false)
    if (error) { setError(error.message); return }
    navigate({ to: '/board/$boardId', params: { boardId: data.id } })
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    navigate({ to: '/join/$code', params: { code } })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8" data-testid="dashboard">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">My Boards</h1>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out ({displayName})
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded">{error}</div>
        )}

        {/* Create Board */}
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold text-gray-700">Create a new board</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateBoard()}
              placeholder="Board name..."
              data-testid="new-board-name-input"
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleCreateBoard}
              disabled={isCreating || !newBoardName.trim()}
              data-testid="create-board-button"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm rounded font-medium transition"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        {/* Join Board */}
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold text-gray-700">Join a board</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Enter invite code (e.g. ABC12345)..."
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-mono"
            />
            <button
              onClick={handleJoin}
              disabled={!joinCode.trim()}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white text-sm rounded font-medium transition"
            >
              Join
            </button>
          </div>
        </div>

        {/* Board Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.length === 0 ? (
            <p className="col-span-full text-gray-400 text-sm text-center py-8">
              No boards yet. Create one or join with a code.
            </p>
          ) : (
            boards.map(board => (
              <BoardCard
                key={board.id}
                id={board.id}
                name={board.name}
                inviteCode={board.invite_code}
                objects={boardObjects[board.id] ?? EMPTY_OBJECTS}
                onClick={() => navigate({ to: '/board/$boardId', params: { boardId: board.id } })}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
