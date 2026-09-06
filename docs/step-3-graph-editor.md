# Step 3 — Graph editor

Status: blocked: required browser drag, reload, and undo verification cannot run; browser startup failed twice, including after a session reset (Windows sandbox setup refresh errors, then trusted Node process exit).
Depends on: [design-system.md](design-system.md)
Blocks: [step 4](step-4-shell.md), [step 5](step-5-timeline.md)

## Why

The current graph is not a graph. `app/page.tsx:12` holds a hand-written coordinate
table for the fifteen seed entities, and anything you add falls into a grid
(`[65+(i%5)*170, 75+Math.floor(i/5)*125]`) with no relationship to what it connects
to. Nothing can be moved. Connections are created through a dialog with two
dropdowns.

This step replaces all of that with a real editor.

## Stack

```bash
npm install @xyflow/react d3-force zustand zundo
```

| Package | Version | Licence | Role |
|---|---|---|---|
| `@xyflow/react` | 12.11.6 | MIT | The editor |
| `d3-force` | 3.0.0 | ISC | Initial layout, run once |
| `zustand` | 5.0.15 | MIT | App state |
| `zundo` | 2.3.0 | MIT | Undo/redo |

Verified: installs clean against React 19.2.6 with no peer conflicts (17 packages).
React Flow's peer range is `react >=17`. Its core is MIT and complete — the Pro
subscription buys examples and support, not features.

Chosen over Cytoscape.js because React Flow's nodes **are React components**, so the
existing shadcn vocabulary renders inside them. Cytoscape is stronger at graph
algorithms, but those are ~100 lines of BFS at this scale and can be added later
through `graphology` without touching the renderer.

## Verified API surface

All confirmed against the installed package at runtime, not from memory:

```ts
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  Panel, Handle, Position, ConnectionMode, MarkerType, BaseEdge, getBezierPath,
  useNodesState, useEdgesState, useReactFlow, addEdge, applyNodeChanges, applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
```

Enum values:

```
BackgroundVariant  { Lines: "lines", Dots: "dots", Cross: "cross" }
ConnectionMode     { Strict: "strict", Loose: "loose" }
Position           { Left: "left", Top: "top", Right: "right", Bottom: "bottom" }
MarkerType         { Arrow: "arrow", ArrowClosed: "arrowclosed" }
```

In v12 `NodeProps` is generic over the node type: `NodeProps<NodeType extends Node = Node>`.
Define `type EntityNode = Node<{ entity: Entity }, "entity">` and type the component
as `NodeProps<EntityNode>`.

## Three failure modes to avoid

**A container with no height renders nothing.** This is the most common React Flow
bug and it produces a blank area with no error. The wrapper needs an explicit height,
and every ancestor between it and the viewport needs one too.

**`nodeTypes` defined inside the component remounts every node on every render.**
Declare it at module scope, or memoise it. Same for `edgeTypes`.

**`"use client"` is required.** `app/page.tsx` already has it. Any new component file
that imports React Flow needs its own.

## Layout

React Flow does not lay out graphs; it draws coordinates you give it. `d3-force`
supplies them.

```ts
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";

export function seedLayout(entities:Entity[], connections:Connection[]){
  const nodes = entities.map(e => ({ id: e.id }));
  const links = connections.map(c => ({ source: c.from, target: c.to }));
  forceSimulation(nodes)
    .force("link", forceLink(links).id((d:any) => d.id).distance(180))
    .force("charge", forceManyBody().strength(-800))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(90))
    .stop()
    .tick(400);
  return Object.fromEntries(nodes.map((n:any) => [n.id, [Math.round(n.x), Math.round(n.y)]]));
}
```

**Run it once, then freeze.** `.stop()` before `.tick(400)` runs the simulation
synchronously to a settled state with no animation. A continuously running simulation
moves nodes under the cursor while you are trying to work, which is intolerable in an
editor — Unity and Illustrator do not rearrange your document while you point at it.

Run `seedLayout` only when a node has no stored position. Existing positions always
win; the layout is a starting point, not an authority.

`elkjs` was considered and rejected: it is built for layered flowcharts rather than
undirected knowledge graphs, and its licence (`EPL-2.0 OR GPL-3.0`) is heavier than
anything else in this project.

## Persistence

Positions go in the existing `settings` table. **No migration is needed.**

```
key   = "layout"
value = {"thiel":[180,115],"palantir":[-40,260], ...}
```

