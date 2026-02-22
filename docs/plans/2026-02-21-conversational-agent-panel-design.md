# Conversational AI Agent Panel Design

**Date:** 2026-02-21
**Status:** Approved

## Overview

Replace the current single-shot AI command bar with a conversational side panel that supports clarification rounds, guided responses, and inline observability via Braintrust trace links.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Panel layout | Right side drawer (~350px) | Canvas stays usable, familiar pattern (Figma/Slack) |
| Conversation flow | Hybrid — auto-execute if clear, clarify if ambiguous | Preserves speed for clear commands, adds quality for vague ones |
| Response guidance | AI-generated suggestion chips | Reduces friction, guides users toward actionable responses |
| Context window | Last 3 conversation turns sent to API | Keeps token costs flat, older turns add little value |
| Observability | Inline collapsible details per message | Contextual > tab-switching; shows tools, tokens, latency, Braintrust link |
| Chat persistence | Ephemeral (resets on page leave) | Simple, no schema changes, can add persistence later |

## Panel Layout & Structure

### Collapsed State

A button on the right edge of the canvas or in the toolbar (sparkle icon / "AI" label). Clicking slides the panel open.

### Expanded State

~350px wide, docked right. Canvas resizes to accommodate (not overlay).

```
┌──────────────────────────────────────┐
│  AI Agent                        ✕   │  ← Header
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────┐        │
│  │ Help me plan a sprint    │        │  ← User message (right-aligned)
│  └──────────────────────────┘        │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ What kind of sprint layout?   │  │  ← AI clarification (left-aligned)
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ✅ Executed 4 operations       │  │  ← AI action message (purple accent)
│  │ ▸ Details                      │  │  ← Collapsible
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  [Kanban] [Scrum] [Custom]           │  ← Suggestion chips
│  ┌──────────────────────────┐ [Send] │  ← Input
│  └──────────────────────────┘        │
└──────────────────────────────────────┘
```

### Message Types

1. **User messages** — Right-aligned bubbles, standard chat pattern
2. **AI text responses** — Left-aligned, for clarifying questions. May include `suggestions` array.
3. **AI action messages** — Left-aligned with purple accent, showing "Executed N operations" with collapsible details block

### Suggestion Chips

- Appear above the input when the latest AI message includes a `suggestions` array
- Clicking a chip sends that text as the user's message
- Disappear after click or when user starts typing
- User can always ignore chips and type freely
- Example chips on first open (before any messages): preset prompts like today

## Conversation-to-Execution Flow

### Fast Path (High Confidence)

User sends a clear command → AI executes immediately → posts action message with details.

Same speed as today. One round trip.

### Clarification Path (Ambiguous)

1. User sends vague request (e.g., "Help me plan a sprint")
2. AI responds with clarifying question + suggestion chips
3. User responds (via chip or typed message)
4. Repeat until AI is confident (typically 2-3 rounds)
5. AI posts a **plan summary message** with an **[Execute]** button
6. User clicks Execute to confirm
7. AI runs tool calls, plan message transforms into action message with details

### Plan Summary Message

```
┌────────────────────────────────────────┐
│ Here's what I'll do:                   │
│ • Create a frame titled 'Sprint 23'   │
│ • Add 4 columns: To Do, In Progress,  │
│   Review, Done                         │
│ • Add 3 sample sticky notes in To Do  │
│                                        │
│        [Execute]  · [Edit plan]        │
└────────────────────────────────────────┘
```

## Token & Cost Analysis

**Current baseline (single-shot, Haiku 4.5):**
- Input: ~800-1500 tokens
- Output: ~200-600 tokens
- Latency: ~1-2s
- Cost: ~$0.001-0.002 per command

**Fast path:** Same as baseline — no regression.

**Clarification path (typical 3 rounds):**

