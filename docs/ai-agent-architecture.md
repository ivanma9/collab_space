# AI Agent Architecture

Documents the full call trace, layer responsibilities, and design decisions for the CollabBoard AI agent.

---

## Overview

The AI agent lets users control the whiteboard through natural language chat. It is a **single-turn, single-LLM-call** architecture: the LLM receives the full board state + conversation history and returns all tool calls at once. Execution is done client-side in React.

---

## Full Call Trace

```
[React UI]
  └─ User types message in chat panel (CursorTest.tsx)
       └─ useAIAgent.sendMessage(text)                  src/hooks/useAIAgent.ts
            │
            ├─ [CLIENT — React]
            │    • Appends user message to local state
            │    • Snapshots current board: objectsRef.current → boardState[]
            │    • Computes findOpenArea() — suggests where to place new objects
            │    • Trims message history to last 7 turns
            │
            ├─ supabase.functions.invoke("ai-agent", { messages, boardState, boardId, openArea })
            │    └─ HTTP POST to Supabase Edge Function (no JWT — see AD-001)
            │
            │   [EDGE FUNCTION — Deno]               supabase/functions/ai-agent/
            │    ├─ Braintrust traced() span wraps entire call (observability)
            │    ├─ Builds system prompt:
            │    │    • Coordinate system rules (origin top-left, default sizes)
            │    │    • OPEN AREA guide (from client-computed openArea)
            │    │    • CURRENT BOARD STATE (serialized from boardState[])
            │    │    • Conversation behavior rules (80% confidence threshold)
            │    │    • Tool usage rules (ref keys, connector linking)
            │    │
            │    ├─ *** LLM CALL *** → Anthropic API
            │    │    model:       claude-haiku-4-5-20251001
            │    │    tools:       13 tools (tools.ts)
            │    │    tool_choice: "auto"
            │    │    max_tokens:  4096
            │    │    messages:    last 7 turns
            │    │
            │    ├─ Parses response:
            │    │    • Extracts tool_use blocks → toolCalls[]
            │    │    • Extracts text blocks    → plan/message text
            │    │    • askClarification tool   → clarification branch
            │    │
            │    └─ Returns one of two shapes:
            │         { type: "clarification", message, suggestions[] }
            │         { type: "execution",     plan,    toolCalls[]   }
            │
            ├─ [CLIENT — React, back in useAIAgent]
            │    If "clarification":
            │    │   Renders message + clickable suggestion chips in chat
            │    │
            │    If "execution":
            │         Renders plan text, executionStatus: "pending"
            │         executeToolCalls(toolCalls):
            │           • Build idMap: AI ref keys ("s1") → crypto.randomUUID()
            │           • Resolve connector fromId/toId through idMap
            │           • For each tool call → switch on call.name:
            │               createStickyNote / createShape / createFrame /
            │               createTextBox / createConnector → createObject()
            │               moveObject / resizeObject / changeColor /
            │               updateStickyNoteText / updateTextBoxContent → updateObject()
            │               bulkCreateObjects → batched createObject() in chunks of 50
            │         Sets executionStatus: "executed"
            │         If 2+ creates and no connectors → show connector suggestion chips
            │
            └─ createObject / updateObject
                 └─ Supabase DB write (board_objects table)
                      └─ Supabase Realtime broadcast → all connected clients update canvas
```

---

## Layer Responsibilities

| Layer | File(s) | Role | LLM call? | Tool execution? |
|---|---|---|---|---|
| React UI | `src/pages/CursorTest.tsx` | Chat input, message rendering, suggestion chips | No | No |
| `useAIAgent` hook | `src/hooks/useAIAgent.ts` | Orchestration, board snapshot, open area calc, tool dispatch | No | Yes (client-side) |
| Edge Function | `supabase/functions/ai-agent/index.ts` | HTTP handler, prompt assembly, LLM call, response parsing | **Yes** | No (describes only) |
| Tool definitions | `supabase/functions/ai-agent/tools.ts` | JSON Schema definitions sent to Claude | No | No |
| Anthropic API | External | Runs `claude-haiku-4-5` — generates tool_use + text blocks | **Yes** | No |
| Supabase DB | `board_objects` table | Persists board objects (create/update/delete) | No | No |
| Supabase Realtime | Broadcast channel | Pushes changes to all connected collaborators | No | No |
| Braintrust | External | Traces every LLM call via `wrapAnthropic` + `traced()` | No | No |

