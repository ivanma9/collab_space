import { useEffect, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LoginPage } from './LoginPage'

export function JoinPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return <JoinPageInner userId={user.id} />
}

function JoinPageInner({ userId }: { userId: string }) {
  const { code } = useParams({ from: '/join/$code' })
  const navigate = useNavigate()
  const [status, setStatus] = useState<'joining' | 'error'>('joining')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    join()
  }, [code, userId])

  async function join() {
    // Look up board by invite code
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('invite_code', code.toUpperCase())
      .single()

    if (boardError || !board) {
      setStatus('error')
      setErrorMsg('Invalid invite code. Please check and try again.')
      return
    }

    // Add user as editor (ignore conflict if already a member)
    const { error: memberError } = await supabase
      .from('board_members')
      .insert({ board_id: board.id, user_id: userId, role: 'editor' })

    // UNIQUE constraint violation (code 23505) means already a member — that's fine
    if (memberError && memberError.code !== '23505') {
      setStatus('error')
      setErrorMsg(memberError.message)
      return
    }

    navigate({ to: '/board/$boardId', params: { boardId: board.id } })
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-sm w-full text-center space-y-4">
          <p className="text-red-600 font-medium">{errorMsg}</p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Joining board...</div>
    </div>
  )
}
