# Step 5 — Timeline

Status: done
Depends on: [step 3](step-3-graph-editor.md), [step 4](step-4-shell.md); much better
with [step 0](step-0-articles.md)

## Why

Every other feature in this plan makes the app match what comparable tools already
do. This one does not exist elsewhere, and the data is already sitting there.

Every connection carries a `date`. Every article carries `published`, and after step 0
also `first_seen`. The seed graph alone spans eleven years, from the 2015 OpenAI
launch announcement to a 2026 SEC filing. Nothing in the interface acknowledges that
the network has a shape in time.

A scrubber along the bottom of the canvas answers a question no list can:
**what did this network look like in 2023?**

## Behaviour

One control: a range from the earliest to the latest date in the workspace, with a
handle. Moving the handle sets an "as of" date. The graph shows the network as it
stood then.

| Element | Rule |
|---|---|
| Connection | Visible when `date <= asOf` |
| Entity | Visible when it has at least one visible connection, or `first_seen <= asOf` |
| Article | Visible when `published <= asOf` |

Nodes and edges outside the window **fade rather than disappear** — drop to about 15%
opacity and remove them from hit-testing. Removing them entirely makes the graph
jump around as you scrub, and the jumping is what makes a timeline feel broken.
Positions must never change while scrubbing; the layout is fixed and only visibility
varies.

Default position is the right end (today), where behaviour is identical to having no
timeline at all. That matters: someone who never touches the control should not be
able to tell it is there.

## Interaction

- Drag the handle to scrub.
- `←` / `→` step by one month, `⇧` for one year.
- Double-click resets to today.
- Show the resolved date as text next to the handle. A scrubber without a readout is
  a guessing game.
- While scrubbing, show what is hidden — *"3 connections after 12 March 2023"* —
  otherwise a faded graph reads as a rendering bug.

Scrub state is ephemeral. It is not persisted, not in the undo stack, and not in the
URL. It is a lens you hold, not a document you edit.

## Implementation

Filtering is a client-side pass over data already loaded; it needs no endpoint.

```ts
const asOfKey = asOf.toISOString().slice(0, 10);
const dimmed = connections.filter(c => c.date > asOfKey).map(c => c.id);
```

React Flow takes `hidden` and `style` per element, so dimming is a property change,
not a re-render of the graph. Keep `asOf` out of the zustand store if the store is
wrapped in `zundo` — scrubbing must not fill the undo stack.

Bounds come from the data:

```sql
SELECT min(date) AS from_date, max(date) AS to_date FROM connections WHERE owner_id=?
```

Clamp the upper bound to today. `connections` already rejects future dates on write,
but articles do not, and a feed with a bad `pubDate` should not stretch the axis into
2031.

If the whole workspace spans less than about three months, hide the control. A
scrubber over a two-week range is noise.

## A caveat worth stating in the interface

`connections.date` is the date of the *source*, not of the relationship. The seed
data is honest about this — two rows carry the note *"The source is undated; the
displayed date is the date checked."* So "as of 2023" means "using sources published
by 2023", which is a weaker claim than "as things stood in 2023".

Say so, once, near the control. The distinction is the difference between a research
tool and something that quietly invents history.

## Later

Not part of this step, but this is where they would go:

- A density strip behind the scrubber showing article volume over time, which turns
  the control into a chart of when your entities were in the news.
- Marks on the axis for connection dates, so you can scrub to the next event rather
  than hunting for it.

Both need step 0's article rows to be worth building.

## Verification

1. At the right end, the graph is identical to having no timeline.
2. Scrubbing to 2016 leaves only the two 2015 OpenAI connections at full opacity.
3. Node positions do not move at any point during a scrub.
4. Faded nodes cannot be clicked or focused.
5. Scrubbing does not add entries to the undo stack.
6. A workspace with a range under three months does not render the control.
