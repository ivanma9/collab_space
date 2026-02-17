/**
 * useSelection - Manages object selection state
 *
 * Selection is local-only (not synced) since each user has independent selection state
 */

import { useState, useCallback } from 'react'

interface UseSelectionReturn {
  selectedIds: Set<string>
  selectObject: (id: string, multiSelect?: boolean) => void
  deselectObject: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
}

export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectObject = useCallback((id: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedIds((prev) => new Set(prev).add(id))
    } else {
      setSelectedIds(new Set([id]))
    }
  }, [])

  const deselectObject = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  return {
    selectedIds,
    selectObject,
    deselectObject,
    toggleSelection,
    clearSelection,
    isSelected,
  }
}