One hundred entities at roughly 30 bytes each is about 3 KB, inside the workspace
route's 6 KB body cap. If the cap is ever hit, that is the signal to move positions
onto `entities` as `x`/`y` columns — not before.

Save on `onNodeDragStop`, debounced by ~600 ms so a drag that ends near another drag
sends one request. Add `action: "layout"` to the existing workspace POST dispatch.

Viewport (pan and zoom) is per-device convenience, not shared state. Keep it in
`localStorage` and wrap every access in try/catch — it throws in some contexts.

## Node component

The visual language already exists in the current SVG and should carry over: a
circle stroked in the entity's kind colour, initials centred, name on a plate below.
Rebuild it as a React component so it can hold real interface — a follow toggle, a
note count, a connection count.

```tsx
const nodeTypes = { entity: EntityNode };   // module scope

function EntityNode({ data, selected }: NodeProps<EntityNodeType>) {
  const { entity } = data;
  return (
    <div className={"graph-node" + (selected ? " is-selected" : "")}>
      <Handle type="target" position={Position.Left} />
      <span className="node-initials" style={{ "--entity-color": entity.color } as CSSProperties}>
        {entity.initials}
      </span>
      <span className="node-label">{entity.name}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

Use `ConnectionMode.Loose` so a drag can start from either handle. The graph is
undirected in meaning — "Thiel — Palantir" reads the same both ways — even though
`connections` stores a `from` and a `to`.

Size nodes by degree rather than the current `e.id==="openai"` special case. Betweenness
centrality is more informative (US Congress 39.0, OpenAI 31.5, Sam Altman 30.0 on the
seed graph — Altman ranks third on two connections because he is the only bridge
between the company cluster and the government cluster) but degree is one line and a
reasonable first cut.

## Edges

Three states, and they must be distinguishable at a glance:

| `status` | Line | Meaning |
|---|---|---|
| `Documented` | solid, `--border-strong` | Backed by a cited source |
| `Hypothesis` | dashed | Your own reading |
| selected | solid, `--accent`, thicker | Current selection |

The existing dashed treatment for `Hypothesis` is already correct — preserve it.

Clicking an edge opens its evidence. The current implementation gets this right with
a transparent 15px-wide hit path over the visible line; React Flow provides the
equivalent through `interactionWidth`, which defaults to 20.

## Creating connections

This is the interaction that justifies the whole step. Dragging from one node's
handle to another's replaces the two-dropdown dialog.

`onConnect` fires with `{ source, target }`. A connection still requires a label,
evidence, a source URL and a date, so open the existing form pre-filled with the two
endpoints rather than writing a bare edge. The dialog stays; what changes is that
you no longer choose the endpoints in it.

Reject invalid connections before the form opens, via `isValidConnection`:
self-connections, and pairs that already have an edge.

## Tool modes

React Flow exposes these as props, so modes are a state variable, not a subsystem:

| Key | Mode | Props |
|---|---|---|
| `V` | Select | default |
| `H` | Pan | `nodesDraggable={false}` `panOnDrag` |
| `C` | Connect | `nodesDraggable={false}`, handles emphasised |
| `N` | New node | click on canvas opens the add-entity form at that position |

Bind them with a `keydown` listener that ignores events originating in an input or
textarea — the search box already binds `⌘K` and notes will bind nothing, but a
single-letter shortcut firing while someone types is a classic bug.

## Undo

Wrap the zustand store in `zundo`'s `temporal` middleware and bind `⌘Z` / `⌘⇧Z`.
Track node positions and edge creation. Do **not** track viewport, selection, or
anything loaded from the server — undoing a pan is confusing and undoing a fetch is
meaningless.

## What is deleted

- `locations`, `app/page.tsx:12`
- the entire `Graph` component, `app/page.tsx:30`
- `zoom` state and the `<g transform>` wrapper — React Flow moves the viewport
  outside React's reconciliation, which also removes the full re-render on every
  zoom step that the current implementation performs
- the grid coordinate fallback

## Verification

1. Drag a node, reload, and it stays where you put it.
2. Drag from one node's handle to another; the connection form opens with both
   endpoints filled in.
3. Attempting to connect a node to itself does nothing.
4. A fresh workspace with no stored layout produces a readable arrangement rather
   than a pile at the origin, and the Anthropic cluster sits visibly apart from the
   rest — it is a genuinely separate component in the seed data.
5. `⌘Z` after a drag returns the node to its previous position.
6. `npx tsc --noEmit` clean; `npx oxlint` no worse than the existing 43 errors.
