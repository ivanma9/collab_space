# Multi-Board Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users create their own boards, and join others' boards via a shareable link (`/join/CODE`) or by typing a short code.

**Architecture:** Add a Dashboard page at `/` (board list + create + join), move the board canvas to `/board/:boardId`, and add a `/join/:code` page that looks up the invite code, adds the user as an editor in `board_members`, then redirects. The `invite_code` column was already added to `boards` via the migration.

**Tech Stack:** React 19, TanStack Router (file-based), Supabase (auth + postgres + RLS), Tailwind CSS, TypeScript.

---

### Task 1: Update the index route to render Dashboard

**Files:**
- Modify: `src/routes/index.ts`

**Step 1: Replace CursorTest with Dashboard import**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "../pages/Dashboard";

export const Route = createFileRoute("/")({
  component: Dashboard,
});
```

**Step 2: Commit**
```bash
git add src/routes/index.ts
git commit -m "feat: route / to Dashboard"
```

---

### Task 2: Create the `/board/$boardId` route

**Files:**
- Create: `src/routes/board.$boardId.ts`

**Step 1: Create the file**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { BoardPage } from "../pages/BoardPage";

export const Route = createFileRoute("/board/$boardId")({
  component: BoardPage,
});
```

**Step 2: Commit**
```bash
git add src/routes/board.\$boardId.ts
git commit -m "feat: add /board/:boardId route"
```

---

### Task 3: Create the `/join/$code` route

**Files:**
- Create: `src/routes/join.$code.ts`

**Step 1: Create the file**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { JoinPage } from "../pages/JoinPage";

