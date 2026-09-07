# Step 1 — Per-node crawling

Status: done
Depends on: [step 0](step-0-articles.md)
Blocks: the per-node dossier panel in [step 4](step-4-shell.md)

## Why

Collection today is six fixed feeds, and an entity appears in your workspace only if
it happens to be named in one of their headlines. Follow a small company and you will
see nothing about it, ever. That is not "the app collects information about the
things I follow" — it is "the app shows me general news and tags it".

This step inverts it: **every node gets its own feed.**

## The mechanism

Google News exposes a search feed that takes an arbitrary query:

```
https://news.google.com/rss/search?q=%22Peter+Thiel%22&hl=en-US&gl=US&ceid=US:en
```

Verified live: HTTP 200, 100 items, identical RSS shape to the topic feeds already
being parsed. `parseRss` handles it unchanged. No API key, no new dependency.

Quote the query (`%22…%22`) so multi-word names match as a phrase. Without quotes,
"Sam Altman" returns everything mentioning either word.

## Schema

Two columns on `entities`:

```ts
feedUrl:text("feed_url").notNull().default(""),
lastCrawled:text("last_crawled").notNull().default("")
```

`feed_url` empty means "derive a Google News search from the entity name".
A non-empty value overrides it — this is how you point a node at a publisher's own
RSS, which is always higher quality than a news aggregator:

```
palantir  → https://investors.palantir.com/rss/news-releases.xml
anduril   → https://www.anduril.com/news/rss
```

Expose it on the existing `POST /api/workspace` `add` action as an optional
`feedUrl` field, validated through `safeWebUrl`. Also accept an `action: "feed"`
to change it on an existing entity. Both are small additions to the current
dispatch; do not build a new endpoint.

## The constraint that shapes everything

**A Worker may make 50 outbound fetches per request on the free plan, 1000 on paid.**
One hundred entities crawled in one pass exceeds the free limit outright and is slow
even when it fits.

So crawling is **rotational**: each pass takes the N stalest entities, crawls those,
stamps `last_crawled`, and stops.

```ts
const BATCH = 8;

const due = await db.prepare(
  "SELECT id,name,feed_url FROM entities WHERE owner_id=? AND followed=1 ORDER BY last_crawled ASC LIMIT ?"
).bind(owner, BATCH).all();
```

`ORDER BY last_crawled ASC` with an empty-string default puts never-crawled entities
first automatically — no null handling, no separate seeding pass.

At 8 per pass and a pass every 20 minutes, 100 entities cycle in about four hours.
Raise `BATCH` on a paid plan; it is the only number that needs to change.

## Where a pass runs

`vinext/server/fetch-handler` exports only `fetch` — there is no `scheduled` export,
so **Cron Triggers do not work out of the box.** Two options, in order of preference.

### Recommended: ride the existing refresh

`GET /api/briefing` already refreshes opportunistically behind a 20-minute cache and
already deduplicates concurrent callers through `pendingByOwner`. Add the crawl pass
inside that same closure, after the fixed feeds are fetched:

```ts
const fixed = await Promise.all(sources.map(s => fetchFeed(s, entities)));
const crawled = await crawlDue(owner, entities, BATCH);
const results = [...fixed, ...crawled];
```

Six fixed feeds plus eight entity feeds is fourteen subrequests — comfortably inside
the free-plan limit, with room to raise `BATCH` later.

This needs no new infrastructure, no secret, and no change to how the app is
deployed. It has one real drawback: crawling only happens while somebody has the app
open. For a single-user personal workspace that is an acceptable trade, and it is
reversible.

### If you want crawling without the app open

Wrap the handler in a custom worker entry. This is documented by vinext itself:

> Or import and delegate to it from a custom worker:
> `import handler from "vinext/server/fetch-handler"; return handler.fetch(request, env, ctx);`

```ts
import handler from "vinext/server/fetch-handler";
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => handler.fetch(req, env, ctx),
  scheduled: async (_e: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(crawlAllOwners(env));
  },
};
```

Then point `main` at that file in both `localBindingConfig` (`vite.config.ts`) and
the generated `dist/server/wrangler.json`, and add `triggers.crons`. The wrapping
pattern is documented; how the build treats a custom `main` is **not verified** —
prove it on a throwaway deploy before committing to it.

A scheduled handler also has no request identity, so `crawlAllOwners` must enumerate
owners from the `entities` table rather than reading a header.

## Crawl implementation

Add to `lib/feeds.ts`:

```ts
export function entityFeed(entity:Entity){
  if(entity.feedUrl) return entity.feedUrl;
  return "https://news.google.com/rss/search?q="+encodeURIComponent('"'+entity.name+'"')+"&hl=en-US&gl=US&ceid=US:en";
}
```

Then reuse `fetchFeed` unchanged — it already has the 12-second timeout, the 1.5 MB
cap, the streaming reader and the failure-to-empty-array behaviour. Build a `Source`
per entity:

```ts
{ id: "entity:"+entity.id, name: entity.name, url: "https://news.google.com/", feed: entityFeed(entity) }
```

Two behaviours to add on top:

**Force the entity tag.** `parseRss` matches aliases against the headline, and a
search result for "Peter Thiel" may not repeat his name in the title. The existing
code already does this for the fixed feeds (`if(source.id==="openai"&&!entityIds.includes("openai"))`).
Generalise it: when a source id starts with `entity:`, that entity is always tagged.

**Stamp on attempt, not on success.** Update `last_crawled` even when the fetch
fails. Otherwise one permanently broken feed is retried on every pass forever and
starves the rotation.

## Rate limiting

Eight concurrent requests to Google News from one Worker IP is fine. A hundred is
not — expect throttling or empty responses if `BATCH` is raised aggressively. Keep
passes small and spaced; that is what the rotation already gives you.

If a feed returns non-200 twice in a row, consider recording the failure rather than
retrying silently. Not required for this step, but the `Source.status` field the UI
already renders is the natural place to surface it.

## Backfill

New entities added before this step have `last_crawled = ""` and sort to the front of
the rotation automatically. There is nothing to backfill.

Articles stored in step 0 are not retroactively tagged when a new entity is added.
That is now worth fixing, because per-node crawling makes it visible — a newly
followed entity shows an empty dossier despite months of stored articles that mention
it. Add a one-shot re-tag on entity creation:

```sql
INSERT OR IGNORE INTO article_entities (owner_id,article_id,entity_id)
SELECT ?,id,? FROM articles WHERE owner_id=? AND lower(title) LIKE ?
```

A `LIKE` scan is crude next to `entityMatches`, but it runs once per entity against a
table of tens of thousands of rows, and the crawl fills in properly from there.

## Verification

```bash
curl -s -H "Cookie: __sites_local_auth=1" http://localhost:3000/api/briefing > /dev/null
curl -s -H "Cookie: __sites_local_auth=1" "http://localhost:3000/api/workspace?articles=palantir&limit=10"
```

Passing means:

1. `palantir` returns articles, where before step 1 it returned few or none — it is
   not a headline that shows up in general news feeds.
2. `SELECT id,last_crawled FROM entities ORDER BY last_crawled` shows exactly `BATCH`
   entities stamped after one refresh, and a different `BATCH` after the next.
3. A deliberately broken `feed_url` still gets its `last_crawled` stamped, and the
   briefing still returns 200.
4. Total outbound fetches per refresh is `6 + BATCH`. Confirm in the dev server log
   before raising `BATCH`.
