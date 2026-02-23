# Architecture Decisions

Tracks significant technical tradeoffs and decisions made during development.

---

## AD-001: AI Agent Edge Function — JWT Verification Disabled

**Date:** 2026-02-19
**Status:** Active
**Context:**

The `ai-agent` Supabase Edge Function (`supabase/functions/ai-agent/`) is deployed with `--no-verify-jwt`, meaning Supabase's API gateway does not require a valid JWT token to invoke it.

**Decision:**

Disable JWT verification on the `ai-agent` edge function to support anonymous (guest) users who may not have a full auth session.

**Tradeoff:**

- **Pro:** Anonymous/guest users can use AI commands on the board without authentication barriers.
- **Con:** The endpoint is publicly callable by anyone with the project URL and anon key. There is no server-side authentication gate — any request with a valid `apikey` header will be processed.

**Risks:**

- Abuse potential: unauthenticated callers could invoke the function, consuming Anthropic API credits.
- No per-user rate limiting at the Supabase gateway level.

**Mitigations to consider (future):**

- Add application-level rate limiting inside the edge function (e.g., by IP or by board ID).
- Add a lightweight auth check that accepts both authenticated JWTs and anonymous sessions, rejecting fully unauthenticated requests.
- Monitor Anthropic API usage for unexpected spikes.

---

## AD-002: Dual-Mode Auth — Google OAuth + Supabase Anonymous Users

**Date:** 2026-02-22 (documented retroactively)
**Status:** Active
**Context:**

The app needs to support both authenticated users (Google OAuth) and anonymous guests who can join a board without signing up.

**Decision:**

Use Supabase's `signInAnonymously()` to create real auth users with random UUIDs and metadata like `display_name: "Guest #4291"`. Anonymous users receive real JWTs and can pass RLS policies on `board_objects` and use Presence/Broadcast channels.

**Tradeoff:**

- **Pro:** Anonymous users are first-class citizens — they have real JWTs, pass RLS, and appear in presence. No separate "guest" code path needed.
- **Con:** Anonymous users create persistent rows in `auth.users` that accumulate indefinitely. Supabase does not auto-clean them.

**Implementation detail:**

The `displayName` resolution chain falls through four fallbacks: `display_name` → `full_name` → `name` → email prefix → `"Anonymous"`, handling both OAuth and anonymous metadata formats (`src/contexts/AuthContext.tsx`).

---

## AD-003: Realtime Sync — Broadcast-First, Not Postgres CDC

**Date:** 2026-02-22 (documented retroactively)
**Status:** Active
**Context:**

Supabase offers two realtime mechanisms: Broadcast (pub/sub over WebSocket) and CDC (Postgres WAL-based row change events). The schema enables CDC via `ALTER PUBLICATION supabase_realtime ADD TABLE board_objects`, but the app does not use it for live sync.

**Decision:**

Use Supabase Broadcast for live object sync with a 5-step optimistic update pattern:
1. Optimistic local state update (instant)
2. Broadcast to all peers via `board:${boardId}:objects` (instant, bypasses DB)
3. Async Postgres INSERT/UPDATE/DELETE
4. Temp ID → real DB UUID swap locally
5. Broadcast ID replacement to peers

CDC is retained only as a reconnection recovery path (initial `loadBoardState()` from DB on mount).

**Tradeoff:**

- **Pro:** Lower latency — peers see changes instantly without waiting for DB round-trip through WAL replication.
- **Con:** Peers receive objects before persistence. If DB insert fails, the originating client rolls back but other clients keep the stale object until reconnect. This is a known inconsistency window.
- **Con:** The schema has `updated_at` indexed for last-write-wins conflict resolution, but no LWW logic is currently implemented — updates are applied in broadcast order on each client.

**Key file:** `src/hooks/useRealtimeSync.ts`

---

## AD-004: Layer Ordering — Negative z_index for Frames, Context-Menu-Only Access

**Date:** 2026-02-22 (documented retroactively)
**Status:** Active
**Context:**

Frames should always appear behind other objects. Layer reordering needs a UI surface.

**Decision:**