export const Route = createFileRoute("/join/$code")({
  component: JoinPage,
});
```

**Step 2: Commit**
```bash
git add src/routes/join.\$code.ts
git commit -m "feat: add /join/:code route"
```

---

### Task 4: Refactor CursorTest to accept boardId prop

`CursorTest` currently hardcodes `TEST_BOARD_ID`. We need it to accept `boardId` as a prop.

**Files:**
- Modify: `src/pages/CursorTest.tsx`

**Step 1: Remove the constant and add boardId prop to both components**

At the top of the file, delete:
```ts
const TEST_BOARD_ID = '00000000-0000-0000-0000-000000000001'
```

Change `CursorTest` signature to accept and pass boardId:
```tsx
export function CursorTest({ boardId }: { boardId: string }) {
  const { user, displayName, avatarUrl, signOut, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <CursorTestInner boardId={boardId} userId={user.id} displayName={displayName} avatarUrl={avatarUrl} signOut={signOut} />
}
```

Change `CursorTestInner` signature to accept boardId:
```tsx
function CursorTestInner({ boardId, userId, displayName, avatarUrl, signOut }: {
  boardId: string
  userId: string
  displayName: string
  avatarUrl: string | null
  signOut: () => Promise<void>
}) {
```

**Step 2: Replace every reference to `TEST_BOARD_ID` inside CursorTestInner with `boardId`**

Search for all occurrences of `TEST_BOARD_ID` inside the function body (there are ~15 in createObject calls and hook calls). Replace each with `boardId`. The hooks already receive it as a variable, so this is a simple find-replace within the function.

**Step 3: Commit**
```bash
git add src/pages/CursorTest.tsx
git commit -m "refactor: CursorTest accepts boardId prop"
```

---

### Task 5: Create BoardPage (thin wrapper that reads route param)

**Files:**
- Create: `src/pages/BoardPage.tsx`

**Step 1: Create the file**

```tsx
import { useParams } from "@tanstack/react-router"
import { CursorTest } from "./CursorTest"

export function BoardPage() {
  const { boardId } = useParams({ from: "/board/$boardId" })
  return <CursorTest boardId={boardId} />
}
```

**Step 2: Commit**
```bash
git add src/pages/BoardPage.tsx
git commit -m "feat: add BoardPage wrapper"
```

---

### Task 6: Create Dashboard page

The dashboard shows the user's boards, lets them create a new board, and lets them enter a join code.

**Files:**
- Create: `src/pages/Dashboard.tsx`

**Step 1: Create the file**

```tsx
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
```

**Step 2: Commit**
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: add Dashboard page with board list, create, and join"
```

---

### Task 7: Create JoinPage

The join page looks up the board by invite code, adds the user as an editor (if not already a member), then redirects to the board.

**Files:**
- Create: `src/pages/JoinPage.tsx`

**Step 1: Create the file**

```tsx
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
```

**Step 2: Commit**
```bash
git add src/pages/JoinPage.tsx
git commit -m "feat: add JoinPage to handle /join/:code"
```

---

### Task 8: Add Share button to the board canvas

When inside a board, the user needs a way to share it. Add a Share button to the info panel in `CursorTest.tsx` that shows the invite code and a copyable link.

**Files:**
- Modify: `src/pages/CursorTest.tsx`

**Step 1: Add state and fetch logic to CursorTestInner**

Add at the top of `CursorTestInner` (after existing state declarations):
```tsx
const [inviteCode, setInviteCode] = useState<string | null>(null)
const [showShare, setShowShare] = useState(false)

useEffect(() => {
  supabase
    .from('boards')
    .select('invite_code')
    .eq('id', boardId)
    .single()
    .then(({ data }) => {
      if (data) setInviteCode(data.invite_code)
    })
}, [boardId])
```

Also add the supabase import at the top of the file:
```tsx
import { supabase } from '../lib/supabase'
```

**Step 2: Add Share button and popover to the JSX**

Inside the info panel `<div className="space-y-2">`, add before the Sign out button:
```tsx
<button
  onClick={() => setShowShare(v => !v)}
  className="w-full px-3 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 rounded text-white font-medium transition"
>
  Share Board
</button>

{showShare && inviteCode && (
  <div className="bg-gray-50 border rounded p-3 space-y-2 text-xs">
    <div>
      <p className="text-gray-500 font-medium mb-1">Invite code</p>
      <p className="font-mono text-lg font-bold text-gray-800 tracking-widest">{inviteCode}</p>
    </div>
    <div>
      <p className="text-gray-500 font-medium mb-1">Invite link</p>
      <button
        onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`)
        }}
        className="w-full text-left bg-white border rounded px-2 py-1 font-mono text-gray-600 hover:bg-gray-100 truncate transition"
        title="Click to copy"
      >
        {window.location.origin}/join/{inviteCode}
      </button>
      <p className="text-gray-400 mt-1">Click link to copy</p>
    </div>
  </div>
)}
```

**Step 3: Add a "Back to Dashboard" link**

In the info panel header area, add a small back link. After the `<h1>` tag:
```tsx
<button
  onClick={() => navigate({ to: '/' })}
  className="text-xs text-blue-500 hover:underline"
>
  ← My Boards
</button>
```

Also add `useNavigate` import and hook at the top of CursorTestInner:
```tsx
import { useNavigate } from '@tanstack/react-router'
// ...inside CursorTestInner:
const navigate = useNavigate()
```

**Step 4: Commit**
```bash
git add src/pages/CursorTest.tsx
git commit -m "feat: add Share button and back-to-dashboard link to board"
```

---

### Task 9: Verify everything works

**Step 1: Start the dev server**
```bash
pnpm dev
```

**Step 2: Manual verification checklist**
- [ ] `/` shows Dashboard (not the board)
- [ ] Creating a board navigates to `/board/:id` and the board loads
- [ ] Share button shows the invite code and copyable link
- [ ] Copying the link and visiting it in a new tab joins the board and redirects to it
- [ ] Entering the code manually in the Dashboard join box works
- [ ] "← My Boards" link returns to dashboard
- [ ] If already a member, the join link still works (no error)
- [ ] Invalid code shows error message

**Step 3: Commit any fixes needed, then final commit**
```bash
git add -A
git commit -m "feat: multi-board support with invite codes and share links"
```
