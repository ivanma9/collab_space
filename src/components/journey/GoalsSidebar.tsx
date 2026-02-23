import { useState, useMemo } from 'react'
import type { BoardObject, GoalData, GoalStatus } from '../../lib/database.types'

type GoalObject = BoardObject & { type: 'goal'; data: GoalData }

interface GoalsSidebarProps {
  isOpen: boolean
  onClose: () => void
  objects: BoardObject[]
  onGoalClick: (goal: GoalObject) => void
  onStatusChange: (goalId: string, newStatus: GoalStatus) => void
}

const STATUS_FILTERS: { value: GoalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
  { value: 'stalled', label: 'Stalled' },
  { value: 'dropped', label: 'Dropped' },
]

const STATUS_COLORS: Record<GoalStatus, string> = {
  active: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  stalled: 'bg-orange-100 text-orange-800',
  dropped: 'bg-gray-100 text-gray-600',
}

const STATUS_DOTS: Record<GoalStatus, string> = {
  active: 'bg-amber-500',
  completed: 'bg-emerald-500',
  stalled: 'bg-orange-500',
  dropped: 'bg-gray-400',
}

const NEXT_STATUS: Record<GoalStatus, GoalStatus> = {
  active: 'completed',
  completed: 'active',
  stalled: 'active',
  dropped: 'active',
}

export function GoalsSidebar({ isOpen, onClose, objects, onGoalClick, onStatusChange }: GoalsSidebarProps) {
  const [filter, setFilter] = useState<GoalStatus | 'all'>('all')

  const goals = useMemo(() =>
    objects.filter((o): o is GoalObject => o.type === 'goal'),
    [objects]
  )

  const filtered = useMemo(() =>
    filter === 'all' ? goals : goals.filter(g => g.data.status === filter),
    [goals, filter]
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: goals.length }
    for (const g of goals) {
      c[g.data.status] = (c[g.data.status] ?? 0) + 1
    }
    return c
  }, [goals])

  if (!isOpen) return null

  return (
    <div className="fixed top-0 left-0 h-full w-[300px] bg-white border-r border-gray-200 shadow-xl z-30 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h2 className="text-sm font-semibold text-gray-800">Goals</h2>
          <span className="text-xs text-gray-400">{goals.length}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded transition"
        >
          ✕
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50 overflow-x-auto">
        {STATUS_FILTERS.map(sf => (
          <button
            key={sf.value}
            onClick={() => setFilter(sf.value)}
            className={`flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
              filter === sf.value
                ? 'bg-gray-800 text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {sf.label}
            {(counts[sf.value] ?? 0) > 0 && (
              <span className="ml-1 opacity-70">{counts[sf.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Goals list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-xs py-8">
            {goals.length === 0 ? 'No goals yet. Create one via AI or the board.' : 'No goals match this filter.'}
          </p>
        )}

        {filtered.map(goal => {
          const completedCount = goal.data.commitments.filter(c => c.startsWith('[x] ')).length
          const totalCount = goal.data.commitments.length

          return (
            <button
              key={goal.id}
              onClick={() => onGoalClick(goal)}
              className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 group-hover:text-amber-800 truncate flex-1">
                  {goal.data.title}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(goal.id, NEXT_STATUS[goal.data.status])
                  }}
                  className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full transition-all ${STATUS_COLORS[goal.data.status]}`}
                  title={`Click to mark as ${NEXT_STATUS[goal.data.status]}`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_DOTS[goal.data.status]}`} />
                  {goal.data.status}
                </button>
              </div>

              {/* Commitments progress */}
              {totalCount > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                    <span>{completedCount}/{totalCount} commitments</span>
                    <span>{Math.round((completedCount / totalCount) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Due date */}
              {goal.data.due_date && (
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Due {new Date(goal.data.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