| Round | Input tokens | Output tokens | Latency | Est. cost |
|-------|-------------|---------------|---------|-----------|
| 1 (clarify) | ~1000 | ~100-150 | ~0.8s | ~$0.0005 |
| 2 (clarify) | ~1200 | ~100-150 | ~0.8s | ~$0.0006 |
| 3 (execute) | ~1500 | ~400-600 | ~1.2s | ~$0.0015 |
| **Total** | **~3700** | **~700** | **~2.8s** | **~$0.003** |

Clarification path costs ~2-3x a single-shot but produces more accurate results. Still fractions of a cent on Haiku.

## Edge Function API Changes

### Request

```typescript
// Before
{ command: string, boardState: object[], boardId: string, openArea: object }

// After
{ messages: Message[], boardState: object[], boardId: string, openArea: object }
// messages: last 3 user/assistant turns + current user message (7 messages max)
```

### Response

```typescript
// Clarification response
{
  type: "clarification",
  message: "What layout do you want?",
  suggestions: ["Grid", "Row", "Freeform"],
  meta: {
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    model: string,
    braintrustTraceId: string
  }
}

// Execution response
{
  type: "execution",
  plan?: "Create 4 sticky notes in a grid...",
  toolCalls: [{ name: string, input: object }],
  meta: { /* same as above */ }
}
```

### Key Changes

- `tool_choice` switches from `"any"` to `"auto"` — allows text-only responses for clarification
- System prompt updated: "If the user's request is less than 80% clear, respond with a clarifying question and include a suggestions array. Only call tools when you're confident."
- Braintrust trace ID extracted from logger after flush, included in `meta`

## Frontend Component Architecture

### New Components

| Component | Responsibility |
|-----------|---------------|
| `AIPanel.tsx` | Side drawer container. Open/close state, header, message list, input area. |
| `AIChatMessage.tsx` | Single message renderer. Three variants: user, AI text, AI action. |
| `AIMessageDetails.tsx` | Collapsible details block. Tools list, tokens, latency, Braintrust link. |
| `AISuggestionChips.tsx` | Clickable chip row above input. Rendered from AI `suggestions` array. |

### Modified Files

| File | Changes |
|------|---------|
| `useAIAgent.ts` | Add `messages` array state, conversation management, handle `clarification`/`execution` response types. Expose `messages`, `sendMessage()`, `executePlan()`, `suggestions`. |
| `CursorTest.tsx` | Replace `<AICommandInput>` with `<AIPanel>`. Canvas width adjusts when panel opens. |
| `supabase/functions/ai-agent/index.ts` | Accept `messages` array, return typed responses with `meta`, switch `tool_choice` to `"auto"`. |
| `supabase/functions/ai-agent/tools.ts` | No changes needed. |

### Removed

- `AICommandInput.tsx` — replaced entirely by the new panel components

## Observability Details Block

Each AI action message includes a collapsible details section:

```
┌─────────────────────────────────────────┐
│ ▸ createStickyNote → "Pros"             │
│ ▸ createStickyNote → "Cons"             │
│ ▸ createFrame → "SWOT Analysis"         │
│                                         │
│ 1,247 input · 312 output · 1.2s        │
│ 🔗 View full trace in Braintrust        │
└─────────────────────────────────────────┘
```

- Tool names + key input (first text field or title)
- Token count (input/output)
- Latency
- Direct link to Braintrust trace: `https://www.braintrust.dev/app/{org}/p/CollabBoard%20Agent/logs?traceId={traceId}`

## V1 Implementation Notes

- **Execute button confirmation:** V1 auto-executes all execution responses immediately (fast path). The plan summary with [Execute]/[Edit plan] buttons described in the Clarification Path is deferred to V2. The types support `executionStatus: "pending"` for future use.
- **Braintrust trace ID:** Currently returns `null`. The `wrapAnthropic` SDK auto-logs traces but extracting the span ID at runtime needs investigation. The UI gracefully hides the link when the ID is null.

## Out of Scope (Future)

- Plan summary confirmation with [Execute] button (V2)
- Braintrust trace ID extraction for deep-dive links
- Chat persistence / audit log per board
- Streaming responses
- Multi-model support (upgrading from Haiku for complex queries)
- Undo/rollback of AI actions from the chat
