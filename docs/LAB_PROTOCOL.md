# Algorithm Lab trace protocol v1

The Algorithm Lab plays real XIOM programs. A Lab program is an ordinary
program that prints one **trace event per line** to stdout; the browser parses
those lines as data and replays them as an animation. Nothing about the
animation is pre-baked: every frame comes from the program's own output, so
editing and re-running the code re-derives the visualization.

- Parser: `js/lab-trace.js` (shared by the browser and `tools/lab-audit.js`).
- Player: `js/lab-player.js` (pure state machine, no DOM).
- Audit: `tools/lab-audit.js` runs every Lab program, validates its trace,
  checks determinism, and checks the `// @step` annotations against the trace.
- Catalog generator: `tools/generate-lab-index.js` builds `lessons/lab/index.json`
  from the entry files; never hand-edit the index.

## Line grammar

    v1|<event>|<key>=<value>|<key>=<value>|...|step=<name>

- A line is a trace event **only** if it starts with `v1|`. All other lines
  are ignored by the parser. The audit requires every non-empty output line of
  a Lab program to be a trace event, so Lab programs print nothing else.
- Fields are pipe-separated. Each field after the event name is `key=value`.
- Field values are data only, restricted to `[A-Za-z0-9_.:,+*-]` so parsing is
  a split and never an eval. Lists are comma-separated (`vals=5,3,8`), grid
  coordinates are `r-c` pairs (`walls=0-1,1-2`; `walls=all` starts a grid
  as solid wall). Free text is not part of v1.
- `step` ties the event to the source: `step=<name>` matches `// @step <name>`
  comments in the program, and the player highlights those lines while the
  event is current. Names are `[a-z0-9_]+`.
- `done` is the final event and ends playback.

Bounds (enforced by the parser): 512 bytes per line, 32 fields per event,
256 bytes per value, 20 000 events per run, 1 MiB of trace text. Excess
events are dropped and the parse reports `truncated`.

## Events

`init` is the first event and carries the view payload; the other events are
applied in order. Unknown events are preserved but ignored by renderers.

| Event | Fields | Meaning |
|---|---|---|
| `init` | view-specific: `vals`, `n`, `rows`, `cols`, `labels`, `rowlabels`, `edges`, `walls`, `max` | set up the view |
| `clear` | none | wipe the mutable view data (matrix cells/roles) for a second phase |
| `edge` | `a`,`b`, optional `w`, optional `role` | add a graph edge, or recolour/reweight an existing `a`→`b` edge (`tree`/`relax`/`reject`/`cycle`) |
| `compare` | `i`,`j` (indices) or `a`,`b` (values) | two items under comparison |
| `swap` | `i`,`j` | swap two positions |
| `set` | `i`,`v`, `r`,`c`,`v`, or `id`,`v` | write a value (graph `id` updates a node label) |
| `mark` | `i`,`role` or `r`,`c`,`role` or `id`,`role` | tag a position with a role |
| `visit` | `i`, `r`+`c`, or `id` | item/cell/node visited |
| `frontier` | `r`,`c` | cell added to the search frontier |
| `path` | `r`,`c` | cell on the final path |
| `enqueue` / `dequeue` | `v` | queue operations |
| `push` / `pop` | `v` | stack operations |
| `call` / `ret` | `fn`,`n` / `fn`,`v` | call-stack frame entered / left |
| `node` | `id`,`parent`,`v`, optional `label` | tree node (label overrides the numeric `v`; re-emitting an id relabels it) |
| `edge` | `a`,`b`, optional `w` | graph edge |
| `point` | `v` | timeline sample |
| `done` | optional `result` | end of trace |

Roles are a fixed vocabulary so renderers can style them: `lo`, `mid`, `hi`,
`cursor`, `found`, `target`, `sorted`, `pivot`, `min`, `minpos`, `key`,
`head`, `tail`, `current`, `wall`, `frontier`, `visited`, `composite`,
`prime`, `move`, `peak`.

## Drawing primitives

Each catalog entry names one primitive in `"view".type`; the renderer maps
events to drawing:

- `bars` — value bars; compare/swap/set/mark/sorted.
- `cells` — sorted cells with pointers (`lo`/`mid`/`hi`/`cursor`/`found`;
  any other `mark` role becomes a pointer label too), linked-list cursor
  mode (`linked=1`), and queue mode (`queue=1`).
- `grid` — rows x cols cells; walls, visit/frontier/path, labels; roles
  `wall` and `open` support maze carving on a `walls=all` start.
- `graph` — nodes and edges, laid out from the edge list; edges may carry
  weights (`a-b-w`) and roles (`tree`, `relax`, `reject`, `cycle`); node
  labels update with `set id v`; cursor/visit/pulse.
- `tree` — nodes with `parent`, laid out by depth; move leaves.
- `matrix` — growable table; row/column writes and highlights. `labels`
  names the columns, `rowlabels` names the rows; `mark` roles `path` and
  `found` paint green, `current` paints amber (used by the dynamic
  programming programs and the GCD table).
- `stack` — frames for `push`/`pop` and `call`/`ret` (the call stack).
- `timeline` — sequence of `point` values with a cursor.

## `// @step` annotations

Trace-emitting lines carry a trailing comment:

    io.println("v1|swap|i=" + i.to_str() + "|j=" + j.to_str() + "|step=swap"); // @step swap

Rules (checked by `tools/lab-audit.js`):

1. Every `step=` name in the program's trace has at least one annotation.
2. Every annotation name is used by the trace (no dead annotations).
3. Annotation names are unique per line but may repeat across lines.

Algorithms without annotations still visualize; only the code follow-along is
disabled.

## Counters and compare mode

The player derives per-pane counters from the event stream itself (steps,
compares, swaps) with prefix sums, so no counters are trusted from the
program. In compare mode both panes share one clock at the same
steps-per-second: synchronization is by rate, not index, so the faster
algorithm visibly finishes first.
