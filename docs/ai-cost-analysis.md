# AI Cost Analysis — CollabBoard

**Date:** 2026-02-20
**Model:** `claude-haiku-4-5-20251001` (Anthropic)
**Logging:** Braintrust (wrapAnthropic)
**Hosting:** Supabase Edge Functions

---

## Assumptions

### Usage Patterns

| Parameter | Value | Notes |
|---|---|---|
| Sessions per user per month | 4 | ~1×/week |
| AI commands per session | 5 | Mix of creates, layouts, edits |
| AI commands per user per month | **20** | 4 × 5 |
| Avg board objects at time of call | 10 | Used to estimate board state context |

### Token Counts per Command Type

Each AI call sends: system prompt + board state context + tools schema + user command.
The response contains only tool calls (no text — `tool_choice: "any"`).

| Command Type | % of calls | Input tokens | Output tokens | Notes |
|---|---|---|---|---|
| Simple create (1 object) | 40% | ~2,400 | ~180 | e.g. "add a sticky note" |
| Complex layout (3–8 objects) | 25% | ~2,700 | ~900 | e.g. "create a SWOT diagram" |
| Modify / move / recolor | 25% | ~2,300 | ~130 | e.g. "move the blue note up" |
| Explain / ambiguous | 10% | ~2,500 | ~300 | no tool call, text reply |

**Weighted average per command:**
- Input: ~2,475 tokens
- Output: ~345 tokens

#### Token Breakdown (system prompt)

| Component | Approx. Tokens |
|---|---|
| System instructions + coordinate rules | ~380 |
| Board state (10 objects × ~25 tokens) | ~250 |
| Open area guide | ~120 |
| Tools schema (11 tools) | ~1,500 |
| User command | ~30 |
| **Total input** | **~2,280 base + ~220 variable** |

---

## Pricing Reference (as of Feb 2026)

### Anthropic Claude Haiku 4.5

| Token type | Price |
|---|---|
| Input | $0.80 / 1M tokens |
| Output | $4.00 / 1M tokens |

**Cost per average command:**
- Input: 2,475 × $0.00000080 = **$0.00198**
- Output: 345 × $0.000004 = **$0.00138**
- **Total per command: ~$0.0034**

**Cost per user per month:** 20 commands × $0.0034 = **$0.068**

### Braintrust Logging

| Tier | Logs/month | Cost |
|---|---|---|
| Free | 10,000 | $0 |
| Growth | 100,000 | ~$20/month |
| Scale | 1,000,000 | ~$150/month |
| Enterprise | 10,000,000+ | Custom |

_(1 log per AI command)_

### Supabase Edge Functions

| Tier | Invocations/month | Cost |
|---|---|---|
| Free | 500,000 | $0 |
| Beyond 500K | per 1M additional | $2.00 |

_(1 invocation per AI command)_

### Supabase Platform

| Plan | Monthly | Active users |
|---|---|---|
| Free | $0 | Up to ~100 |
| Pro | $25 | Up to ~1,000 |
| Team | $599 | Up to ~10,000 |
| Enterprise | Custom | 100,000+ |

---

## Production Cost Projections

### Monthly Totals by Scale

| Cost Component | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| **AI commands/month** | 2,000 | 20,000 | 200,000 | 2,000,000 |
| **Anthropic API** | $6.80 | $68.00 | $680.00 | $6,800.00 |
| **Braintrust logging** | $0 (free) | $20.00 | $20–150.00 | $150–500.00 |
| **Supabase Edge Fn** | $0 (free) | $0 (free) | $0 (free) | $3.00 |
| **Supabase platform** | $0 (free) | $25.00 | $599.00 | Custom |
| **TOTAL (AI only)** | **$6.80** | **$88.00** | **$700–830** | **$6,953–7,303** |
| **Cost per user** | $0.07 | $0.09 | $0.07–0.08 | $0.07 |

> Note: Supabase platform cost at 100K users is highly variable (database size, realtime connections, storage). Enterprise negotiated pricing assumed here; budget $500–2,000+/month for infra.

### Per-User AI Cost (Anthropic only)

