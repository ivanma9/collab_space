import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface BoardOperation {
  tool: string
  params: Record<string, unknown>
}

interface UseAIAgentOptions {
  boardId: string
  onOperation: (op: BoardOperation) => Promise<void>
}

export function useAIAgent({ boardId, onOperation }: UseAIAgentOptions) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const executeCommand = useCallback(async (command: string) => {
    setIsProcessing(true)
    setError(null)
    setLastResult(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-agent', {
        body: { command, boardId },
      })

      if (fnError) throw fnError

      const operations: BoardOperation[] = data?.operations ?? []

      for (const op of operations) {
        await onOperation(op)
      }

      setLastResult(`Done — ${operations.length} operation${operations.length === 1 ? '' : 's'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI command failed')
    } finally {
      setIsProcessing(false)
    }
  }, [boardId, onOperation])

  return { executeCommand, isProcessing, lastResult, error }
}
