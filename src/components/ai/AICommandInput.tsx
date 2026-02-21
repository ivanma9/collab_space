import { useState, useRef, useEffect } from 'react'

interface AICommandInputProps {
  onSubmit: (command: string) => void
  isProcessing: boolean
  lastResult: string | null
  error: string | null
}

const EXAMPLES = [
  'Create a SWOT analysis with 4 labeled frames',
  'Add a sticky note that says "User Research"',
  'Create a 2x3 grid of sticky notes for pros and cons',
  'Set up a retro board: What Went Well, What Didn\'t, Action Items',
]

export function AICommandInput({ onSubmit, isProcessing, lastResult, error }: AICommandInputProps) {
  const [command, setCommand] = useState('')
  const [showExamples, setShowExamples] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-hide examples when typing starts
  useEffect(() => {
    if (command.length > 0) setShowExamples(false)
  }, [command])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = command.trim()
    if (!trimmed || isProcessing) return
    onSubmit(trimmed)
    setCommand('')
    setShowExamples(false)
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-xl px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col-reverse">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0">
          <span className="text-lg select-none">✨</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onFocus={() => setShowExamples(true)}
            onBlur={() => setTimeout(() => setShowExamples(false), 150)}
            placeholder="Ask AI to create or arrange content..."
            className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!command.trim() || isProcessing}
            className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm rounded-lg font-medium transition flex-shrink-0"
          >
            {isProcessing ? '...' : 'Send'}
          </button>
        </form>

        {showExamples && !isProcessing && (
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs text-gray-400 mb-1.5 font-medium">Try:</p>
            <div className="flex flex-wrap gap-1">
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onMouseDown={() => {
                    setCommand(ex)
                    setShowExamples(false)
                    inputRef.current?.focus()
                  }}
                  className="text-xs px-2 py-1 bg-gray-50 hover:bg-purple-50 hover:text-purple-600 rounded-md transition text-gray-600 border border-gray-100"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs text-purple-600 animate-pulse">AI is working on your request...</p>
          </div>
        )}

        {lastResult && !isProcessing && (
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs text-green-600">✓ {lastResult}</p>
          </div>
        )}

        {error && !isProcessing && (
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs text-red-500">✗ {error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
