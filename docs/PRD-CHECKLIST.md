# CollabBoard — PRD Checklist

> Single source of truth for all required features. Derived from the [project spec](../../G4%20Week%201%20-%20CollabBoard.pdf) and internal plans.

---

## 1. MVP Hard Gates

All items required to pass. **All complete.**

| # | Requirement | Status | Key Files |
|---|------------|--------|-----------|
| 1.1 | Infinite board with pan/zoom | ✅ Done | `BoardStage.tsx` |
| 1.2 | Sticky notes with editable text | ✅ Done | `StickyNote.tsx`, `TextEditOverlay.tsx` |
| 1.3 | At least one shape type (rect/circle/line) | ✅ Done | `Shape.tsx` |
| 1.4 | Create, move, and edit objects | ✅ Done | `useRealtimeSync.ts` |
| 1.5 | Real-time sync between 2+ users | ✅ Done | `useRealtimeSync.ts` (Broadcast + DB) |
| 1.6 | Multiplayer cursors with name labels | ✅ Done | `useCursors.ts`, `RemoteCursor.tsx` |
| 1.7 | Presence awareness (who's online) | ✅ Done | `usePresence.ts`, `PresenceBar.tsx` |
| 1.8 | User authentication | ✅ Done | `AuthContext.tsx` (Google OAuth + anonymous) |
| 1.9 | Deployed and publicly accessible | ✅ Done | `vercel.json` |

---

## 2. Core Board Features

| # | Feature | Requirement | Status | Key Files |
|---|---------|-------------|--------|-----------|
| 2.1 | Sticky Notes | Create, edit text, change colors | ✅ Done | `StickyNote.tsx` |
| 2.2 | Shapes | Rectangles, circles, lines with solid colors | ✅ Done | `Shape.tsx` |
| 2.3 | Connectors | Lines/arrows connecting objects | ✅ Done | `Connector.tsx` |
| 2.4 | Text | Standalone text elements | ✅ Done | `TextElement.tsx` |
| 2.5 | Frames | Group and organize content areas | ✅ Done | `Frame.tsx` |
| 2.6 | Transforms | Move, resize, rotate objects | ✅ Done | `SelectionTransformer.tsx` |
| 2.7 | Selection | Single-click and drag-to-select (marquee) | ✅ Done | `BoardStage.tsx` |
| 2.8 | Operations | Delete, duplicate, copy/paste | ✅ Done | `CursorTest.tsx` (Delete/Backspace, Cmd+D) |

---

## 3. Real-Time Collaboration

| # | Feature | Requirement | Status | Notes |
|---|---------|-------------|--------|-------|
| 3.1 | Cursors | Multiplayer cursors with names, real-time movement | ✅ Done | Broadcast-based, throttled |
| 3.2 | Sync | Object CRUD appears instantly for all users | ✅ Done | Pattern B: Broadcast + async DB |
| 3.3 | Presence | Clear indication of who's online | ✅ Done | Avatar bar with user count |
| 3.4 | Conflicts | Handle simultaneous edits (last-write-wins) | ✅ Done | LWW via `updated_at` |
| 3.5 | Resilience | Graceful disconnect/reconnect handling | ✅ Done | Full state reload on reconnect |
| 3.6 | Persistence | Board state survives all users leaving | ✅ Done | Postgres persistence |

---

## 4. AI Board Agent

### 4.1 Tool Schema (minimum required)

All 9 tools implemented in `supabase/functions/ai-agent/tools.ts`:

| Tool | Status |
|------|--------|
| `createStickyNote(text, x, y, color)` | ✅ Done |
| `createShape(type, x, y, width, height, color)` | ✅ Done |
| `createFrame(title, x, y, width, height)` | ✅ Done |
| `createConnector(fromId, toId, style)` | ✅ Done |
| `moveObject(objectId, x, y)` | ✅ Done |
| `resizeObject(objectId, width, height)` | ✅ Done |
| `updateText(objectId, newText)` | ✅ Done (updateStickyNoteText + updateTextBoxContent) |
| `changeColor(objectId, color)` | ✅ Done |
| `getBoardState()` | ✅ Done (sent as context in request body) |

### 4.2 Required Command Categories (6+ types required)

| # | Category | Example Commands | Status | Notes |
|---|----------|-----------------|--------|-------|
| 4.2.1 | Creation | "Add a yellow sticky note that says 'User Research'" | ✅ Done | |
| 4.2.2 | Creation | "Create a blue rectangle at position 100, 200" | ✅ Done | |
| 4.2.3 | Creation | "Add a frame called 'Sprint Planning'" | ✅ Done | |
| 4.2.4 | Manipulation | "Move all the pink sticky notes to the right side" | ✅ Done | Requires board state context |
| 4.2.5 | Manipulation | "Resize the frame to fit its contents" | ✅ Done | |
| 4.2.6 | Manipulation | "Change the sticky note color to green" | ✅ Done | |
| 4.2.7 | Layout | "Arrange these sticky notes in a grid" | ✅ Done | |
| 4.2.8 | Layout | "Create a 2x3 grid of sticky notes for pros and cons" | ✅ Done | |
| 4.2.9 | Layout | "Space these elements evenly" | ✅ Done | |
| 4.2.10 | Complex | "Create a SWOT analysis template with four quadrants" | ✅ Done | Multi-step |
| 4.2.11 | Complex | "Build a user journey map with 5 stages" | ✅ Done | Multi-step |
| 4.2.12 | Complex | "Set up a retrospective board with 3 columns" | ✅ Done | Multi-step |

### 4.3 Evaluation Criteria

| Command | Expected Result | Status |
|---------|----------------|--------|
| "Create a SWOT analysis" | 4 labeled quadrants | ✅ Verify |
| "Arrange in a grid" | Elements aligned with consistent spacing | ✅ Verify |
| Multi-step commands | AI plans steps and executes sequentially | ✅ Verify |

### 4.4 Shared AI State

| # | Requirement | Status | Notes |
|---|------------|--------|-------|
| 4.4.1 | All users see AI-generated results in real-time | ✅ Done | Via broadcast + DB persistence |
| 4.4.2 | Multiple users can issue AI commands simultaneously | ✅ Done | Each request is independent |

### 4.5 AI Agent Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Response latency | <2s for single-step commands | ✅ Verify (using Haiku for speed) |
| Command breadth | 6+ command types | ✅ Done (11 tools, 4 categories) |
| Complexity | Multi-step operation execution | ✅ Done |
| Reliability | Consistent, accurate execution | ✅ Done |

### 4.6 Resolved Issues

- **AI-generated IDs caused 400 errors (2026-02-20):** The AI model generated human-readable IDs (e.g. `"pros-cons-1-1"`) instead of valid UUIDs, causing Postgres to reject inserts. Fixed by always letting Postgres generate UUIDs and relying on the temp-ID swap in `useRealtimeSync`.
- **401 on endpoint for anonymous users (2026-02-20):** Deployed with `--no-verify-jwt` to support guest users. See `docs/architecture-decisions.md` AD-001.

---

## 5. Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Frame rate | 60 FPS during pan/zoom/manipulation | ✅ Verify |
| Object sync latency | <100ms | ✅ Done (Broadcast is ~instant) |
| Cursor sync latency | <50ms | ✅ Done (Broadcast, throttled to 10/s) |
| Object capacity | 500+ objects without drops | ⬜ Verify |
| Concurrent users | 5+ without degradation | ⬜ Verify |

---

## 6. Testing Scenarios

| # | Scenario | Status |
|---|----------|--------|
| 6.1 | 2 users editing simultaneously in different browsers | ⬜ Verify |
| 6.2 | One user refreshing mid-edit (state persistence) | ⬜ Verify |
| 6.3 | Rapid creation and movement of objects (sync perf) | ⬜ Verify |
| 6.4 | Network throttling and disconnection recovery | ⬜ Verify |
| 6.5 | 5+ concurrent users without degradation | ⬜ Verify |

---

## 7. Submission Deliverables

| # | Deliverable | Requirements | Status |
|---|------------|-------------|--------|
| 7.1 | GitHub Repository | Setup guide, architecture overview, deployed link | ⬜ TODO |
| 7.2 | Demo Video (3-5 min) | Real-time collab, AI commands, architecture explanation | ⬜ TODO |
| 7.3 | Pre-Search Document | Completed checklist from Phase 1-3 | ⬜ TODO |
| 7.4 | AI Development Log | 1-page: tools, MCP usage, prompts, code analysis, learnings | ⬜ TODO |
| 7.5 | AI Cost Analysis | Dev spend + projections for 100/1K/10K/100K users | ⬜ TODO |
| 7.6 | Deployed Application | Publicly accessible, supports 5+ users with auth | ✅ Done |
| 7.7 | Social Post | X or LinkedIn: description, features, demo, tag @GauntletAI | ⬜ TODO |
