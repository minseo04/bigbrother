# Design system — dark editor

Status: done

The app moves to a fully dark interface. Read this before steps 3, 4 or 5.

## Why dark, and what it costs

The graph canvas is already dark — `#131d26` background, `#18232e` node fills, drawn
inside a light `#f3f5f7` page. Once the canvas occupies most of the viewport that
mismatch stops reading as a design choice and starts reading as a bug. Professional
canvas tools are dark throughout because the work, not the chrome, should hold the
eye.

The cost is real: 93 classes in `app/globals.css` assume a light background, and the
shadcn components are mapped to light tokens. Budget a full pass, not a find-replace.

## The problem to fix first

`app/globals.css` has a token layer, but most of the interface bypasses it. Sidebar
colours are scattered as literals — `#ef8059`, `#a6b2bc`, `#8796a3`, `#34404a`,
`#f47c56`, `#28323b` — because the sidebar was the only dark surface and nobody
needed them to be reusable. Once every panel is dark, those literals drift apart.

There is also a `@custom-variant dark` declared while `:root` and `.dark` are given
identical values, so the variant does nothing. Either implement it or remove it —
do not leave a switch wired to nothing. Recommendation: **remove it.** This app has
one theme. A theme toggle is not on the roadmap and a dead variant invites confusion.

## Palette

Four surface levels, deepest first. The canvas is the floor; panels sit above it.

| Token | Value | Use |
|---|---|---|
| `--surface-canvas` | `#131d26` | Graph viewport only |
| `--surface-0` | `#19232d` | Page and panel background |
| `--surface-1` | `#1f2b36` | Raised panel, list row hover |
| `--surface-2` | `#26333f` | Popover, menu, dialog |

`--surface-0` is the existing `--sidebar` value, kept deliberately: the sidebar
already looks right and now the rest of the app matches it rather than the reverse.

| Token | Value | Use |
|---|---|---|
| `--border` | `#2e3c48` | Default hairline |
| `--border-strong` | `#3b4a58` | Hover, focused panel edge |
| `--text-primary` | `#e6ecf1` | Body and headings |
| `--text-secondary` | `#a6b2bc` | Supporting copy, labels |
| `--text-muted` | `#7a8894` | Metadata, placeholders, disabled |

`--text-secondary` is the existing sidebar text colour, promoted to a token.

| Token | Value | Use |
|---|---|---|
| `--accent` | `#e7653c` | Primary action, active nav, focus ring |
| `--accent-hover` | `#f47c56` | Hover state, icon accents |
| `--accent-bg` | `rgba(231,101,60,0.14)` | Selected row, active tab tint |
| `--danger` | `#e0644c` | Destructive action, error text |

`--accent` is today's `--color-ring`; `--accent-hover` is the brand icon colour.
The orange gains contrast on dark rather than losing it, which is why the existing
active-nav treatment works and the light-mode buttons always felt heavy.

Entity colours are unchanged — they were chosen against a dark canvas and already
work:

| Kind | Colour |
|---|---|
| Person | `#ed997b` |
| Company | `#86a8fc` |
| Government | `#c2acf0` |
| Technology | `#78c7af` |

## Rules

**Never hardcode a colour.** If a value is not in the tables above, add a token
rather than a literal. This is the discipline that was missing before; the whole
point of the pass is to end up with one place to change.

**Elevation is background, not shadow.** Dark interfaces read depth from surface
lightness. Drop shadows on dark backgrounds turn into mud. Use `--surface-1` and
`--surface-2` and a `--border` hairline; reserve shadow for floating overlays only.

**One accent per view.** Orange marks the single most important action or the current
selection. When everything is accented nothing is.

**Borders separate, they do not decorate.** `1px solid var(--border)` between panels.
No rounded corners on panel edges that meet other panels — rounding belongs to
floating things (popovers, dialogs, cards on the canvas).

**Keep the radius scale.** `--radius-sm: 4px` through `--radius-xl: 12px` already
exist and are used consistently. Do not add new values.

**Type stays as is.** `Segoe UI` at 16px base. The interface is dense enough that
changing the family now would ripple through every measurement in `globals.css`.

## Focus and keyboard

The existing focus ring is `2px solid #e66742` with `3px` offset, applied to buttons,
links, inputs and `[role=button]`. Keep it, retokenised to `--accent`. On a dark
background it becomes more visible, not less, so there is no reason to weaken it.

An editor is a keyboard surface. Every action reachable by mouse in steps 3–4 needs a
focus-visible state, including graph nodes and edges — they are already `tabIndex={0}`
with `role="button"` in the current SVG and that must survive the React Flow port.

## Migration order

1. Add the tokens to `@theme inline` in `app/globals.css` and point the existing
   shadcn `--color-*` mappings at them.
2. Flip `--background` to `--surface-0` and `--foreground` to `--text-primary`. Most
   of the app will look approximately right immediately, and badly wrong in specific
   places — that list is the actual work.
3. Walk the 93 classes. The ones to look at first are those with light literals:
   `.entity-card`, `.article-row`, `.stats-strip`, `.source-card`, `.desk-dialog`.
4. Delete `@custom-variant dark` and the now-redundant `.dark` selector.

Do this as its own commit, before step 4 touches layout. Mixing a colour migration
with a structural rewrite makes both impossible to review.
