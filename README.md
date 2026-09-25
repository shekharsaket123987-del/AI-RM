# AI Health Buddy — Prototype

A working prototype of the system described in `prd.md`: an AI assistant
that reads a client's journey from read-only data, answers simple questions,
motivates, listens, and escalates anything outside its authority to a human
dietitian or RM. This build proves the core pipeline — read-only context,
KB grounding, intent/escalation classification, two safety layers, memory,
and the escalation lifecycle — using real Claude calls, but with mocked
WhatsApp and Google Sheets so it runs entirely on your machine.

## What's real vs mocked

| Piece | This prototype | Full PRD (section 26) |
| --- | --- | --- |
| LLM (classify / reply / safety post-check) | **Real** — Anthropic Claude via `@anthropic-ai/sdk` | Same |
| Escalation engine, rules, lifecycle | **Real** logic (`apps/backend/src/escalation`) | Same, just against real traffic |
| Read-only architecture (Source zone vs AI zone) | **Real separation** — two SQLite DBs, `sourceDb.ts` has no write functions | Same split, Google Sheets / Postgres instead of SQLite (Phase 1) |
| WhatsApp | `/simulate` page + `POST /api/messages` stand in for the webhook | WhatsApp Business Platform (Phase 3) |
| Client/plan/diet/follow-up data | 6 seeded synthetic clients (`src/seed/seed.ts`) modeled on the PRD's personas | Google Sheets, then platform DB (Phase 1) |
| KB retrieval | Keyword-overlap scoring over ~18 seeded entries | pgvector / embeddings (Phase 2) |
| Auth | None — single implicit RM role | SSO + 2FA + roles (section 19) |
| Dashboard screens | Overview, Escalation Inbox, Client 360, KB admin, Simulate | Adds conversation-quality review, rules admin UI, Data Issues view (Phase 7) |

See `packages/shared/src/escalation.ts` and `safety.ts` for the trigger rules
and DO-NOT list — those are the same rules from PRD sections 15 and 18, just
implemented in code instead of prose.

## Repo layout

```
packages/shared/      Types, escalation rules (PRD 15.1), DO-NOT list (18)
apps/backend/         Express API + the pipeline (PRD 23) + two SQLite DBs
apps/dashboard/       Next.js RM dashboard (PRD 24)
```

## Setup

1. `npm install` at the repo root (installs all workspaces).
2. `cd apps/backend && copy .env.example .env` (or `cp` on macOS/Linux) and
   set `ANTHROPIC_API_KEY`. Without a key, the safety pre-check paths
   (medication/symptom/self-harm keywords) still work with zero API calls,
   but general replies and classification will return a clear error.
3. From `apps/backend`:
   - `npx prisma db push --schema prisma/source.prisma`
   - `npx prisma db push --schema prisma/aizone.prisma`
   - `npm run seed`
4. Start both apps (from the repo root, in two terminals):
   - `npm run dev:backend` → http://localhost:4000
   - `npm run dev:dashboard` → http://localhost:3000

## Try it

Open http://localhost:3000/simulate, pick a seeded client, and send messages.
Good ones to try:

- **Sunita Iyer** — "Can I stop my BP medicine?" → fixed L3 template, no LLM
  call needed, escalation appears instantly in the Inbox.
- **Sunita Iyer** — "I'm having severe chest pain" → fixed emergency template.
- **Madan Sharma** — "Can I have rice?" → answered directly from his diet
  (needs `ANTHROPIC_API_KEY`).
- **Madan Sharma** — "My diet isn't working, I want a completely different
  diet" → L2 escalation to the dietitian, no diet invented (needs API key).
- **Rohit Nair** — "I think I've hit a plateau" → plateau is detected from
  his follow-up history and escalated (needs API key).

Then check the **Escalation Inbox** and the client's **Client 360** page to
see the full `PRD §15.2` payload and conversation log.

## Testing

```
npm test --workspace=apps/backend
```

`test/unit.test.ts` covers the deterministic pieces (progress math, plateau
detection, the safety pre-check regexes, the post-check violation patterns)
with no external dependencies. `test/scenarios.test.ts` runs ~10 of the
PRD's 38 scenarios through the live pipeline against the seeded data —
it needs `ANTHROPIC_API_KEY` and auto-skips without one.

## What's next

This is the "prove the pipeline" phase. The natural next steps, in the
order the PRD lays out in section 26:

1. Swap `src/db/sourceDb.ts`'s internals for a real Google Sheets reader
   (Phase 1) — nothing above it changes, since it's called through the
   same function signatures.
2. Swap `kbRetrieval.ts` for pgvector-based retrieval once the KB grows
   past what keyword matching handles well (Phase 2).
3. Replace `/api/messages` with a real WhatsApp Business Platform webhook
   (Phase 3) — the pipeline function it calls (`runPipeline`) doesn't change.
4. Add the screens this prototype deferred: conversation-quality review,
   a rules-admin UI, and the Data Issues view (Phase 7).
5. Add real auth (SSO + 2FA + roles) before any real client data touches
   this system (PRD section 19).
