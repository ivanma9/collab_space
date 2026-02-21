# AI Development Log — CollabBoard

**Author:** Ivan Ma
**Date:** 2026-02-20
**Project:** CollabBoard — Real-time collaborative whiteboard

---

## Tools & Workflow

| Tool | Role |
|------|------|
| **Claude Code (CLI)** | Primary development tool — wrote ~95% of all code, executed plans, debugging, git operations |
| **Cursor** | Code navigation and comprehension — used to read through files and understand specific portions of the codebase |
| **Gemini** | Prompt engineering and research — helped craft effective prompts and research technical approaches |
| **Claude (chat)** | General brainstorming and architectural discussions |

**Integration approach:** Claude Code served as the execution engine, driven by structured plans and PRD checklists. Cursor provided a fast way to visually trace through code when Claude Code's terminal output wasn't enough for understanding complex flows. Gemini was used as a second opinion for prompt crafting and technical research before feeding refined prompts into Claude Code.

---

## MCP Usage

| MCP Server | Purpose |
|------------|---------|
| **Braintrust** | AI observability — logged all AI agent Edge Function calls (Claude Haiku 4.5) to monitor token usage, latency, and cost per command |

Braintrust MCP provided documentation and understanding for observability. It enabled tracking the AI agent's per-call costs ($0.0034/command), validating token count assumptions, and building the cost projection model that informed pricing decisions (documented in `docs/ai-cost-analysis.md`).

---

## Effective Prompts

**1. Plan-driven execution prompts**
Each major feature was preceded by a written plan document with explicit task breakdowns. Plans were prefixed with:
> *"REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task."*

This forced Claude Code into a structured, step-by-step execution mode rather than trying to do everything at once. 8 plan documents were created across the project (`docs/plans/`).

**2. PRD checklist as source of truth**
> *"Consolidated all project requirements into a single PRD checklist derived from the project spec."*

Maintaining `docs/PRD-CHECKLIST.md` as the canonical feature tracker gave Claude Code clear acceptance criteria and prevented scope drift across sessions.

**3. Architectural decision logging**
> *"Create an architecture decision record for [decision]. Document the tradeoff, risks, and mitigations."*

This produced `docs/architecture-decisions.md` and kept non-obvious decisions (e.g., disabling JWT verification for guest AI access) documented with rationale.

**4. "Ask me questions" / uncertainty prefacing**
When unsure about design direction, prompts were prefaced with uncertainty signals like "I'm not sure about this" or ended with "ask me questions." This triggered Claude Code to engage in clarifying dialogue rather than making assumptions — particularly valuable for UX decisions like connector handle placement and toolbar layout.

**5. Feature-scoped implementation prompts**
> *"Replace the toolbar connector button with connection handle dots that appear on selected objects. Allow drag-to-connect from a dot to another object."*

Specific, behavior-focused prompts with clear before/after descriptions consistently produced the best results — Claude Code could execute these in a single session with minimal back-and-forth.

---

## Code Analysis

| Category | Estimate |
|----------|----------|
| AI-generated code | ~95% |
| Hand-written code | ~5% |

**Workflow:** Code was mostly accepted as-is from Claude Code, then tested manually and via Playwright e2e tests. The 5% hand-written portion was primarily toolbar styling tweaks, UX adjustments, and occasional fixes where Claude Code's output needed manual correction. The project spans 79 commits across the full stack (React/Konva frontend, Supabase migrations, Edge Functions, Playwright tests).

---

## Strengths & Limitations

### Where AI Excelled
- **Execution speed:** Full features (component + hook + migration + tests) shipped in single sessions
- **Debugging:** Rapid diagnosis of issues like Supabase rate limits, Konva transformer bounds, and realtime sync race conditions
- **Boilerplate & plumbing:** Database migrations, RLS policies, Edge Function scaffolding, TypeScript types, and test fixtures
- **Multi-file coordination:** Changes spanning 5-10 files (e.g., adding a new object type end-to-end) were handled correctly in one pass
- **Cost analysis:** Generated a comprehensive production cost model with per-user projections across scaling tiers

### Where AI Struggled
- **Complex trace-heavy debugging:** When bugs involved long chains of state updates across multiple hooks and realtime channels, Claude Code would sometimes go in circles — requiring manual intervention to narrow the search space
- **Overthinking simple changes:** Occasionally over-engineered solutions or made unnecessary adjacent changes when a targeted fix was all that was needed
- **UX/visual design decisions:** Needed human guidance for subjective choices like toolbar positioning, color palettes, and interaction patterns

---

## Key Learnings

1. **Git worktrees enable parallel AI work.** Running multiple Claude Code sessions on isolated worktrees lets you execute independent features simultaneously — a major throughput multiplier.

2. **Checklists compound learning.** Maintaining a PRD checklist and plan documents across sessions prevented re-discovery of requirements and kept Claude Code aligned with the overall vision. Each new session started with context instead of from scratch.

3. **Add an "overthinking stop clause."** Explicitly instructing Claude Code to stop after 3 failed attempts and ask for guidance (codified in `CLAUDE.md`) prevented costly loops where the AI would burn context on increasingly complex approaches to simple problems.

4. **Structure > raw prompting.** The biggest productivity gains came not from clever prompts, but from the surrounding system: plan documents, PRD checklists, architecture decision records, and CLAUDE.md instructions. These artifacts gave Claude Code guardrails that made every session productive.

5. **AI is a force multiplier, not a replacement for judgment.** The 95/5 split worked because the 5% human input was high-leverage: choosing what to build, when to stop debugging, and which UX tradeoffs to make. The AI handled the volume; the human handled the direction.