---

## Tools Available to the LLM (13 total)

### Creation (6)
| Tool | Creates |
|---|---|
| `createStickyNote` | Sticky note with text + color |
| `createShape` | Rectangle, circle, or line |
| `createFrame` | Labeled group frame |
| `createTextBox` | Standalone text element |
| `createConnector` | Arrow/line between two objects |
| `bulkCreateObjects` | Many objects at once in a grid layout |

### Modification (5)
| Tool | Modifies |
|---|---|
| `moveObject` | x/y position of existing object |
| `resizeObject` | width/height of existing object |
| `updateStickyNoteText` | Text content of a sticky note |
| `updateTextBoxContent` | Text content of a text box |
| `changeColor` | Fill/stroke color of any object |

### Meta (2)
| Tool | Purpose |
|---|---|
| `getBoardState` | No-op — board state already in context |
| `askClarification` | Routes response to clarification branch instead of execution; provides suggestion chips |

---

## Response Types

The edge function always returns one of two discriminated union shapes:

```ts
// User needs to clarify — no board changes
{ type: "clarification", message: string, suggestions: string[], meta: AIMessageMeta }

// Board operations to execute
{ type: "execution", plan?: string, toolCalls: AIToolCallResult[], meta: AIMessageMeta }
```

`meta` always includes: `inputTokens`, `outputTokens`, `latencyMs`, `model`, `braintrustTraceId`.

---

## Key Design Decisions

### Single LLM call per turn
No multi-turn tool loop. The LLM returns all tool calls in one response. The client executes them sequentially. This keeps latency low and the edge function stateless.

### Tool execution is client-side
The edge function only returns JSON describing what to do. The React hook does the actual Supabase writes. This means the edge function needs no Supabase service-role key and can't accidentally corrupt state.

### UUID generation is client-side
The LLM uses short human-readable ref keys (`"s1"`, `"frame1"`) so it can cross-reference objects (e.g. connector `fromId: "s1"`). The client maps these to real `crypto.randomUUID()` values before writing to the DB.

### Board state is injected as context (not a tool call)
The LLM doesn't call a tool to fetch board state — it's always serialized into the system prompt on every request. This avoids a round trip and simplifies the edge function.

### No JWT on the edge function
Supports anonymous/guest users who may not have a full auth session (see AD-001 in `docs/architecture-decisions.md`).

### Braintrust wraps Anthropic SDK
`wrapAnthropic(new Anthropic(...))` + `traced()` automatically captures all LLM inputs, outputs, latency, and token counts in Braintrust without any manual instrumentation beyond the span name.

### Open area is computed client-side
Before calling the edge function, `findOpenArea()` analyzes existing object bounding boxes and returns the best empty region (to the right if board is wide, below if tall). This guides the LLM on where to place new objects without it having to reason about spatial layout.

---

## Data Flow Diagram (simplified)

```
User input
    ↓
React (useAIAgent)
    ↓  board snapshot + last 7 messages
Supabase Edge Function
    ↓  system prompt + tools
Anthropic claude-haiku-4-5
    ↓  tool_use blocks + text
Edge Function (parse + return)
    ↓  { type, toolCalls[] } or { type, message, suggestions[] }
React (executeToolCalls)
    ↓  createObject() / updateObject()
Supabase DB (board_objects)
    ↓  Realtime broadcast
All connected clients (canvas rerender)
```
