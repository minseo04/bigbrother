# Step 4 — Editor shell

Status: done
Depends on: nothing outstanding — every other step is done and merged into this branch

## Starting point

Steps 0–3 and 5 all landed before this one, so parts of what follows are already
true. Read this section before the rest of the document, which was written against
the pre-step-3 codebase.

Already done, do not redo:

- The colour migration. `design-system.md` is applied; step 1 below is complete.
- `locations`, the hand-written coordinate table, and the old `Graph` component are
  gone. React Flow renders the viewport from `components/graph-editor.tsx`.
- `components/graph-timeline.tsx` exists and works (step 5). It needs a home in the
  shell, not an implementation.
- `components/notes-panel.tsx` exists and is mounted inside the entity `Sheet`.
  Lift it into the Inspector rather than rebuilding it.

Still true:

- `app/page.tsx` is one client component, about 25 KB, holding 31 `useState` calls
  and the five-view router. This step is what breaks it up.
- The entity `Sheet` is still the only place entity detail appears.

## Why

The app is a scrolling dashboard: five views swapped through a sidebar, each a page
of cards. Once the graph is editable, that shape fights it — you cannot look at a
node and its notes at the same time, because the entity detail is a `Sheet` that
slides over the canvas and has to be dismissed before you can do anything else.

An editor shell fixes that by giving every part of the workspace a fixed place.

## Layout

Four regions, in the arrangement every canvas tool converges on:

```
┌──────────────────────────────────────────────────────┐
│  toolbar        V  H  C  N              search       │
├──────────┬────────────────────────────┬──────────────┤
│ Outliner │        Viewport            │  Inspector   │
│          │                            │              │
│ People 4 │      the graph             │  Peter Thiel │
│ Cos    4 │                            │  ─────────── │
│ Gov    4 │                            │  Information │
│ Tech   3 │                            │  Notes       │
│          │                            │  Connections │
├──────────┴────────────────────────────┴──────────────┤
│  Briefing 30 │ Sources 6 │ Evidence 14               │
└──────────────────────────────────────────────────────┘
```

`react-resizable-panels` (4.5.8) and `components/ui/resizable.tsx` are **already
installed** — the docking behaviour costs nothing but wiring.

Sizes: Outliner 200px default (min 160, collapsible), Inspector 320px default
(min 260), bottom dock 240px default (min 0, collapsible). Viewport takes the rest
and has no minimum below 400px. Persist panel sizes to `localStorage`, not the
server — panel layout is per-device.

## Where the current views go

Nothing is being invented. The content already exists; it is being given a permanent
home instead of a route.

| Today | Becomes |
|---|---|
| `Sheet` entity detail | **Inspector**, always visible |
| Watchlist view | **Outliner**, a tree grouped by kind |
| Daily briefing view | Bottom dock tab |
| Sources view | Bottom dock tab |
| Connection map view | The viewport itself |
| Overview view | Deleted — the shell shows all of it at once |
| Add-connection dialog | Kept, but opened by dragging between nodes |

Deleting Overview is the point of the exercise. It exists only to summarise four
things you could not otherwise see simultaneously.

## Outliner

A tree: kind groups, entities beneath, collapsible. Not a grid of cards.

- Selection is shared with the viewport in both directions — clicking here selects
  the node there, and vice versa.
- Show the follow state inline; make it toggleable without opening anything.
- Search filters this list. The existing `⌘K` binding focuses it.
- Order alphabetically within a group. The current view orders by `rowid`, which is
  insertion order, which is meaningless to a reader.

## Inspector

Three sections, in this order. The order matters: what the app found, then what you
made of it, then how it relates.

**Information** — articles from `article_entities`, newest first, paginated.
Requires [step 0](step-0-articles.md); before that, filter the briefing in memory as
the current `Sheet` does. Each row: source, date, title, and the summary when one was
captured.

**Notes** — a textarea at the top, existing notes below, newest first. Requires
[step 2](step-2-notes.md). This is the only writable surface in the app and it should
look like it: give it real space, not a collapsed accordion.

**Connections** — the current `Sheet`'s connection list, largely unchanged. Each row
shows the other endpoint, the label, the status, and opens the evidence dialog.

Above the sections: name, kind, initials badge, follow toggle, entity source link.
Selecting an edge instead of a node swaps the Inspector to the connection's evidence,
its own notes, and its two endpoints.

With nothing selected, show workspace totals — the stats currently in the Overview
strip. That is where they belong: ambient context, not a destination.

## Bottom dock

Tabs, with counts in the labels. Collapsible to a tab bar, and collapsed by default
on first run — the canvas should be the first thing you see.

**Briefing** — the merged feed, filterable to followed entities as today. Clicking an
article selects its entities in the graph. This is the connection between reading and
the map, and it is the reason the briefing belongs in the shell rather than on its own
page.

**Sources** — feed health, per entity once step 1 lands. A feed that has failed
repeatedly should be visible here, not silent.

**Evidence** — every connection with its label and status. The Connection map view's
list, unchanged.

## Toolbar

Tool modes from [step 3](step-3-graph-editor.md) (`V` `H` `C` `N`), the search field,
and nothing else. No menu bar. `components/ui/menubar.tsx` is installed but a menu bar
implies File/Edit/View semantics this app does not have — there are no documents and
no import/export.

Right-click on a node or edge opens a context menu instead
(`components/ui/context-menu.tsx`, also already installed): follow, add note,
add connection, open source.

## Mobile

**Dropped.** This shell does not work below about 1100px and should not try. Mobile
is a separate project.

Do not delete the PWA manifest or service worker — an installed desktop web app is
still the intended distribution, and `public/sw.js` only caches the offline shell.
Do remove `hooks/use-mobile.ts` and the sidebar's mobile sheet behaviour once nothing
references them.

Below the minimum width, render a single message rather than a broken layout.

## Order of work

1. Colour migration first, as its own commit — see
   [design-system.md](design-system.md). Mixing a repaint with a re-layout makes both
   unreviewable.
2. Shell skeleton with the existing views dropped into panels unchanged.
3. Split the `Sheet` into the Inspector's three sections.
4. Outliner tree.
5. Bottom dock tabs.
6. Delete Overview and the view router.

Step 1 above is already done — start at step 2.

`app/page.tsx` is one component holding 31 `useState` calls and the view router. It
does not survive this step intact. Split it as the panels are built — one file per
region, with the zustand store from step 3 as the seam between them.

Commit after each of the six, not at the end. A half-finished rewrite of this file
leaves the app unable to render at all, so each commit needs to be a point the app
still runs from.

## Verification

1. Selecting a node in the Outliner moves the Inspector and highlights it in the
   viewport.
2. Writing a note does not disturb the viewport — no pan, no zoom, no re-layout.
3. Panel sizes survive a reload; node positions survive a reload.
4. Collapsing the bottom dock and the Outliner leaves the canvas full-width with no
   layout jump.
5. Every interactive element is reachable by keyboard, including graph nodes, and
   shows the focus ring from the design system.
6. Nothing in the interface uses a colour absent from
   [design-system.md](design-system.md).
