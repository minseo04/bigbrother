# Big Brother

A private desk for public information.

You follow people, companies, government bodies and technologies. The app collects
what gets published about each one, and you write your own notes against what it
finds. Relationships between them are drawn on a canvas you arrange yourself, and
every one carries the source it came from.

There is no AI in the product. Collection is RSS, matching is string comparison,
and every conclusion in the workspace is one you wrote.

## What it does

**Collects per node.** Each entity gets its own feed — a Google News search by
default, or a publisher's own RSS if you point it at one. A bounded rotation
crawls the least recently checked entities on each refresh, so the number of
outbound requests stays flat as the watchlist grows.

**Maps relationships.** A graph editor where you drag nodes into place and draw
connections between them. Every connection stores its evidence, a source URL and
a date, and is marked either `Documented` or `Hypothesis` so a guess never reads
as a fact.

**Keeps your reading.** Notes attach to entities, connections and articles, and
accumulate over time. This is the half of the workspace that is not automated.

**Moves through time.** A scrubber filters the network to a chosen date, so you
can see the graph as your sources described it in 2023 rather than today.

**Explains itself on hover.** Resting on a node or a connection opens a card with
what it is: category, description, how many links and notes it carries, or — for a
connection — its evidence, its date, whether it is documented or a hypothesis, and
the publication the claim came from.

**Shares a board, read-only.** Any board can be published as a link. The token in
that link is the only credential a visitor needs to read, revoking it deletes the
row and kills the link, and a board set to private closes the link without
deleting it. A shared board carries its
entities, its connections and the source behind each one; your notes stay private
and only their count travels.

**Holds any attribute you want to record.** Beyond the fields the seed provides,
an entity takes free key/value attributes — each with the source it came from.
Those attributes are the columns of a table view of the whole workspace, which
sorts, picks its columns, and downloads for pandas as two tables — nodes with
their attributes, connections with their evidence — in CSV or JSON. The board's
layout comes as an optional third file holding only the shape: node ids, their
coordinates, and which pairs are joined.

**Groups by whichever column you like.** The map's group-by picker is built from
the data rather than a fixed list, and it says how many piles each column would
make. A grouping draws itself — a node for the dimension, a hub for each value,
a line from one to the other. Turn on a second dimension and its piles sit under
the map, joined to the ones they share entities with. Hubs answer to hover and
open their members, but they exist only while the grouping does.

**Takes suggestions on a public board.** A board can be opened to readers, who
may propose an attribute, a connection, an entity, or another source for a claim
— always with a URL behind it. Suggestions wait in four inboxes and change
nothing until the owner accepts them; accepted ones keep their source and the
name their author chose to travel under. The owner decides who may send them:
anyone signed in, people with a public profile, or an invited list.

**Lets the reader choose the interface.** A shared board opens on the map its
author arranged, but the visitor can switch it to a table, a card grid, or a
timeline of connections by date, and can search it, filter it by category, sort it,
switch to a light background, and tighten the spacing. Those choices are theirs,
kept on their own device, and applied to every board they open.

## Stack

| | |
|---|---|
| Framework | [Next.js](https://nextjs.org) 15 App Router |
| UI | React 19, shadcn on `@base-ui/react`, Tailwind 4 |
| Graph | [React Flow](https://reactflow.dev) with `d3-force` for the initial layout |
| Runtime | Vercel (Node.js) |
| Storage | SQLite via [Turso](https://turso.tech) / libSQL locally as `data/bigbrother.db` |
| Tooling | oxlint, oxfmt, TypeScript 5.9 |

Desktop only. The interface is a docked editor shell and does not attempt to work
on a phone.

## Running it

Requires Node 22.13 or newer.

```bash
npm install
npm run dev
```

The dev server listens on port 3000. Sign in with **Continue locally** — that sets
a session cookie and seeds the workspace on first request.

```bash
curl -s -c cookies.txt http://localhost:3000/api/auth/local
curl -s -b cookies.txt http://localhost:3000/api/workspace
```

Local data lives in `data/bigbrother.db`. Migrations from `drizzle/` run on first
use. `npm run db:generate` still writes new SQL from `db/schema.ts`.

Other scripts:

```bash
npm run build        # production build
npm run start        # serve the production build
npm run lint         # oxlint
npm run format       # oxfmt
npm run db:generate  # drizzle-kit generate
```

## Deploying on Vercel

The filesystem on Vercel is ephemeral, so production needs a hosted SQLite
database. [Turso](https://turso.tech) is the drop-in:

1. Create a database and copy the URL and token.
2. Import the GitHub repo into Vercel.
3. Set environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | yes | Signs session cookies. `openssl rand -base64 32` |
| `TURSO_DATABASE_URL` | yes | `libsql://…` |
| `TURSO_AUTH_TOKEN` | yes | Turso token |
| `AUTH_ALLOW_LOCAL` | for a private single-user deploy | Set to `1` to keep the local continue button |
| `AUTH_PASSWORD` | optional | Password sign-in; identity is `AUTH_USER_ID` or `owner` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth. Callback: `https://<host>/api/auth/github/callback` |

Copy `.env.example` for the full list. Shared boards stay public via their token
and do not need a session.

## Layout

```
app/            routes and the page shell
  api/          workspace, briefing, notes, share, contribution and profile endpoints
  s/[token]/    the public read-only view of a shared board
components/     editor shell, graph, inspector, outliner, dock, shared view
  ui/           generated shadcn components
lib/            feeds, crawling, storage, graph layout, table, permissions, stores
db/             Drizzle schema
drizzle/        generated migrations
docs/           build plan — one document per step
```

[docs/README.md](docs/README.md) is the index for the build plan. Each step
document carries its own schema, implementation notes and verification steps, and
records what was deliberately left out.

## About the seed data

The workspace ships with fifteen public entities and fourteen relationships between
them. Every relationship cites a primary source — an SEC filing, a congressional
record, an official announcement — and the wording is deliberately narrow. Where a
source is undated, the entry says so and shows the date it was checked. Where an
affiliation is historical, it says that rather than implying a current role.

That discipline is the point of the project. A graph of named people is only worth
having if each line can be traced back to something you can read yourself.

## Licence

None yet — all rights reserved.
