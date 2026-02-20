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
