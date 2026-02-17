import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { signInWithGoogle, isLoading } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-gray-900">CollabBoard</h1>
        <p className="text-gray-500 text-center">Real-time collaborative whiteboard</p>
        <button
          onClick={signInWithGoogle}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