At $0.068/user/month, AI is effectively **$0.82/user/year** — well within typical SaaS margins for a paid product.

### Cost Sensitivity

| Scenario | Commands/user/month | $/user/month (API only) |
|---|---|---|
| Light usage | 5 | $0.017 |
| **Baseline** | **20** | **$0.068** |
| Heavy usage | 60 | $0.204 |
| Power user | 150 | $0.510 |

---

## Development & Testing Costs

### Actual Spend Tracker

_Sourced from `~/.claude/stats-cache.json` — last updated 2026-02-20._

#### Claude Code (Development Tool) — Subscription Plan

Developer used Claude Code on a **flat-rate subscription (Claude Max)**, so direct API charges were $0. The equivalent pay-as-you-go API cost for all development work is shown below for reference.

| Token Type | Tokens | Rate | Equiv. Cost |
|---|---|---|---|
| Input (uncached) | 32,948 | $3.00/MTok | $0.10 |
| Output | 793,099 | $15.00/MTok | $11.90 |
| Cache creation | 16,540,798 | $3.75/MTok | $62.03 |
| Cache reads | 214,805,145 | $0.30/MTok | $64.44 |
| **Total equiv. cost** | | | **~$138.47** |

**Activity summary (Oct 28, 2025 → Feb 17, 2026):**
- 21 sessions across 11 active days
- 4,719 total messages
- Models used: `claude-sonnet-4-5-20250929`, `claude-sonnet-4-20250514`
- Heaviest day: Feb 17, 2026 — 280K tokens, 1,868 messages

> Cache reads account for **99.98%** of all input tokens consumed. Claude Code's prompt caching is extremely effective, reducing equivalent input costs by ~90%.

#### Braintrust (AI Agent Logging)

| Period | Logs Created | Cost | Notes |
|---|---|---|---|
| Dev/testing | — | $0 (free tier) | Under 10K logs/month |
| **TOTAL** | **—** | **$0** | |

#### Supabase Edge Functions

| Period | Invocations | Cost | Notes |
|---|---|---|---|
| Dev/testing | — | $0 (free tier) | Under 500K/month |
| **TOTAL** | **—** | **$0** | |

### How to Track Actual Spend

- **Anthropic API:** [console.anthropic.com](https://console.anthropic.com) → Usage
- **Claude Code activity:** `~/.claude/stats-cache.json`
- **Braintrust:** App → Settings → Billing
- **Supabase:** Project → Settings → Billing

### Development Cost Summary

| Cost Category | Actual Paid | Equiv. API Value | Notes |
|---|---|---|---|
| Claude Code (dev tool) | ~$20/month (Max sub) | ~$138 total | Flat subscription |
| Anthropic API (ai-agent) | $0 | $0 | Not yet in production |
| Braintrust logging | $0 | $0 | Free tier |
| Supabase | $0 | $0 | Free tier |
| **Total dev spend** | **~$80** (4 months) | — | Subscription only |

---

## Cost Optimization Notes

1. **Haiku is already the cheapest Anthropic model** — correct choice for high-frequency tool-use workloads.
2. **System prompt caching** — Anthropic supports prompt caching for repeated system prompts. The tools schema (~1,500 tokens) and static instructions are identical across calls; enabling caching could reduce input costs by ~60%. Estimated savings: ~$0.0013/command.
3. **Board state truncation** — Large boards (50+ objects) inflate input tokens significantly. Consider summarizing off-screen objects.
4. **Rate limiting** — Implement per-user command limits to prevent runaway costs (e.g. 50 AI commands/day/user free tier).
5. **Batching** — If multiple quick commands are issued, consider debouncing within a 2-second window to merge into a single API call.

---

## Break-Even & Pricing Implications

If charging a **$10/month Pro plan:**

| Scale | Infra + AI cost | Revenue | Gross margin |
|---|---|---|---|
| 100 users | ~$7 | $1,000 | ~99% |
| 1,000 users | ~$88 | $10,000 | ~99% |
| 10,000 users | ~$1,400 | $100,000 | ~98.6% |
| 100,000 users | ~$9,000 | $1,000,000 | ~99.1% |

AI costs remain negligible as a % of revenue across all scales.
