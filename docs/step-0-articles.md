# Step 0 — Promote articles to first-class rows

Status: not started
Depends on: nothing
Blocks: step 1 (per-node crawling), step 2 (notes), the per-node dossier UI

## Why

Articles currently exist only inside `briefings.content`, as one JSON blob per day.
Nothing can be asked of them. "Which articles mention Thiel?" requires parsing every
blob for every day. Per-node crawling (step 1) and per-article notes (step 2) both
need articles addressable by id.

This step adds that addressability and nothing else.

## Hard constraint: additive only

This change must not alter any existing behaviour. After it ships:

- `GET /api/briefing` returns exactly what it returned before
- `GET /api/briefing?archive=1` and `?date=` keep working off the `briefings` table
- The UI is untouched

New rows start accumulating alongside the existing blob. If the new write path
throws, the briefing must still be returned — see "Failure handling".

Do not change: `app/page.tsx`, `lib/access.ts`, the `entities` / `connections` /
`briefings` / `settings` tables, or anything about per-entity feeds (that is step 1).

## Schema

Add to `db/schema.ts`, matching the existing compact style. Note the extra
`index` import from `drizzle-orm/sqlite-core`.

```ts
export const articles=sqliteTable("articles",{
  ownerId:text("owner_id").notNull(),
  id:text("id").notNull(),
  title:text("title").notNull(),
  url:text("url").notNull(),
  source:text("source").notNull(),
  summary:text("summary").notNull().default(""),
  published:text("published").notNull(),
  firstSeen:text("first_seen").notNull()
},t=>[primaryKey({columns:[t.ownerId,t.id]}),index("articles_owner_published").on(t.ownerId,t.published)]);

export const articleEntities=sqliteTable("article_entities",{
  ownerId:text("owner_id").notNull(),
  articleId:text("article_id").notNull(),
  entityId:text("entity_id").notNull()
},t=>[primaryKey({columns:[t.ownerId,t.articleId,t.entityId]}),index("article_entities_owner_entity").on(t.ownerId,t.entityId)]);
```

`articles.id` **is** the dedup key — a normalized title (below). There is no separate
`title_key` column and no separate unique index; the primary key does the work.

`article_entities` has no foreign key (D1/SQLite here uses none elsewhere either).
Insert articles before their links and use `INSERT OR IGNORE` throughout.

## The dedup key

Add to `lib/intelligence.ts`:

```ts
export function articleKey(title:string,source:string){
  let t=title.trim();
  const suffix=" - "+source;
  if(source&&t.toLowerCase().endsWith(suffix.toLowerCase())) t=t.slice(0,-suffix.length).trim();
  return t.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"").slice(0,160);
}
```

Two things are happening:

1. **The publisher suffix is stripped.** Google News search feeds return
   `"Apocalypse prep or pure pragmatism… - The Guardian"` while the publisher's own
   feed returns the bare headline. Without stripping, the same article lands twice
   under different keys. The suffix always matches the feed's `<source>` value.
2. **The result is truncated to 160 chars**, which bounds the key size without any
   realistic collision risk for headlines.

URL is deliberately *not* part of the key. Google News links are redirects
(`news.google.com/rss/articles/CBMi…`), so the same article has different URLs
depending on which feed found it. Title is the only stable identity.

## Summary extraction

`parseRss` in `lib/feeds.ts` currently discards `<description>`. Start reading it.

The two feed shapes differ, and one of them is a trap:

- **Publisher feeds** (OpenAI, FBI) carry a real abstract — *"OpenAI introduces
  Daybreak for Frontline Defenders. A $1 billion commitment expands access…"*
- **Google News** carries an `<a href>` whose link text is just the title again,
  followed by the publisher name. Storing it is worse than storing nothing.

Detecting the echo needs one non-obvious step. Google News **double-encodes** its
payload: the XML contains `&amp;nbsp;`, so a single `decodeText` pass yields the
literal text `&nbsp;`, which survives normalization as the letters `nbsp` and
breaks any comparison against the title. `decodeText` must run twice — the second
pass strips the tags the first pass revealed and decodes the remaining entities.

Add to `lib/feeds.ts`, and take the **undecoded** description so the function
controls its own decoding:

```ts
export function feedSummary(descriptionRaw:string,title:string){
  const text=decodeText(decodeText(descriptionRaw)).replace(/\s+/g," ").trim();
  if(!text) return "";
  const n=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
  const nt=n(text),ntitle=n(title);
  if(!ntitle) return text.slice(0,600);
  if(nt===ntitle) return "";
  if(nt.startsWith(ntitle)&&nt.length-ntitle.length<40) return "";
  return text.slice(0,600);
}
```

The 40-character margin is what separates "the title plus a publisher name" from
"the title followed by an actual abstract". Verified against live feeds:
Google News keeps **0 of 100** summaries, the OpenAI feed keeps **1045 of 1170**
(the remainder are items whose description genuinely equals their title).

Add `summary` to the `Article` type in `lib/intelligence.ts` as `summary: string`.
This is the only type change; `Article.id` keeps its current meaning (the URL) so
nothing downstream shifts.

## Write path

In `app/api/briefing/route.ts`, inside the `pending` closure, after the existing
`articles` array is built and before the edition is stored:

```ts
await persistArticles(owner, articles);
```

Implement `persistArticles` in `lib/store.ts` next to the existing `db.batch` usage.
It needs `articleKey` imported from `./intelligence`, and `statements` must be typed
— `const statements=[]` infers `any[]` and trips both `strict` and the
`no-explicit-any` lint rule.

