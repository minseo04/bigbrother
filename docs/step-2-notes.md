# Step 2 — Notes

Status: not started
Depends on: [step 0](step-0-articles.md) for article notes; entity and connection
notes need nothing
Blocks: the Inspector's notes section in [step 4](step-4-shell.md)

## Why

This is the half of the product that is not automated. The app collects; you decide
what any of it means. Right now there is nowhere to put that.

`connections.evidence` looks like it might serve, but it does not: it is a single
field fixed at creation time, it exists only on connections, and it describes what a
source establishes rather than what you think. Notes are yours, they accumulate, and
they attach to anything.

## Schema

```ts
export const notes=sqliteTable("notes",{
  ownerId:text("owner_id").notNull(),
  id:text("id").notNull(),
  targetKind:text("target_kind").notNull(),
  targetId:text("target_id").notNull(),
  body:text("body").notNull(),
  created:text("created").notNull(),
  updated:text("updated").notNull()
},t=>[primaryKey({columns:[t.ownerId,t.id]}),index("notes_owner_target").on(t.ownerId,t.targetKind,t.targetId)]);
```

`target_kind` is one of `entity`, `connection`, `article`. Validate against that list
on write — SQLite will not do it for you and a typo silently creates notes that
nothing ever reads.

The index is what makes "notes for this node" a single lookup, which is the only
query the Inspector makes.

No foreign keys, consistent with the rest of the schema. A note whose target has been
deleted is orphaned rather than cascaded; see Retention below.

## API

Notes do not fit the existing `POST /api/workspace` action dispatch — that handler
caps bodies at 6 KB and has no update or delete path. Give notes their own route.

```
GET    /api/notes?kind=entity&id=thiel        → { notes: [...] }
POST   /api/notes    { kind, id, body }       → { ok, id }        201
PATCH  /api/notes    { noteId, body }         → { ok }
DELETE /api/notes    { noteId }               → { ok }
```

Mirror the conventions already in `app/api/workspace/route.ts` exactly:

- `authenticatedUser(request)` first, `unauthorized()` if absent
- origin check on every mutating method
- `Content-Type: application/json` required, 415 otherwise
- `Cache-Control: private, no-store` on every response
- errors as sentences: *"Write something before saving."*

Limits: body 1–8000 characters, 500 notes per target. Raise the request-size cap for
this route to 16 KB — 6 KB is the workspace route's number and it is too tight for
prose.

On `POST`, verify the target exists before inserting. `entity` and `connection` are
lookups against their tables; `article` is a lookup against `articles` by id. A note
against a target that does not exist is a bug that surfaces months later as an empty
panel, so fail loudly at write time with 404.

`created` is never modified. `updated` changes on every `PATCH`.

## Ordering

Return notes newest-first (`ORDER BY created DESC`). A dossier is read as a running
log — the most recent thought is the one you want at the top. This differs from
articles, which are ordered by `published` for the same reason.

## Client

Adding a note is the only genuinely new interaction. Everything else is display.

Until [step 4](step-4-shell.md) rebuilds the Inspector, put it in the existing entity
`Sheet` in `app/page.tsx`: a `<textarea>` and a save button under the description,
with the note list below. That is enough to start using the feature, and it will be
lifted into the Inspector wholesale later.

Do not build a rich text editor. Plain text, preserved line breaks
(`white-space: pre-wrap`). Markdown is a later decision, and once notes contain
markup that decision is much harder to reverse.

## Retention

Deleting an entity or connection does not delete its notes — nothing in this codebase
cascades, and losing written work to a mis-click is worse than an orphaned row.
There is currently no delete path for entities at all, so this is theoretical, but
when one is added, notes should be presented for confirmation rather than removed
silently.

## Verification

```bash
curl -s -H "Cookie: __sites_local_auth=1" -H "Content-Type: application/json" \
  -d '{"kind":"entity","id":"thiel","body":"Founders Fund and Palantir overlap more than the filings suggest."}' \
  http://localhost:3000/api/notes

curl -s -H "Cookie: __sites_local_auth=1" "http://localhost:3000/api/notes?kind=entity&id=thiel"
```

Passing means:

1. The note comes back with `created` and `updated` equal.
2. A `PATCH` changes `body` and `updated` but leaves `created` untouched.
3. `POST` against `kind=entity&id=nonexistent` returns 404, not 201.
4. `POST` with an 9000-character body returns 400 with a readable sentence.
5. A note written against one entity does not appear in another entity's list.
