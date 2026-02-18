# Guest Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Continue as Guest" button to the login page that creates an anonymous Supabase session with an auto-generated display name like "Guest #4823".

**Architecture:** Use Supabase's built-in anonymous auth (`signInAnonymously()`), which creates a real auth session so all existing RLS policies and realtime features work without any changes. The guest display name is randomly generated and stored in user metadata at sign-in time.

**Tech Stack:** React, Supabase JS client (`@supabase/supabase-js`), TypeScript, Tailwind CSS

---

## Prerequisites

Enable anonymous sign-ins in the Supabase dashboard:
1. Go to your Supabase project → Authentication → Settings
2. Toggle **"Allow anonymous sign-ins"** to ON
3. Save

---

### Task 1: Add `signInAsGuest` to AuthContext

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

**Step 1: Add `signInAsGuest` to the interface**

In `AuthContext.tsx`, update the `AuthContextValue` interface:

```typescript
interface AuthContextValue {
  user: User | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signInAsGuest: () => Promise<void>   // <-- add this
  signOut: () => Promise<void>
  displayName: string
  avatarUrl: string | null
}
```

**Step 2: Add the `signInAsGuest` function**

After the `signInWithGoogle` function, add:

```typescript
const signInAsGuest = async () => {
  const guestNumber = Math.floor(1000 + Math.random() * 9000)
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: `Guest #${guestNumber}` } },
  })
  if (error) throw error
}
```

**Step 3: Update `displayName` derivation to handle anonymous users**

Replace the existing `displayName` line with:

```typescript
const displayName =
  user?.user_metadata?.['display_name'] ??
  user?.user_metadata?.['full_name'] ??
  user?.user_metadata?.['name'] ??
  user?.email?.split('@')[0] ??
  'Anonymous'
```

(Putting `display_name` first covers guest users; Google users don't set that key so they fall through to `full_name`/`name` as before.)

**Step 4: Expose `signInAsGuest` in the provider**

Update the `AuthContext.Provider` value:

```typescript
<AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signInAsGuest, signOut, displayName, avatarUrl }}>
```

**Step 5: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: add signInAsGuest via Supabase anonymous auth"
```

---

### Task 2: Add "Continue as Guest" button to LoginPage

**Files:**
- Modify: `src/pages/LoginPage.tsx`

**Step 1: Pull `signInAsGuest` from the auth context**

Update the destructure on line 5:

```typescript
const { signInWithGoogle, signInAsGuest } = useAuth()
```

**Step 2: Add a separate pending state for guest sign-in**

Below the existing `isPending` state, add:

```typescript
const [isGuestPending, setIsGuestPending] = useState(false)
```

**Step 3: Add `handleGuestSignIn` handler**

After `handleSignIn`, add:

```typescript
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
```

**Step 4: Add the guest button to the JSX**

Below the existing Google button (and above the `authError` paragraph), add:

```tsx
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
```

**Step 5: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "feat: add Continue as Guest button to LoginPage"
```

---

## Manual Testing Checklist

1. Open the app — the login page should now show a "Continue as Guest" button below the Google button with an "or" divider
2. Click "Continue as Guest" — button should briefly say "Starting session..." then the board loads
3. Check the display name shown in the app — it should be `Guest #XXXX` (4-digit number)
4. No avatar photo should appear (avatar will be `null`, so whatever the app shows for no-avatar users)
5. Confirm realtime/cursors work: open two tabs, both as guests, move cursor in one — should appear in the other
6. Sign out and sign back in with Google — confirm Google login still works normally
