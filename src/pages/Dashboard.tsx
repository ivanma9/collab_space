import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LoginPage } from './LoginPage'

type Board = {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export function Dashboard() {
  const { user, displayName, signOut, isLoading } = useAuth()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return <DashboardInner userId={user.id} displayName={displayName} signOut={signOut} navigate={navigate} />
}

function DashboardInner({ userId, displayName, signOut, navigate }: {
  userId: string
  displayName: string
  signOut: () => Promise<void>
  navigate: ReturnType<typeof useNavigate>
}) {
  const [boards, setBoards] = useState<Board[]>([])
  const [newBoardName, setNewBoardName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadBoards()
  }, [userId])

  async function loadBoards() {
    const { data, error } = await supabase
      .from('board_members')
      .select('boards(id, name, invite_code, created_by, created_at)')
      .eq('user_id', userId)

    if (error) { setError(error.message); return }
    const boardList = (data ?? [])
      .map((row: any) => row.boards)
      .filter(Boolean) as Board[]
    setBoards(boardList)
  }

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
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
              className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleCreateBoard}
              disabled={isCreating || !newBoardName.trim()}
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

        {/* Board List */}
        <div className="space-y-3">
          {boards.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              No boards yet. Create one or join with a code.
            </p>
          ) : (
            boards.map(board => (
              <button
                key={board.id}
                onClick={() => navigate({ to: '/board/$boardId', params: { boardId: board.id } })}
                className="w-full bg-white rounded-xl shadow px-6 py-4 text-left hover:shadow-md transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800 group-hover:text-blue-600 transition">
                      {board.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Code: <span className="font-mono">{board.invite_code}</span>
                    </p>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-400 transition">→</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
