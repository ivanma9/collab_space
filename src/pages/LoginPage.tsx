import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { signInWithGoogle, signInAsGuest } = useAuth()
  const [isPending, setIsPending] = useState(false)
  const [isGuestPending, setIsGuestPending] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setIsPending(true)
    setAuthError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
      setIsPending(false)
    }
    // Note: if sign-in succeeds, the page redirects — setIsPending(false) won't run
  }

  const handleGuestSignIn = async () => {
    setIsGuestPending(true)
    setAuthError(null)
    try {
      await signInAsGuest()
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not start guest session. Please try again.')
      setIsGuestPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-gray-900">CollabBoard</h1>
        <p className="text-gray-500 text-center">Real-time collaborative whiteboard</p>
        <button
          onClick={handleSignIn}
          disabled={isPending || isGuestPending}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition font-medium text-gray-700"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          {isPending ? 'Signing in...' : 'Sign in with Google'}
        </button>
        <div className="w-full flex items-center gap-3">
          <hr className="flex-1 border-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <hr className="flex-1 border-gray-200" />
        </div>
        <button
          onClick={handleGuestSignIn}
          disabled={isGuestPending || isPending}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-60 transition font-medium text-sm"
        >
          {isGuestPending ? 'Starting session...' : 'Continue as Guest'}
        </button>
        {authError && (
          <p className="text-red-500 text-sm text-center">{authError}</p>
        )}
      </div>
    </div>
  )
}
