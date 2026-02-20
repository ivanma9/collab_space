# CollabBoard — Architecture & System Design

A real-time collaborative whiteboard. This document explains how everything fits together.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Directory Structure](#2-directory-structure)
3. [Tech Stack](#3-tech-stack)
4. [Authentication Flow](#4-authentication-flow)
5. [Database Schema](#5-database-schema)
6. [Routing](#6-routing)
7. [Real-Time Architecture](#7-real-time-architecture)
8. [Canvas System](#8-canvas-system)
9. [AI Agent](#9-ai-agent)
10. [State Management](#10-state-management)
11. [Key Data Flows](#11-key-data-flows)
12. [Performance Design](#12-performance-design)
13. [Security Model (RLS)](#13-security-model-rls)

---

## 1. High-Level Overview

```mermaid
graph TB
    subgraph Browser["Browser (React + Vite)"]
        UI[React UI]
        Konva[Konva Canvas]
        Hooks[Custom Hooks]
        Auth[AuthContext]
    end

    subgraph Supabase["Supabase (Backend)"]
        DB[(Postgres DB)]
        RT[Realtime Engine]
        SAauth[Auth Service]
        Edge[Edge Functions]
    end

    subgraph External["External Services"]
        Google[Google OAuth]
        Anthropic[Anthropic API]
    end

    UI --> Hooks
    Hooks --> DB
    Hooks --> RT
    Auth --> SAauth
    SAauth --> Google
    Edge --> Anthropic
    Hooks --> Edge
    RT -->|Broadcast / Presence| Browser
    DB -->|RLS-guarded queries| Hooks
```

The app is a single-page React app. The browser communicates with Supabase for:
- **Database reads/writes** — persisting canvas objects
- **Realtime broadcast** — syncing live changes between connected users
- **Presence** — tracking who is online
- **Edge Functions** — running AI commands via Anthropic

---

## 2. Directory Structure

```
collab_space/
├── src/
│   ├── components/
│   │   ├── canvas/         # Konva canvas components (StickyNote, Shape, Frame, ...)
│   │   ├── ai/             # AICommandInput
│   │   ├── presence/       # PresenceBar (online user avatars)
│   │   └── utils/          # Dev tools
│   ├── hooks/              # Core business logic
│   │   ├── useRealtimeSync.ts   # Object CRUD + broadcast
│   │   ├── useCursors.ts        # Live cursor positions
│   │   ├── usePresence.ts       # Who is online
│   │   ├── useSelection.ts      # Selected object IDs (local only)
│   │   └── useAIAgent.ts        # AI command execution
│   ├── pages/
│   │   ├── Dashboard.tsx        # Board listing
│   │   ├── CursorTest.tsx       # Main board canvas (misleading name)
│   │   ├── BoardPage.tsx        # Route wrapper → redirects to CursorTest
│   │   ├── LoginPage.tsx
│   │   └── JoinPage.tsx         # Handles invite code links
│   ├── routes/             # TanStack Router file-based routes
│   ├── contexts/
│   │   └── AuthContext.tsx # Supabase auth + user display name
│   └── lib/
│       ├── supabase.ts         # Supabase client
│       └── database.types.ts   # TypeScript DB types (generated)
├── supabase/
│   ├── migrations/         # SQL (run in order: 001 → 004)
│   └── functions/
│       └── ai-agent/       # Deno edge function → Anthropic API
└── e2e/                    # Playwright tests
```

---

## 3. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| UI framework | React 19 | Component model, concurrent features |
| Language | TypeScript 5.9 | Type safety across the stack |
| Build tool | Vite 7 | Fast HMR during development |
| Styling | Tailwind CSS v4 | Utility-first, no CSS files needed |
| Canvas | react-konva | 2D canvas with React component API |
| Routing | TanStack Router | File-based, fully typed route params |
| Server state | TanStack Query | Caching + refetch for DB queries |
| Global state | Zustand | Lightweight store, minimal boilerplate |
| Backend | Supabase | Postgres + Auth + Realtime + Edge Functions |
| Edge runtime | Deno | AI edge function |
| AI model | Claude Haiku 4.5 | Tool-use for canvas manipulation |
| Tests | Vitest + Playwright | Unit and E2E |
| Package manager | pnpm | Faster installs, strict dependencies |

---

## 4. Authentication Flow

```mermaid
flowchart TD
    Start([App loads]) --> CheckSession{Session in\nlocalStorage?}
    CheckSession -->|Yes| SetUser[Set user state]
    CheckSession -->|No| ShowLogin[Show LoginPage]

    ShowLogin --> GoogleBtn[Click: Sign in with Google]
    ShowLogin --> GuestBtn[Click: Continue as Guest]

    GoogleBtn --> OAuthRedirect[supabase.auth.signInWithOAuth]
    OAuthRedirect --> Google[Google OAuth redirect]
    Google --> Callback[Return to app with session]

    GuestBtn --> Anon[supabase.auth.signInAnonymously]
    Anon --> GuestName[Assign 'Guest #XXXX' display name]

    Callback --> AuthChange[onAuthStateChange fires]
    GuestName --> AuthChange

    SetUser --> Dashboard[Redirect to Dashboard]
    AuthChange --> Dashboard

    Dashboard --> BoardRoute[Navigate to /board/:boardId]
    BoardRoute --> LoadBoard[Load board objects from DB]
```

**Where it lives:** `src/contexts/AuthContext.tsx`

The `AuthContext` wraps the whole app. Every component can call `useAuth()` to get the current user, sign out, etc. The `onAuthStateChange` subscription keeps the React state in sync with Supabase's session automatically — even across browser refreshes.

**Display name priority:** `display_name` → `full_name` → `name` → `email` → `"Anonymous"`

---

## 5. Database Schema

```mermaid
erDiagram
    boards {
        uuid id PK
        text name
        text invite_code
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    board_members {
        uuid id PK
        uuid board_id FK
        uuid user_id FK
        text role
        timestamptz joined_at
    }

    board_objects {
        uuid id PK
        uuid board_id FK
        text type
        float8 x
        float8 y
        float8 width
        float8 height
        float8 rotation
        int z_index
        jsonb data
        timestamptz created_at
        timestamptz updated_at
    }

    boards ||--o{ board_members : "has"
    boards ||--o{ board_objects : "contains"
```

### The `board_objects.data` JSONB Column

Every canvas object shares the same row structure (`x`, `y`, `width`, `height`, `rotation`, `z_index`), but type-specific fields live in the `data` JSON column:

```mermaid
graph LR
    BoardObject["board_objects row"]
    BoardObject --> common["x, y, width, height, rotation, z_index"]
    BoardObject --> type["type: 'sticky_note' | 'shape' | 'frame' | ..."]
    BoardObject --> data["data: JSONB"]

    data --> SN["sticky_note:\n{ text, color }"]
    data --> SH["shape:\n{ shapeType, fillColor, strokeColor }"]
    data --> FR["frame:\n{ title, fillColor }"]
    data --> CN["connector:\n{ fromId, toId, style }"]
    data --> TX["text:\n{ content, fontSize, color }"]
```

In TypeScript this becomes a **discriminated union** — safe type narrowing:

```typescript
// If obj.type === 'sticky_note', TypeScript knows obj.data has .text and .color
type BoardObject =
  | (Base & { type: 'sticky_note'; data: { text: string; color: string } })
  | (Base & { type: 'shape';       data: { shapeType: string; fillColor: string } })
  | (Base & { type: 'connector';   data: { fromId: string; toId: string } })
  // ...
```

---

## 6. Routing

TanStack Router uses **file-based routing** — the file name _is_ the route pattern.

```
src/routes/
├── __root.ts         →  /           (root layout)
├── index.ts          →  /           (Dashboard)
├── board.$boardId.ts →  /board/:boardId
└── join.$code.ts     →  /join/:code
```

**Never edit `src/routeTree.gen.ts` manually.** It is auto-generated by TanStack Router when you run `vite dev`. Route params are fully typed — `boardId` and `code` come through as `string`.

```mermaid
graph LR
    Root["/"] --> Dashboard[Dashboard\nList & create boards]
    Root --> Board["/board/:boardId\nMain canvas"]
    Root --> Join["/join/:code\nInvite link handler"]

    Board --> CursorTest[CursorTest.tsx\nActual canvas UI]
    Join --> AddMember[Add user to board_members]
    AddMember --> Board
```

---

## 7. Real-Time Architecture

This is the most complex part of the system. Understanding it is key to understanding the whole app.

### Two Channels Per Board Session

```mermaid
graph TB
    subgraph ClientA["Client A (you)"]
        HookA[useRealtimeSync]
        CursorA[useCursors]
        PresA[usePresence]
    end

    subgraph Supabase_RT["Supabase Realtime"]
        BroadcastCh["Broadcast Channel\nboard:{boardId}:objects"]
        PresenceCh["Presence Channel\nboard:{boardId}:presence"]
        CursorCh["Broadcast Channel\nboard:{boardId}:cursors"]
    end

    subgraph ClientB["Client B (other user)"]
        HookB[useRealtimeSync]
        CursorB[useCursors]
        PresB[usePresence]
    end

    HookA <-->|object_created\nobject_updated\nobject_deleted\nid_replaced| BroadcastCh
    CursorA <-->|cursor| CursorCh
    PresA <-->|track/untrack| PresenceCh

    BroadcastCh <--> HookB
    CursorCh <--> CursorB
    PresenceCh <--> PresB
```

### Optimistic Update Pattern (Object Sync)

```mermaid
sequenceDiagram
    participant U as User Action
    participant L as Local State
    participant B as Broadcast
    participant DB as Postgres

    U->>L: 1. Add object optimistically (temp ID)
    U->>B: 2. Broadcast object_created to peers
    U->>DB: 3. INSERT into board_objects (async)
    DB-->>L: 4. Replace temp ID with real UUID
    L->>B: 5. Broadcast id_replaced to peers
    Note over U,DB: Other users see it instantly via step 2.<br/>DB is eventually consistent.
```

This is the key tradeoff: **instant visual feedback** (steps 1+2) before the database confirms (step 3). If the DB write fails, the optimistic update is rolled back.

### Why Temp IDs Matter

When the AI creates a connector between two sticky notes, it writes the `fromId` and `toId` into the connector's data _before_ those objects have real DB IDs. The temp ID → real ID broadcast (step 5) ensures connectors stay linked even after IDs change.

### Cursor Sync

```mermaid
sequenceDiagram
    participant Mouse as Mouse Move
    participant Throttle as 50ms Throttle
    participant Ch as Broadcast Channel
    participant Other as Other Clients

    Mouse->>Throttle: mousemove event (fires ~60fps)
    Throttle-->>Throttle: Skip if <50ms since last
    Throttle->>Ch: Send { userId, x, y, color }
    Ch->>Other: Deliver immediately
    Other->>Other: Update cursor Map<userId, pos>
    Note over Mouse,Other: No DB writes. Pure broadcast.
```

Cursors are **never persisted**. They exist only in memory as a `Map<userId, CursorPosition>`. Stale cursors (no update for 5s) are automatically removed.

### Presence

Uses Supabase's built-in **Presence** feature (CRDT-based distributed state):

```typescript
// Track yourself when you join
channel.track({ userId, userName, avatarUrl })

// Listen for the combined state of all online users
channel.on('presence', { event: 'sync' }, () => {
  const users = Object.values(channel.presenceState()).flat()
  setOnlineUsers(users)
})
```

The PresenceBar at the top of the board shows colored circles for each online user.

---

## 8. Canvas System

The canvas is built with **react-konva** — a React wrapper around Konva.js, which renders to an HTML `<canvas>` element.

### Component Hierarchy

```mermaid
graph TD
    CursorTest[CursorTest.tsx\nMain board page]
    CursorTest --> BoardStage

    BoardStage[BoardStage\nKonva.Stage\nPan + Zoom + Marquee]
    BoardStage --> Layer[Konva.Layer]

    Layer --> Frames[Frame components\nNegative z-index, rendered first]
    Layer --> Shapes[Shape components]
    Layer --> StickyNotes[StickyNote components]
    Layer --> Connectors[Connector components]
    Layer --> TextElems[TextElement components]
    Layer --> Cursors[RemoteCursor components]
    Layer --> Transformer[SelectionTransformer\nResize + Rotate handles]

    CursorTest --> TextOverlay[TextEditOverlay\nHTML textarea, absolutely positioned]
```

### BoardStage — Pan and Zoom

```mermaid
flowchart LR
    Wheel[Mouse Wheel] --> Scale["Adjust scale\n(zoom toward pointer)"]
    MiddleClick[Middle Click Drag] --> Pan[Pan the stage]
    BackgroundDrag[Background Drag] --> Marquee[Draw selection rect]
    Marquee --> Intersect[Find overlapping objects]
    Intersect --> SelectMultiple[selectMultiple ids]
```

The stage maintains `stagePos` (x, y offset) and `stageScale` (zoom level). Every object's position is in **canvas coordinates** — (0,0) is top-left, X increases right, Y increases down.

### Object Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Idle: Object rendered
    Idle --> Dragging: mousedown + move
    Dragging --> Idle: mouseup (onDragEnd)
    Idle --> Editing: double-click (sticky note / text)
    Editing --> Idle: blur or Enter key
    Idle --> Selected: click (onSelect)
    Selected --> Transforming: drag transformer handles
    Transforming --> Selected: release (onTransformEnd)
    Selected --> [*]: Delete key (deleteSelected)
```

### ConnectorCanvas — Drawing Lines Between Objects

Connectors find the center points of their `fromId` and `toId` objects at render time:

```
fromObject.x + fromObject.width/2  →  line start
toObject.x + toObject.width/2     →  line end
```

If either object has been deleted, the connector hides itself gracefully.

---

## 9. AI Agent

```mermaid
sequenceDiagram
    participant U as User
    participant Hook as useAIAgent
    participant Edge as Edge Function (Deno)
    participant Claude as Anthropic API
    participant Sync as useRealtimeSync

    U->>Hook: Type "Add a SWOT analysis"
    Hook->>Edge: POST /ai-agent { command, boardState, boardId }
    Edge->>Claude: messages.create with tools + board context
    Claude-->>Edge: tool_use blocks [createFrame x4, createStickyNote x8, ...]
    Edge-->>Hook: { toolCalls: [...] }
    Hook->>Sync: executeToolCall for each call (sequential)
    Sync->>Sync: createObject / updateObject / moveObject
    Note over Sync: Each call does optimistic update + broadcast + DB write
    Hook-->>U: Commands executed, canvas updated
```

### What the AI Knows

The edge function receives the full **current board state** (all objects, their positions, and their text content) as part of the request. Claude uses this to make sensible layout decisions (e.g., placing new objects to the right of existing ones).

### Available Tools

| Tool | What it does |
|------|-------------|
| `createStickyNote` | Add colored note with text |
| `createShape` | Rectangle, circle, or line |
| `createFrame` | Labeled container box |
| `createTextBox` | Standalone text label |
| `createConnector` | Arrow between two objects |
| `moveObject` | Reposition an existing object |
| `resizeObject` | Change width/height |
| `updateStickyNoteText` | Edit sticky note text |
| `updateTextBoxContent` | Edit text element content |
| `changeColor` | Change fill/stroke color |
| `getBoardState` | No-op (state already in prompt) |

---

## 10. State Management

The app uses **three different state mechanisms** for different purposes:

```mermaid
graph TD
    subgraph Local["Component Local State"]
        editing[editingId - which object is being text-edited]
        tool[activeTool - pen, select, etc]
        modal[showShareModal]
    end

    subgraph Selection["useSelection hook (local only)"]
        selectedIds[Set of selected object IDs]
    end

    subgraph Realtime["useRealtimeSync (server-synced)"]
        objects[objects: BoardObject array\nSource of truth for canvas]
    end

    subgraph Presence["usePresence / useCursors"]
        online[onlineUsers: PresenceUser array]
        cursors[cursors: Map&lt;userId, pos&gt;]
    end

    subgraph TanStack["TanStack Query (cached DB)"]
        boardData[board metadata, member list]
    end
```

**Selection is intentionally local** — each user has their own selection that other users cannot see. This mirrors how Figma works.

**`objects` in useRealtimeSync** is the single source of truth for everything on the canvas. It starts by loading all rows from `board_objects` where `board_id = :boardId`, then applies live broadcast updates on top.

---

## 11. Key Data Flows

### Creating a Board

```mermaid
sequenceDiagram
    participant D as Dashboard
    participant DB as Supabase DB
    participant Trigger as DB Trigger

    D->>DB: INSERT into boards (name, invite_code, created_by)
    DB->>Trigger: handle_new_board() fires
    Trigger->>DB: INSERT into board_members (board_id, user_id, role='owner')
    DB-->>D: Return new board row
    D->>D: Navigate to /board/:boardId
```

### Joining via Invite Code

```mermaid
sequenceDiagram
    participant Browser
    participant Join as JoinPage
    participant DB as Supabase DB

    Browser->>Join: Visit /join/:code
    Join->>DB: SELECT id FROM boards WHERE invite_code = :code
    DB-->>Join: board row (or null if invalid)
    Join->>DB: INSERT into board_members (board_id, user_id, role='editor')
    Note over Join: Ignore duplicate if already a member
    Join->>Browser: Redirect to /board/:boardId
```

### Deleting an Object

```mermaid
sequenceDiagram
    participant K as Keyboard
    participant S as useSelection
    participant R as useRealtimeSync
    participant B as Broadcast
    participant DB as Postgres

    K->>S: Delete/Backspace keydown
    S->>R: deleteObject(id) for each selectedId
    R->>S: Remove from local objects array (optimistic)
    R->>B: Broadcast object_deleted { id }
    R->>DB: DELETE FROM board_objects WHERE id = :id
    B->>B: Other clients remove object from their state
```

---

## 12. Performance Design

| Concern | Solution |
|---------|----------|
| Cursor updates flooding server | 50ms throttle = max 20 broadcasts/sec |
| Drag updates flooding DB | Broadcast only during drag, DB write only on dragEnd |
| Realtime overload | Supabase client configured at 10 events/second |
| Marquee false triggers | 4px movement threshold before registering drag |
| Re-renders during transform | Refs track Konva nodes, not React state |
| Frame z-ordering | Negative z_index so frames always render below objects |
| Canvas coordinate system | Everything in canvas space; stage pos/scale applied by Konva |

### The Broadcast-First Strategy

```
Cursor moves  →  Broadcast only  (never touches DB)
Object drag   →  Broadcast during, DB on release
Object create →  Optimistic + Broadcast, then DB async
Object delete →  Optimistic + Broadcast, then DB async
```

The rule: **broadcast for speed, DB for durability**.

---

## 13. Security Model (RLS)

Row Level Security policies in Postgres control every table access. The Supabase anon key used in the frontend cannot bypass them.

```mermaid
graph TD
    Client[Client request with JWT]
    Client --> RLS{RLS Policy Check}

    RLS -->|boards: SELECT| BM1["Is auth.uid() in\nboard_members for this board?"]
    RLS -->|board_objects: SELECT| BM2["Same check"]
    RLS -->|board_objects: INSERT/UPDATE/DELETE| Role["Role = 'owner' OR 'editor'?"]

    BM1 -->|Yes| Allow[Allow]
    BM1 -->|No| Deny[Deny]
    BM2 -->|Yes| Allow
    BM2 -->|No| Deny
    Role -->|Yes| Allow
    Role -->|No| Deny
```

**Auto-triggers ensure consistency:**
- When a board is created, a DB trigger immediately inserts the creator into `board_members` as `owner`
- `updated_at` columns auto-update on every modification

Viewers can read but cannot write. Editors can create/update/delete objects. Only owners can manage board settings and members.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Broadcast** | Supabase Realtime feature for low-latency P2P messages (no persistence) |
| **Presence** | Supabase feature tracking who is currently connected to a channel |
| **RLS** | Row Level Security — Postgres policies that control who can read/write rows |
| **Konva** | JavaScript 2D canvas library; react-konva wraps it for React |
| **Discriminated union** | TypeScript pattern: a type field narrows what other fields exist |
| **Optimistic update** | Updating local UI immediately, before the server confirms success |
| **Temp ID** | `temp_${timestamp}_${random}` placeholder ID before DB assigns a real UUID |
| **Transformer** | Konva component that adds resize/rotate handles to selected objects |
| **TanStack Router** | Type-safe router where file names define route patterns |
| **Edge Function** | Serverless Deno function running on Supabase's infrastructure |