```ts
export async function persistArticles(owner:string, list:Article[]){
  const db=database();
  const now=new Date().toISOString();
  const statements:D1PreparedStatement[]=[];
  for(const a of list){
    const id=articleKey(a.title,a.source);
    if(!id) continue;
    statements.push(db.prepare(
      "INSERT INTO articles (owner_id,id,title,url,source,summary,published,first_seen) VALUES (?,?,?,?,?,?,?,?) "+
      "ON CONFLICT(owner_id,id) DO UPDATE SET url=excluded.url, summary=CASE WHEN excluded.summary<>'' THEN excluded.summary ELSE articles.summary END"
    ).bind(owner,id,a.title,a.url,a.source,a.summary??"",a.published,now));
    for(const entityId of a.entities){
      statements.push(db.prepare(
        "INSERT OR IGNORE INTO article_entities (owner_id,article_id,entity_id) VALUES (?,?,?)"
      ).bind(owner,id,entityId));
    }
  }
  for(let i=0;i<statements.length;i+=100) await db.batch(statements.slice(i,i+100));
}
```

Three behaviours worth being explicit about:

- **`first_seen` is never updated.** It records when the article first entered this
  workspace, which is what the timeline (step 5) will read.
- **`url` is overwritten** on conflict. If a publisher feed later supplies a real URL
  for an article first seen through a Google redirect, the better URL wins.
- **`summary` only overwrites when non-empty**, so a Google News re-crawl never
  erases an abstract a publisher feed already provided.

Batches are chunked at 100 statements. A 200-article refresh with entity links
produces roughly 500 statements; one batch that size is needlessly large.

## Failure handling

Wrap the `persistArticles` call so it cannot break the briefing:

```ts
try{ await persistArticles(owner, articles); }
catch(e){ console.error("Article persistence failed", e); }
```

The briefing is the user-visible product; the article table is bookkeeping for later
steps. A failure here must be logged and swallowed, never surfaced.

## Read path (verification surface)

Without this you cannot confirm the write worked from outside the database.
Add to `app/api/workspace/route.ts` `GET`, gated on a query parameter so the
existing response shape is untouched:

```
GET /api/workspace?articles=<entityId>&limit=50
→ { articles: [{ id, title, url, source, summary, published, firstSeen }] }
```

```sql
SELECT a.id,a.title,a.url,a.source,a.summary,a.published,a.first_seen AS firstSeen
FROM articles a JOIN article_entities ae
  ON ae.owner_id=a.owner_id AND ae.article_id=a.id
WHERE a.owner_id=? AND ae.entity_id=?
ORDER BY a.published DESC LIMIT ?
```

Validate `entityId` against the `entities` table and clamp `limit` to 1–200.
This query is also the seed of the per-node dossier panel later on.

## Migration

```bash
npm run db:generate
```

That writes `drizzle/0001_*.sql`. Review it — it must contain only two
`CREATE TABLE` statements and their indexes, no `ALTER` or `DROP` against
existing tables. If it proposes anything else, the schema edit was wrong.

Applying it to the local D1 needs a config file, because the D1 binding is declared
inline in `vite.config.ts` and there is no `wrangler.toml`. Write this to a scratch
path:

```json
{
  "name": "site-creator-d1-migrate",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    { "binding": "DB", "database_name": "site-creator-d1", "database_id": "00000000-0000-4000-8000-000000000000" }
  ]
}
```

```bash
npx wrangler d1 execute DB --local --config <that-file> --persist-to .wrangler/state --file drizzle/0001_<name>.sql -y
```

The `database_name` and `database_id` must match `vite.config.ts` exactly or wrangler
writes to a different SQLite file and the dev server sees nothing.

## Verification

Local dev needs a signed-in session: the `oai-authenticated-user-id` header is
injected by `@openai/sites-vite-plugin`, which strips any client-supplied copy.
Visit `/signin-with-chatgpt` once to get the `__sites_local_auth=1` cookie; the
plugin then injects the identity `local_seedy`.

```bash
curl -s -H "Cookie: __sites_local_auth=1" http://localhost:3000/api/briefing > /dev/null
curl -s -H "Cookie: __sites_local_auth=1" "http://localhost:3000/api/workspace?articles=trump&limit=5"
```

Passing means all of:

1. The briefing response is byte-for-byte the same shape as before the change.
2. `?articles=trump` returns rows, each with a real `published` timestamp.
3. Calling `/api/briefing` twice in a row does **not** duplicate rows — the second
   call is inside the 20-minute cache window, so force it by deleting the row from
   `briefings` between calls, then confirm the article count is unchanged.
4. At least one row from a publisher feed (OpenAI, FBI) has a non-empty `summary`,
   and rows sourced from Google News have `summary = ""`.
5. `SELECT count(*) FROM article_entities` is greater than `SELECT count(*) FROM articles`
   — articles routinely match more than one entity.

## Known gaps, deliberately out of scope

- **Retroactive tagging.** Adding an entity does not tag already-stored articles.
  A backfill belongs with step 1, where per-entity crawling exists to drive it.
- **Retention.** Rows accumulate indefinitely — roughly 70k/year at the current
  volume, comfortably inside D1 limits but unbounded. Revisit when step 1 multiplies
  the ingest rate.
- **The `briefings` blob is now redundant** with `articles` + `first_seen`. Leave it.
  Removing it means rewriting the archive endpoints and the UI's archive picker, and
  this step is additive by design.