- Frames are assigned negative `z_index` values (computed as `-(frameCount + 1)`) so they stay behind all non-frame objects without explicit sorting logic.
- Non-frame objects start at `z_index = 0` and increment.
- Layer ordering (Bring to Front / Bring Forward / Send Backward / Send to Back) is exposed only via context menu with keyboard hints (⌘], ], [, ⌘[).
- A toolbar button for layer ordering was added (commit `deea11e`) then deliberately removed (commit `0fc220e`) to avoid toolbar clutter.

**Tradeoff:**

- **Pro:** Frames naturally stay behind without runtime enforcement.
- **Con:** The negative z_index convention is implicit — the DB schema has no constraint. Manually bringing a frame to front can silently break the convention.

**Key files:** `src/hooks/useAIAgent.ts`, `src/pages/CursorTest.tsx`, `src/components/canvas/ContextMenu.tsx`

---

## AD-005: Canvas Rendering — Single Konva Layer, Custom sceneFunc Grid, HTML Overlay HUD

**Date:** 2026-02-22 (documented retroactively)
**Status:** Active
**Context:**

The canvas needs a dot grid background, interactive objects, and an informational HUD (coordinates, zoom level).

**Decision:**

- All objects render in a single Konva `<Layer>` (not separate layers per object type).
- The dot grid uses a single Konva `<Shape>` with a custom `sceneFunc` that draws all dots in one canvas pass, rather than individual `<Circle>` nodes (which would create thousands of Konva objects).
- The coordinate HUD and zoom indicator are HTML `div` overlays (`position: absolute`) over the canvas, not Konva nodes, giving access to DOM text rendering and CSS.

**Tradeoff:**

- **Pro:** Simple architecture, performant grid rendering, clean HUD text.
- **Con:** A single layer means Konva cannot cache or selectively re-render subsets of objects. Any change triggers a full layer redraw. Acceptable for current object counts but would need layer splitting at scale.

**Key files:** `src/components/canvas/BoardStage.tsx`, `src/components/canvas/GridDots.tsx`, `src/components/canvas/CanvasHUD.tsx`

---

## AD-006: AI Agent — Client-Side UUID Generation and Ref-Key Pattern

**Date:** 2026-02-22 (documented retroactively)
**Status:** Active
**Context:**

The AI model returns tool calls describing objects to create, but it cannot generate real UUIDs. Objects may reference each other (e.g., connectors referencing sticky notes).

**Decision:**

- The AI model uses short ref keys (`"s1"`, `"note2"`) in tool call `id` fields.
- The client generates real UUIDs before dispatching `createObject`.
- An `idMap` (`Map<string, string>`) resolves connector `fromId`/`toId` references within the same batch.
- The edge function never generates or stores IDs — it only describes intent.
- The system prompt includes a prompt injection defense: board content is labeled as user data, not instructions.

**Tradeoff:**

- **Pro:** Clean separation — AI describes intent, client handles identity.
- **Con:** Ref-key → UUID resolution only works within a single `executeToolCalls` batch. Cross-turn references by AI ref key fail silently, producing dangling connector endpoints. The model is instructed to use `objectId` from board state for cross-turn references, but this is a prompt-level contract, not enforced in code.

**Key files:** `src/hooks/useAIAgent.ts`, `supabase/functions/ai-agent/index.ts`

---

## AD-007: State Management — Custom Hooks with useState, Not Zustand/TanStack Query

**Date:** 2026-02-22 (documented retroactively)
**Status:** Active
**Context:**

The project was originally planned with Zustand (global state) and TanStack Query (server state), but neither was adopted during implementation.

**Decision:**

All board object state is held in `useState` inside `useRealtimeSync`. Server fetching uses direct `supabase` client calls. TanStack Router is used for routing but TanStack Query is not used for data fetching.

**Tradeoff:**

- **Pro:** No library overhead, simpler mental model for the current scope.
- **Con:** Object state is not globally accessible — it must be prop-drilled or lifted. If a second component tree needs board objects, the pattern would need revisiting (likely by extracting state into Zustand or a React context).

**Key file:** `src/hooks/useRealtimeSync.ts`

---

## AD-008: Braintrust Observability — asyncFlush in Edge Function

**Date:** 2026-02-22 (documented retroactively, enabled in commit `d5d214a`)
**Status:** Active
**Context:**

AI agent requests are traced via Braintrust (`wrapAnthropic`, `traced`, `initLogger`). Supabase Edge Functions can terminate after the HTTP response is sent.

**Decision:**

Initialize the Braintrust logger with `asyncFlush: true` so log flushing does not block the HTTP response. The edge function returns to the client immediately. An explicit `logger.flush()` call is made before returning to mitigate data loss. The `span.id` is returned as `braintrustTraceId` in the response for frontend linking.

**Tradeoff:**

- **Pro:** Faster response times — clients don't wait for Braintrust log delivery.
- **Con:** Under aggressive Deno isolate termination (cold-start scenarios), traces may be dropped even with the explicit flush call.

**Key file:** `supabase/functions/ai-agent/index.ts`
