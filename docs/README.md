# Build plan

Big Brother is a personal, single-tenant workspace for public information: you
follow entities, the app collects what is published about them, and you write your
own notes against what it finds. There is no AI in the product — every feature below
is deterministic.

Steps are ordered so each one ships on its own. Nothing later is required for
anything earlier to be useful.

| Step | Document | What it delivers |
|---|---|---|
| 0 | [step-0-articles.md](step-0-articles.md) | Articles become addressable rows |
| 1 | [step-1-crawling.md](step-1-crawling.md) | Every node gets its own feed |
| 2 | [step-2-notes.md](step-2-notes.md) | Notes on entities, connections, articles |
| 3 | [step-3-graph-editor.md](step-3-graph-editor.md) | React Flow — drag nodes, draw connections |
| 4 | [step-4-shell.md](step-4-shell.md) | Dark editor shell with docked panels |
| 5 | [step-5-timeline.md](step-5-timeline.md) | Scrub the graph through time |

[design-system.md](design-system.md) holds the dark palette that steps 3–5 build
against. Read it before any UI work.

Steps 0–2 are data and can be done in any order after 0. Steps 3–5 are UI. If you
only have appetite for one track, 0→1→2 makes the app more useful; 3→4 makes it feel
like a different product.

## What to load for a step

This file is an index, not a container — it holds the conventions every step assumes,
not the steps themselves. Load it alongside the one step you are working on, and
nothing else. A finished step lives in the code; its document is not context for the
next one.

| Working on | Load |
|---|---|
| Step 0 | this file + `step-0-articles.md` |
| Step 1 | this file + `step-1-crawling.md` |
| Step 2 | this file + `step-2-notes.md` |
| Dark migration | this file + `design-system.md` |
| Step 3 | this file + `design-system.md` + `step-3-graph-editor.md` |
| Step 4 | this file + `design-system.md` + `step-4-shell.md` |
| Step 5 | this file + `design-system.md` + `step-5-timeline.md` |

The largest combination is about 4,900 tokens. Loading the whole `docs/` directory at
once costs roughly 14,000 and makes it likelier that the conventions here get skimmed
in favour of whichever step happens to be longest.

## Conventions every step follows

**Additive first.** Prefer adding a table or a query parameter over changing an
existing one. Every step below is written so that a half-finished attempt leaves the
app working.

**No new runtime dependencies** except where a step names one explicitly (step 3 adds
four). The project is deliberately small: Next.js, React, Drizzle, shadcn, Vercel.

**Match the surrounding style.** `lib/` and `app/api/` are written in a dense,
single-line style with minimal whitespace. `components/ui/` is generated shadcn and
is formatted normally. Follow whichever file you are in rather than reformatting it.

**Ownership is not optional.** Every table is keyed by `owner_id` first and every
query filters on it. There is one user per workspace, but the schema does not assume
that and neither should new code.

**One door between workspaces.** Everything a person writes stays under their own
`owner_id`. The single exception is the suggestion layer: a reader of a public board
writes a row into that board owner's `contributions`, and only the owner accepting it
moves anything into the workspace proper. Every check that decides who may read,
edit, or suggest lives in `lib/permissions.ts` — do not spell one out again in a
handler.

**Errors are user-facing copy.** Existing handlers return sentences, not codes —
*"Enter a name (2–100 characters), a category, and a public source URL."* Keep that
register. No stack traces, no "Error:" prefixes.

## Working locally

The dev server runs on port 3000 (`npm run dev`). `.claude/launch.json` has the
config if you drive it through tooling.

**Signing in.** API routes read a signed `bb_session` cookie issued after Google
OAuth. Sign in at `/` in the browser, then copy the cookie for API calls.

**Migrations.** `npm run db:generate` writes SQL to `drizzle/`. The app applies
those files to the local SQLite file (`data/bigbrother.db`) or to Turso on first
request. There is no wrangler step.

**Checks.** `npx tsc --noEmit` must stay clean. `npx oxlint` currently reports 43
pre-existing errors in generated code (`app/page.tsx` and `components/ui/*`); do not
add to that count, and do not detour into fixing it.

## Platform limits that shape the design

- **Function duration.** Vercel Hobby caps serverless work at a short window;
  the briefing route sets `maxDuration` to 60 seconds so a refresh can finish.
  Step 1 still batches entity crawls so one request does not fan out without bound.
- **Request body.** `app/api/workspace/route.ts` caps POST bodies at 6 KB. Layout and
  note payloads must fit, or need their own endpoint.
