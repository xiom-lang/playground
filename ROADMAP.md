# XIOM Playground -- Roadmap

Status as of 2026-10-04. The audit (`AUDIT.md`) is fully implemented for this
repository; only cross-repo compiler/stdlib findings remain (C1-C25). The
roadmap covers the product work agreed for the playground. **2.0.0 Algorithm
Lab is complete** (see AUDIT 34).

Legend: `[ ]` todo, `[~]` in progress, `[x]` done.

## Release phase plan (2026-10-02)

The playground versions independently of the toolchain pin (see "Product
versioning"). This is the ordered plan with every open item folded in;
the sections below hold the detailed specs.

### 1.0.x -- maintenance (now)

- Patches for fixes and docs; production hygiene.
- Compiler follow-ups: C23 (-O2 miscompile) and C24 (stdin) shipped in
  **v0.62.3** and are verified from this lane against the official
  assets; the pin bump waits on the dl mirror sync (see "v0.62.3
  tracking" and `tools/compiler-repros/`).

### 1.1.0 -- input + toolchain refresh (COMPLETE 2026-10-03)

- [x] Absorb v0.62.3: `c23/run.sh` prints `C23 present: no`,
  `c24/run.sh` prints `C24 fixed: yes`; `packages.stageForRun` deleted;
  package tests and the full gate re-run (AUDIT 33.6).
- [x] Wire stdin end-to-end: `/api/compile` takes a bounded `stdin`
  string (64 KB), the run panel has an Input box (localStorage, prefilled
  from lesson `sample_input`), and the audit/generator pass
  `sample_input` (AUDIT 33.7).
- [x] First input lesson: L1-51 "Bonus: Programs That Talk Back"
  (`io.read_line`/`io.read_int`), sample input "Ada\n36\n", tool-generated
  expected output; catalog at 412 lessons.
- [x] Acceptance: L1 audits 51/51 with the sample input; suite 47/0/1
  (Windows) and 55/0 (WSL, execution).
- [ ] Follow-up: compiler finding **C25** (cache-hit runs close stdin;
  `--no-cache` inert). The playground runs input programs with a fresh
  empty HOME until it ships; delete that workaround then
  (`tools/compiler-repros/c25/run.sh` must print `C25 fixed: yes`).

### 2.0.0 -- Algorithm Lab (COMPLETE 2026-10-04)

- [x] Split player: code + visualization, executing-line highlight via
  `// @step` annotations; play/pause/step/speed; reduced-motion (no
  autoplay, transitions off).
- [x] Trace protocol v1 (`docs/LAB_PROTOCOL.md`) and all eight drawing
  primitives (bars, cells+pointers, grid, graph, tree, matrix, call stack,
  timeline) in `js/lab-viz.js`.
- [x] Tier 1 algorithms: 16 real runnable programs under
  `lessons/lab/programs/` (bubble/insertion/selection, linear/binary
  search, BFS/DFS/flood fill, stack/queue/linked list, sieve/GCD/Collatz,
  factorial/Hanoi), catalog generated from the manifest.
- [x] Compare mode: two panes, one shared clock by steps-per-second
  (sync by rate, not index), per-pane counters, desktop side by side /
  mobile stacked.
- [x] Acceptance (AUDIT 34): every Lab algorithm animates from its real
  program's trace (16/16 audit-clean, deterministic across runs), the
  highlight follows the steps (headless Edge: step 6 `swap` -> source
  line 35), compare races honestly (11 vs 12 steps on one clock),
  both themes, mobile stacking, keyboard stepping and reduced motion
  verified in the browser.
- App version bumped to **2.0.0**; catalogs regenerated (`lessons/index.json`,
  `lessons/lab/index.json`).

### 2.0.1 -- Lab polish (COMPLETE 2026-10-04)

- [x] Gentler default pace after owner feedback: 4 steps/s (was 8),
  slider 1-32.
- [x] Animated canvas transitions (swap travelers, set tweening, pointer
  glides, grid fade-ins + path polyline, queue enter/exit, stack
  enter/exit, tree scale-in, mark pulses, timeline growth) on the shared
  playback clock, fully disabled under reduced motion.
- [x] Browser-verified mid-flight (AUDIT 34.5); suite 63/0/1.

### 2.0.2 -- Lab on mobile (COMPLETE 2026-10-04)

- [x] Executing-line highlight on narrow screens: textarea overlay strips
  (Monaco is not loaded on phones), scroll-synced with reveal-on-step.
- [x] Phone editing verified end to end: edit the program, press Run, the
  visualization rebuilds from the edited trace; lessons stdin Input and
  output panel re-checked at 390x844 (AUDIT 34.6).

### 2.0.3 -- Lessons that listen (COMPLETE 2026-10-04)

- [x] Input lessons auto-open the Input box with their sample loaded and
  close it again for lessons that do not read input; the Input tab pulses
  once (reduced-motion safe).
- [x] L7-10 "Number Guessing Game" is genuinely interactive: reads guesses
  with `io.read_int()`, hints Too low!/Too high!, tracks attempts and
  score; the sample input walks a full winning game (expected output
  regenerated tool-driven).
- [x] Your own input no longer reads as "output differs": the
  expected-result check compares against the shipped sample only, and
  editing the box clears a stale banner (AUDIT 36).

### 2.1.0 -- Lab expansion (COMPLETE 2026-10-04)

- [x] Wave A: merge sort, quick sort, heap sort (real trace programs,
  audit-clean, browser-verified; AUDIT 34.7).
- [x] Wave B: counting sort, radix sort; DP (knapsack, LCS, edit distance,
  coin change) on the matrix primitive, extended with row labels,
  `path`/`found` marks and a `clear` event for two-phase views (AUDIT
  34.8).
- [x] Wave C: Dijkstra, A*, maze generation; topological sort, cycle
  detection, Kruskal (union-find) on the graph primitive, extended with
  weighted edges, edge roles (`tree`/`relax`/`reject`/`cycle`), node
  value updates and grid `wall`/`open` carving (AUDIT 34.9).
- [x] Wave D: BST, min-heap and trie (tree labels, in-place relabels),
  KMP, activity selection and Huffman, plus a proper in-order tree layout
  (AUDIT 34.10).
- **37 Lab programs / 10 categories**, every frame from the program's own
  trace; full lab audit 37/37 on v0.62.4; app version 2.1.0.

### 2.1.1 -- UI contrast pass (COMPLETE 2026-10-04)

- [x] WCAG audit of both themes: muted text was 2.9:1 (AA fail) and
  visualization fills were ~1.1:1 (graphics fail). Fixed with new muted
  values, a brighter dark accent, outlined bars/cells/frames
  (`--viz-stroke`, >=3:1) and a distinct wall fill (`--viz-wall`,
  >=3:1 vs empty cells). Lesson cards got larger mobile tap targets and
  slightly larger small text (AUDIT 37).

### 2.1.2 -- Comparable inputs for Compare mode (COMPLETE 2026-10-04)

- [x] All seven sorts share the same ten values (`6,3,9,1,8,2,7,4,10,5`)
  so races are fair; counting's table grew to 0..10.
- [x] Start/goal markers: BFS/DFS/flood fill mark start and (where they
  have one) goal cells; Dijkstra/A* mark start and target nodes (AUDIT 38).

### 2.1.3 -- Conversation view for input lessons (COMPLETE 2026-10-04)

- [x] Input lessons show the program output and the learner's answers
  interleaved as a chat with an answer box; each answer re-runs the
  program with it. Raw Input tab stays for advanced use (AUDIT 39).

### 2.1.4 -- Input fixes (COMPLETE 2026-10-05)

- [x] Conversation runs are serialized (fast multiple answers can no
  longer lose or mis-key inputs); the answer box disables while running.
- [x] The Input tab no longer hides the output panels; it mirrors the
  conversation answers, and the conversation hides while it is open
  (AUDIT 41).

### 2.1.5 -- Terminal run panel (COMPLETE 2026-10-05)

- [x] The Input tab is removed; for lessons that read input the Output
  tab is renamed **Terminal** with one shared scrollback (program lines +
  `>` answers), a persistent prompt hinting the program's last line, and
  a "running..." indicator (AUDIT 42).
- [ ] Follow-up (queued for 2.2.0): a streaming runner for true live
  stdin/stdout (program pauses at a read), sandboxed with per-IP slots
  and idle/wall timeouts.

### 2.1.6 -- Live terminal runner (COMPLETE 2026-10-05)

- [x] Streaming sessions: `/api/live/start|input|output|close` run the
  sandboxed program with piped stdin/stdout, long-poll output, 2
  sessions/IP, 90s wall / 30s idle limits, bounded buffers, fail-closed
  under `XIOM_SANDBOX=require`; `/api/health` reports live sessions.
- [x] The Terminal uses the live session for input lessons and streams
  output as it appears; answers go straight to the running process;
  when live start fails it falls back to replay transparently
  (AUDIT 43).
- [x] 2.1.7: production sandbox wrapper consumes stdin up front, so live
  sessions are capability-gated to unwrapped runs (`/api/version`
  `capabilities.live`, `/api/live/start` 503 under the wrapper); the
  Terminal replays in production until the wrapper streams stdin
  (AUDIT 44).
- [x] Wrapper fix delivered and live enabled (2.1.10): `--keep-stdin`
  pass-through landed (`ca5d98c`, AUDIT 46 request), is probed at server
  start, spawns live sessions through the sandbox, keeps the 503 gate only
  for wrappers without the capability, and flips `capabilities.live` in
  production; one-shot compiles are byte-identical (AUDIT 48).

### 2.1.8 -- Terminal follows the typed source (COMPLETE 2026-10-05)

- [x] `compile()` detects stdin reads in the actual editor source, so
  programs the learner writes get the Terminal too (Output tab renamed,
  terminal visible), and the dialogue resets when the source changes
  (AUDIT 45).

### 2.1.10 -- Live terminal enabled (COMPLETE 2026-10-05)

- [x] The `--keep-stdin` wrapper fix (ops, `ca5d98c`) is probed at server
  start (`--keep-stdin --probe`, stored as `sandbox.keepStdin`); live
  sessions spawn through it, `/api/live/start` stays 503 only for wrappers
  without the capability, `/api/health` reports `sandbox.keepStdin`, and
  `capabilities.live` flips to true in production (AUDIT 48). One-shot
  compiles are byte-identical.
- [x] WSL suite 76/0 (live test under `XIOM_SANDBOX=require`), negative
  gate verified with an old-wrapper simulator (503 + `"live":false`).

### 2.1.11 -- Live terminal: real streaming + terminal look (COMPLETE 2026-10-05)

- [x] Root cause of the "live" EOF transcript: compiled programs
  block-buffer stdout on pipes, so prompts never streamed while the
  program waited; the idle sweep then closed the driver and the program
  flushed on EOF. The 2.1.10 live test was vacuous and hid it (AUDIT 49).
- [x] Fix: live sessions spawn through `stdbuf -o0` (zero deps) inside the
  sandbox; the gate requires keep-stdin **and** stdbuf on Linux;
  `capabilities.live` and `/api/health` (`live.runner`) reflect it. The
  test asserts the prompt arrives before exit and both answers land.
- [x] Terminal UI per owner request: one terminal surface, `>` prompt
  line, transparent borderless input with no placeholder; verified in
  headless Edge (dark + light) on a real live session.

### 2.2.0 -- Gamified learning

- Visible completion (level rings/percentages on the landing), light
  "lesson complete" transitions.
- Achievements/XP derived from progress (local-first, synced through the
  existing progress documents), validation surfacing with a delayed
  reference-solution reveal, graduation certificate (client-side).
- Guardrails: works signed out, no streak/timer pressure, accessible.

### 2.3.0 -- Lab advanced

- Tier 3 algorithms: Bellman-Ford, Floyd-Warshall, Tarjan SCC, max
  flow, bipartite matching; segment tree, Fenwick, LRU/hash collisions;
  convex hull, closest pair; Rabin-Karp, LIS O(n log n), matrix chain,
  regex NFA.
- Compare presets across all tiers.

### 3.0 -- future (unscoped)

- Ideas beyond the above (community challenges, shareable profiles,
  any new owner direction). Not planned yet.

## Graphics needed (for the designer, 2026-10-02)

Two sets, phase-tagged. Preferences: SVG first (scalable, themeable);
PNG only where noted. Flat geometric style matching the XIOM wordmark,
indigo accent (#5C6BFF) on transparent, no embedded text, readable on
both light and dark themes, consistent stroke weight across a set.

**2.0 -- Algorithm Lab (12 assets)**

1-8. Category icons, 24x24 SVG, single color (`currentColor`): sorting
     (bars), searching (lens over cells), pathfinding (grid + path),
     graph (nodes/edges), tree (binary tree), dynamic programming
     (matrix fill), strings (pattern over text), call stack (frames).
9.   Lab hero/empty-state illustration, 800x500, transparent: an
     abstract "algorithm running" scene (bars and paths in motion).
10.  Compare-mode illustration, 800x500: two panels racing.
11.  Landing feature-card illustration for the Lab, 640x400.
12.  Social/OG image for the 2.0 launch, 1200x630 PNG, with clear space
     for a title.

**2.2 -- Gamification (23 assets)**

13-24. Achievement badges, 12 x 512x512 PNG + SVG source: first program
       run, first lesson, level 0 complete, first loop, contract
       violation caught, 10 lessons, 50 lessons, all lessons,
       first Lab visualization, first compare, package used, sandbox
       explorer (final list can be tuned when the phase starts).
25-33. Level emblems, 9 x 512x512 (one per lesson level, L0-L8),
       matching the level themes.
34.  Graduation certificate design, A4 landscape, print-ready
     (SVG or PDF).
35.  Certificate seal/emblem.

## Phase A -- Learning experience (this repository)

Goal: make the playground teach effectively despite a 516-module stdlib, and
make editor support match what developers expect.

- [x] A1. Stdlib tiers in the reference panel
  - Generator emits `tier` (`playground` / `docs` / `local`) and `docs` URL
    per module; panel shows the playground tier by default (17 top-level
    modules), search across all, "Browse all 516 modules" toggle.
  - Each module row deep-links to `docs.xiom-lang.org/stdlib/<module>.html`;
    a "Download the compiler" CTA covers the `local` tier.
  - Copy-to-editor button on each entry (inserts the call and preselects the
    first argument).
- [x] A2. Known-limitation badges
  - `tools/generate-limitations.js` derives `js/limitations.json` from
    `tools/lesson-baseline.json`; the lesson list shows a "compiler" badge and
    blocked lessons disable Run with an inline explanation.
- [x] A3. Expected output per lesson
  - `tools/generate-expected-outputs.js` executes each solution twice on Linux
    and stores the output in `expected_output`; 351 of the 379 runnable
    lessons are deterministic. The 28 that print varying values (compiler
    finding C18) are recorded in `tools/expected-output-skips.json` and carry
    no field, so CI cannot flake.
  - The Output tab shows "Output matches the expected result" - or the
    expected text on mismatch - when the editor still holds the reference
    solution. `tools/lesson-audit.js` asserts stored outputs in the nightly
    CI job and `--check` gates the data on every push.
- [x] A4. Mobile lesson experience
  - Narrow screens (<=768px) never download Monaco; the editor slot is a
    plain-text editor (16px to avoid iOS focus zoom) with Run and Copy
    buttons, and Run, Format, quick examples, and the expected-output
    comparison all use that source. Resizing across the breakpoint lazily
    loads Monaco (or the mobile editor) without losing the program text.
- [x] A5. Editor autocomplete (data-driven)
  - Monaco completion provider built from `js/stdlib-ref.json`: module names
    after `use xiom.`, module members after an imported alias (`io.`, `math.`),
    method names after `.`, keywords/types, and parameter snippets.
- [x] A6. Visual polish
  - Tier badges, limitation badges, copy buttons, docs links, and panel
    spacing were already in place. This pass added the missing landing
    hierarchy ("Why learn with XIOM?" section), empty states for lesson and
    stdlib searches, indigo `:focus-visible` rings for interactive elements,
    theme-token hover colors, and the stdlib panel cleanup (one search box,
    working dotted queries such as `io.println`).

## Phase B -- Progress and history (this repository, no backend)

Goal: make progress durable and reviewable without requiring an account.

- [x] B1. Local history store
  - `js/history.js` keeps `xiom_history_v1` in localStorage: newest-first run
    records `{ t, ok, timeout, ms, out }` per lesson, capped at 20 per lesson
    and 400 runs total, pruned oldest-first. Runs are recorded from the real
    compile path, and the last opened lesson is remembered for resume.
- [x] B2. History UI
  - Per-lesson "Recent runs" block in the narrative (pass/fail, relative
    time, duration, output preview, per-lesson Clear). The landing continue
    card resumes the lesson used last and shows the last session time, and
    every level header carries a completion ring backed by the same data.
- [x] B3. Export / import
  - Landing progress actions export `xiom-progress-YYYY-MM-DD.json` and
    import it back with a union merge (completed lessons plus history merged
    by timestamp), shape validation, and a status notice.
- [x] B4. Sync adapter contract (no server yet)
  - `syncProgress()` is a local no-op returning `{ ok, synced, reason }`; the
    registry progress API contract (endpoints, payload, revision conflicts,
    merge policy, privacy) is documented in `docs/PROGRESS_SYNC.md`.

## Phase C -- Ecosystem integration (unblocked 2026-09-19)

Goal: connect the playground to a visual registry without weakening the
sandbox.

Auth decision (registry session, 2026-09-19): the registry is not an identity
provider. It has no accounts and no browser sessions at beta; publishing
authority stays with CLI/CI tokens. The playground owns its own GitHub OAuth
app (C2) if accounts are wanted, and cross-device sync is a playground-backend
concern or waits for a future accounts service.

- [x] C1. Registry search panel (read-only)
  - `js/registry.js` adds a Packages panel under Reference: browse from
    `GET /index.json` (cached for the server's 60s max-age), debounced search
    via `GET /search?q=`, inline version metadata (published date, size,
    SHA-256 with copy, dependencies, yanked flag) via `GET /packages/:name`,
    and links to `/packages/<name>` and repositories. Loading, empty, and
    unreachable states; all registry strings render via textContent. No
    package code is downloaded or executed in the sandbox.
- [x] C2. Playground accounts (GitHub OAuth)
  - Implemented (Option B: host-side auth helper; the container keeps zero
    egress and never holds the client secret). Signed HttpOnly sessions,
    per-account progress documents on the `playground-data` volume with
    revision-checked merges, account chip + sign-in/sync UI, and
    mocked-helper tests. Verified on the VPS by the owner: sign-in, sign-out,
    re-sign-in, and cross-device progress sync. The registry never vouches
    for users or carries a session; cross-property SSO is a post-beta
    decision (shared cookie on the common domain or a dedicated accounts
    service).
- [x] C3. Package examples that run (delivered 2026-09-29; see "C3 status")
  - "Open in playground" only for examples whose code is stdlib-only and
    sandbox-compatible; unblocks when the first real `xiom.*` packages are
    published (compiler/stdlib release integration). Registry checked
    2026-09-24 and again 2026-09-26: only `xiom.staging-e2e-probe` is
    published, so C3 stays open. Relay sent to the registry 2026-09-26
    asking for the first real package(s)/timing, the index contract, the
    no-egress consumption path (vendored toolchain archive, ops-mounted
    read-only cache, or a documented offline layout), and production vs
    staging (SESSION section 11.2).
- [x] C4. Shared design system
  - The playground already matches the registry/website tokens (indigo
    `#5C6BFF` on `#08090B`, panel/line/paper palette, Inter/system stack, no
    webfonts). Future: extract one canonical token file all three properties
    import or copy (registry proposal).

## Phase D -- Security hardening (owner-requested 2026-09-25)

Goal: submitted programs must not be able to reach server secrets, other
users' data, or the network, without weakening the host boundary. Plan:
`docs/SECURITY_HARDENING.md`; ops relay: `docs/OPS_SECURITY_REQUEST.md`;
checklist: `docs/checklists/security-hardening.md`.

- [x] D1. Immediate containment: compiler-child environment whitelist,
  canary test, and the audit record (AUDIT section 28, commit `162e041`).
- [x] D2. Per-execution filesystem sandbox: Landlock wrapper around every
  compiler child (allow `/tmp` read-write, `/app` and `/toolchain`
  read-only; deny `/data`, `/proc`, `/sys`, TCP), fail closed when
  unavailable, denial tests plus the full Linux lesson audit. Verified
  live on the VPS (deploy `f5fccef`, ops report: `require`, ABI 4, all
  probes ok, escape program denied); rollback is `XIOM_SANDBOX=off`.
- [x] D3. Data-plane containment: sessions and the progress store moved
  host-side so the web container holds no long-lived secrets and no
  multi-tenant data. Cutover executed and verified 2026-09-26 (helper mode
  live, `SESSION_SECRET` removed, forged cookie 401, host-side writes
  confirmed); the compose cleanup (C7) dropped the `/data` mount and
  `PLAYGROUND_DATA_DIR` (AUDIT section 31).
- [x] D4. Abuse controls: per-IP token buckets on the five compiler
  endpoints (429 + `Retry-After`) and queue/rejection counters on
  `/api/health` (AUDIT section 30). The owner wired the external keyword
  monitor on `"abuse":"ok"` (2026-09-26, reports healthy).
- [x] D5. Owner/ops: rotate `SESSION_SECRET`/`AUTH_HELPER_KEY`, verify the
  container egress guard from inside, and confirm the kernel Landlock ABI
  (all three done 2026-09-25).

## Phase E -- Lesson content QA (owner-requested 2026-09-26)

Goal: every code example in lesson prose compiles against the pinned
toolchain, and beginner lessons teach the real language (text-only
`io.println`, the semicolon habit and its tail-expression exception).
Tool: `tools/audit-snippets.js` (`--level Lx --imports`), recorded in
AUDIT section 32.

- [x] E1. Prose snippet sweep complete (2026-09-28, AUDIT 32.4). All
  levels swept with the committed pipeline against v0.62.1; full-corpus
  audit: 199 ok + 73 missing-import + 144 excerpt + 5 failing, and the
  five failures (L1-19 `let mut`; L2-05/07/08/09 missing `.to_str()`)
  were then fixed and re-verified. L8's template fence compiles (B4 note
  added). The v0.62.1 stdlib renames that made older prose fail
  (`int_to_str`/`float_to_str`/`bool_to_str`/`str_length`,
  `math.random_int`, `Set.remove` returning unit) are migrated
  mechanically; finder classes (module-local types/functions defined in
  another fence) stay excerpt-class by design. Direct `for x in Vec`
  works on v0.62.1, and the v0.61.3-era `range`+index workaround has been
  reverted in the 11 prose fences where it was safe (L0-11 x3, L0-24,
  L0-34 x2, L0-49, L0-50, L1-37, L1-38, L5-13); the three remaining
  indexed loops are a numeric `range` loop and the two vecs used after
  their loop (L0-24 fence 2, L5-04, L5-16).
  Run verification: all 40 runnable loop fences executed (39 rc=0; the
  one failure, L5-29's `for friend in &friends`, exposed finding C21) and
  every output was checked for zero-iteration prints. The 10 prose fences
  that iterated over references were rewritten to while+index /
  while+get, matching each lesson's own solution; all re-verified by
  executing with small drivers.
- [x] E2. Semicolon teaching: L0-01 states the habit and the exception,
  L0-02 keeps `;` on every statement, L6-16 explains the value-tail form;
  the prose audit found no lesson solution or template missing a
  separator.

## Backlog -- implemented 2026-09-28 (B1-B5)

Direction agreed: the sandbox stays the security boundary and the stdlib
is NOT filtered (source filtering is bypassable via user-declared
`extern "C"` and would fight the learning mission). Instead, make the
sandbox legible:

- [x] B1. Capability tiers: `tools/generate-stdlib-ref.js` emits
  `capability` (`full`/`limited`/`blocked`, with a note) per module and,
  when it differs, per function; the reference panel renders badges plus
  a one-line sandbox note. Regenerated `js/stdlib-ref.json`: 29 blocked
  modules (all `net.*`), 2 limited modules (`io.fs`, `env`), 57 limited
  functions (io file APIs, process/env/os paths).
- [x] B2. Friendly sandbox denials: `lib/denials.js` maps EACCES/EPERM
  signatures (connect, read/write, /proc and /data) to plain language;
  wired into the crash and failure output paths; unit-tested in
  `tools/test-server.js`.
- [x] B3. `docs/SANDBOX_CAPABILITIES.md`: network blocked, `/tmp` only
  and ephemeral, contained processes, env whitelist, resource limits,
  host-side accounts/progress, and where each rule comes from; linked
  from the reference panel.
- [x] B4. "Playground vs a real compiler" note in L8-20, driven by B1's
  tiers (L8-10's template fence also compiles now).
- [x] B5. Phase E prose sweep L2-L8 completed (see E1 and AUDIT 32.4).

Ops etiquette for these: they are playground-only changes -- no ops
requests, no container/VPS changes. Batch any ops ask (the rollback-window
close and the pre-P2 backup removal were both handled by ops; the C3
bundle mount is the one remaining batched ask) instead of sending
per-item requests.

## Cross-repo (compiler / stdlib / ops, tracked in AUDIT.md)

- C1 fixed in v0.61.1 (`--version` reports v0.61.1).
- C2 fixed in v0.61.1 (`xiom fmt` works; verified through `/api/format`, and
  `/api/version` reports `capabilities.format: true`).
- C3 fixed in v0.61.1 (`--opt-level` is accepted by the script-run path and
  the cache is level-aware).
- C5/C17 fixed: on the v0.61.1 release all 410 lessons type-check, run and
  match their expected outputs, so `js/limitations.json` regenerates empty.
- C6 fixed: the release `lib/package.xi` is the `xiom-std` manifest.
- C8 Still open: the v0.61.3 SHA256SUMS lists `xiom-wasm-0.61.3.wasm`, but
  the asset 404s on GitHub and on the mirror; the in-browser compiler is
  still the manual v0.58.0 copy. The compiler lane is working toward a new
  release that includes the wasm asset (owner relay 2026-09-26, pending).
- `net.tcp_connect` signedness (AUDIT 29.4, SESSION 11.1): root cause
  confirmed (the builtin's -1 surfaces as 4294967295 through the current
  `-> Int` declaration, so the wrapper's negative check never fires). The
  compiler-side fix landed (m146); the stdlib `Int32` externs are merged
  and pushed (`c193bc4`, stdlib tip `1fbb45a`). The stdlib change alone is
  behavior-neutral on the pin; the check flips to `Err` only in the first
  release pairing m146 with stdlib >= `c193bc4`. Absorption step 6
  re-verifies `tcp_connect` against that pin (or against stdlib
  `origin/main` at/after `c193bc4` when the pin bumps before a stdlib
  release).
- C18/C19 fixed: every lesson produces deterministic output. R64 (all-modules
  stdlib test / AI-context pack) and R65 (target-accurate `xiom.env`
  constants) shipped in v0.61.3 and do not affect the lesson set.
- C21 (new, 2026-09-28, found by the loop-fence run): `for x in &vec`
  and `for x in <param: &Vec[T]>` pass the type checker but fail codegen
  ("codegen: unsupported: `for` over '%struct.Vec*' (element type could
  not be resolved)"), so `--check` and the snippet audit cannot see it.
  By-value `for x in vec` and while/range+index run correctly. The 10
  affected prose fences now use while+index; solutions were unaffected.
- C20 (new, 2026-09-28, from the L3-L8 sweep): a struct type declared
  inside a `module` does not unify with its qualified name across module
  boundaries (`fn models.new_user(...) -> User` passed to a function in
  another module expecting `&models.User` errors "expected models.User,
  found User"; even `-> models.User` inside the declaring module
  mismatches `User`). Repro and affected lessons: AUDIT 32.4. Lessons use
  a top-level shared type for cross-module data until this is fixed.
- Compiler polish (relayed 2026-09-28, queued by the compiler lane): the
  Range-only `Iterator` warning and the W005 float-to-str stub; both are
  informational for the playground today.
- Ops: toolchain currency closed (2026-09-25/26) -- v0.61.3 assets are
  mirrored and checksum-verified, the deploy installs from the repo pin
  (option C), `latest.json` advertises v0.61.3, and the drift workflow is
  green at `relation=same`. It will fail loudly on the next release until
  it is absorbed via the SESSION 3.1 runbook plus one pin-bump commit.

## Acceptance for VPS testing

Phase A and B are shippable when: the browser smoke checks pass, autocomplete
and reference tiers work against the pinned toolchain, lesson history
survives reloads and can be exported/imported, and the known-limitation
badges match `tools/lesson-baseline.json` (CI enforces).

## v0.62.0 absorption status (2026-09-28)

- Verified and held: step 6 (`net.tcp_connect` refused port now returns Err), strict contracts and exact arity clean across 411 lessons, sweep 411/411, stdlib surface 6,932 functions, bench within noise (AUDIT 33).
- Blocker 1: v0.62.0 emits the host-LLVM `opt -passname` warning on every run (the toolchain bundles no LLVM; the container is LLVM 18 too).
- Blocker 2: the wasm ABI changed and the matching wasm-bindgen glue is not published (C8 stays open on the glue, not the asset).
- Pin stays v0.61.3 until a fixed release; both items are relayed to the compiler lane and recorded in SESSION 14.

## v0.62.1 absorbed (2026-09-28)

Pin v0.62.1 landed after v0.62.0 was held: the host-LLVM `opt` warning is
fixed, step 6 closes (`tcp_connect` refused port returns Err), and C8 is
absorbed (the release ships the wasm glue; `WASM_VERSION` v0.62.1; loader
updated; Node test passes, browser console check requested from the owner).
Sweep 411/411, stdlib surface 6,932 functions, baseline refreshed, audit
green. Direct `for x in Vec` works on the pin now, so the Phase E sweep can
simplify the `range`+index workarounds back to direct iteration.

## v0.62.3 tracking (2026-10-03)

The compiler lane confirmed the fixes shipped in **v0.62.3** (not
v0.62.2): C23 (-O2 miscompile) and C24 (stdin; m175 - Int FFI handles
to pointer params via `inttoptr`). The release is live on GitHub
(`xiom-0.62.3-linux-x64.tar.gz` sha256 `4cc5d62b...`, windows zip
`011af7dd...`, wasm assets verified), and the dl.xiom-lang.org mirror
has not synced yet, so the pin bump waits for it (CI fetches from dl).

Verified early against the official Linux asset (staged at
`/home/lefteris/xiom_v0623/tc`):

- `tools/compiler-repros/c23/run.sh` -> `C23 present: no` (all three
  solutions print 2 at -O2 and -O0);
- `tools/compiler-repros/c24/run.sh` -> `C24 fixed: yes` (`got: [Ada]`
  in run and compile mode).

Absorption executed 2026-10-03 (details in AUDIT 33.6):

- [x] `TOOLCHAIN_VERSION` and `WASM_VERSION` -> v0.62.3; the Windows
  toolchain fetched once the dl mirror synced; the root wasm bundle
  replaced and browser-verified ("XIOM v0.62.3 (WASM)").
- [x] `packages.stageForRun` and its `runProgram` call deleted (C22).
- [x] Generated data regenerated (`js/stdlib-ref.json`,
  `js/limitations.json`), five expected outputs refreshed and L2-51's
  enum patterns qualified (bare `Ok`/`Err` now bind to the prelude).
- [x] Full lesson audit on v0.62.3: no regressions; suite 44/0/1; prose
  snippet audit recorded with the absorption commit.
- [ ] Re-run the production E2E checks after the deploy (`xiom.bmp`,
  `xiom.loss`, the hello/csv example) and confirm `/api/version` reports
  toolchain v0.62.3.
- [x] **C25 fixed upstream** at `3bc59dbc` (warm cache inherits stdin,
  `--no-cache`/`--jit` read, `--jit` skips the cache; CLI lock +
  fixture green). It ships in the **next toolchain release**; at that pin
  bump delete the fresh-HOME workaround (`server.js` run path,
  `tools/lesson-audit.js`, `tools/generate-expected-outputs.js` native +
  WSL worker), confirm `tools/compiler-repros/c25/run.sh` prints
  `C25 fixed: yes`, and re-run the stdin suite test and the L1-51 audit
  (AUDIT 33.7).
- [x] **Absorbed in v0.62.4** (2026-10-04): pins and wasm bundle bumped,
  `c25/run.sh` prints `C25 fixed: yes`, the fresh-HOME workaround is
  deleted, warm-cache stdin verified end to end (AUDIT 35).
- [x] **Absorbed in v0.63.0** (2026-10-04): pins and wasm bumped; the run
  temp-root fix, warm-compile caches and valid SMT contracts are live on
  the pin (AUDIT 40).
- [x] **Absorbed in v0.63.1** (2026-10-05): pins and wasm bumped (JS and
  `.d.ts` unchanged); C25 stays fixed, WSL suite 75/0/1 (live test
  capability-gated), lab 37/37 x2 and full lesson audit 412/412 on the new
  pin (AUDIT 47).
- [x] **Absorbed in v0.64.0** (2026-10-05): major correctness release
  (generic receivers, receiver-less `read` gate, confined-unsafe hoist,
  installed-lib runtime resolution); pins and wasm bumped (JS/.d.ts
  unchanged), stdlib 0.63.1 with the surface unchanged apart from the
  `lz4_*_checked` rename; C25 fixed, WSL 76/0, lab 37/37 and lessons
  412/412 on the new pin (AUDIT 54).
- [x] **Absorbed in v0.64.1** (2026-10-08): correctness and tooling
  release (type aliases in vectors, nested payloads, function-pointer
  refs, Float32 enum payloads; CLI project build/deterministic mode);
  pins and wasm bumped (JS/.d.ts unchanged), stdlib surface unchanged;
  C25 fixed, WSL 76/0, lab 37/37 and lessons 412/412 on the new pin
  (AUDIT 57).
- [x] **Absorbed in v0.64.2** (2026-10-09): correctness release (vector
  element layout, alias/enum payloads, byte-vector references and
  nested-field writes, loop stack) plus `xiom run` exiting with the
  program's status; pins and wasm bumped, stdlib +4 additive functions;
  clean non-zero exits are no longer crash-labelled, which exposed and
  fixed four lesson bugs (L6-34 reference-based fn pointers, L8-17
  out-of-range index, L1-50 d7/off-by-one, L8-11 3d7); C25 fixed,
  WSL 77/0, lab 37/37 and lessons 412/412 (AUDIT 59).
## Algorithm visualization ("Algorithm Lab") - 2.0 phase, approved (owner, 2026-10-02)

Status: **delivered as 2.0.0 on 2026-10-04** (verification record: AUDIT 34;
protocol reference: `docs/LAB_PROTOCOL.md`). This section is the original
design and stays as reference; the 2.1.0 entry in the phase plan lists what
comes next.

Idea: a third mode next to Lessons and the free playground where
algorithms run as normal XIOM programs, but their execution is shown step
by step in the browser - bars swapping, grid cells filling, paths
drawing - paced so a human can follow. Target audience: the same
beginners the lessons serve; no CS background assumed.

**Feasible with the current architecture, no server changes.** The
sandbox already runs arbitrary programs and the playground captures
stdout, so the lesson program itself can emit a compact, deterministic
trace and the frontend replays it:

1. The algorithm is a normal, runnable XIOM program that prints one
   line per event (e.g. `v1|swap|i=0|j=1|step=swap`,
   `v1|visit|x=3|y=7|step=visit`); the `step` name ties the event to the
   annotated source line for the highlight. Nothing pre-baked: the
   animation is always derived from the real program's output, and users
   can edit and re-run the code they are watching.
2. The frontend parses the trace and replays it in a **split view** -
   code on one side, visualization on the other - with play/pause, step
   forward/back, reset and a speed slider, and the **executing line(s)
   highlighted** in step (step mode also satisfies reduced-motion and
   makes "why did it do that?" replayable). See "Player" below.
3. Each entry carries a small visualizer spec mapping event types to
   drawing (bars, grid, pointers, call stack). The lesson catalog,
   Monaco editor, run pipeline and expected-output checks are reused;
   the final trace line is deterministic, so auto-validation keeps
   working.

Staging:

- **v1 - Sorting Lab**: bubble/insertion/selection over 8-16 bars, trace
  protocol v1 (`init|compare|swap|set|done`), split view with the
  executing-line highlight, player controls, keyboard stepping,
  `prefers-reduced-motion`, both themes.
- **v2 - Compare mode first, then Pathfinding**: the two-pane compare
  player (below) with sorting presets, then a grid (BFS/DFS, then
  Dijkstra with weights), user-drawn walls, visit/backtrack/frontier
  events.
- **v3 - Structures + recursion**: stack/queue/linked list, parenthesis
  matching, binary search, recursion trees (factorial, Hanoi), with
  compare presets across all previous tiers.

### Player: split screen + executing-line highlight (v1 requirement)

The Lab player is a split view: the code (Monaco, editable) on one side,
the visualization on the other, responsive (mobile stacks them with the
code pane collapsible and sticky step controls). The line(s) that
produced the current step follow the trace.

The mapping is **annotation-driven, so no compiler support is needed**:
trace-emitting lines carry a `// @step <name>` comment, trace events
carry that name, and the client highlights the annotated line(s) with a
Monaco decoration as it replays. Lesson tooling validates that every step
name emitted by the expected trace has an annotation, so renames cannot
silently break the highlight; algorithms without annotations still
visualize, just without the code follow-along.

### Compare mode (first v2 increment)

Two players load presets from the catalog (e.g. bubble vs quick) and run
from **one shared clock at the same steps-per-second**, so the faster
algorithm visibly finishes first; per-pane counters (steps, compares,
swaps) and a combined result line make the difference concrete. Desktop:
side by side; mobile: stacked with a pane switcher. Each pane keeps its
own code (highlight included) and can be swapped to another preset via a
dropdown. Step counts differ by design, so synchronization is by rate,
not by index - that is the teaching point, not a bug to paper over.

Constraints and guardrails: zero-dependency ES5 frontend (DOM/canvas
only, no bundlers), ASCII docs, accessible controls (ARIA labels, no
color-only signals), stdout kept bounded (a few thousand trace lines,
summarize beyond) and parsed as data only - never interpolated into
HTML or eval'd. Keep complexity notation optional and one idea per view
so it stays beginner-friendly.

### What can be visualized

Everything here is pure computation (no stdin), so the Lab is unaffected
by the C24 blocker. The catalog, grouped by the tier we would ship it in
- every entry maps to one of a handful of reusable drawing primitives:
**bars**, **sorted cells + pointers**, **grid**, **graph (nodes/edges)**,
**tree**, **matrix/table**, **call stack**, **timeline/queue**.

Tier 1 - beginner (v1 candidates; one idea per view):

- Sorting: bubble, insertion, selection (bars; compare/swap events).
- Searching: linear scan, binary search (sorted bars with lo/mid/hi
  pointers).
- Grid traversal: BFS, DFS, flood fill (cells visited/frontier).
- Data structures: stack push/pop, queue enqueue/dequeue, linked-list
  traversal (boxes + arrows).
- Numbers: sieve of Eratosthenes (grid cancellation), Euclid's GCD (two
  values per step), Collatz trajectory (timeline).
- Recursion: factorial call stack, Towers of Hanoi (pegs).

Tier 2 - intermediate (v2):

- Sorting: merge (split/merge tree), quick (pivot partitions), heap
  (tree + backing array), counting/radix (buckets).
- Pathfinding on weighted grids: Dijkstra, A*; maze generation
  (randomized DFS/Prim).
- DP: Fibonacci memo vs tabulation, coin change, knapsack, LCS, edit
  distance (matrix fill order).
- Trees: BST insert/search/delete, heapify/extract, trie insert/lookup.
- Strings: naive and KMP matching, palindrome expansion.
- Graphs: topological sort, cycle detection, union-find (Kruskal/Prim),
  Dijkstra over an adjacency list.
- Greedy: activity selection (timeline), Huffman tree building.

Tier 3 - advanced (v3):

- Graphs: Bellman-Ford relaxation, Floyd-Warshall matrix, Tarjan SCC,
  max flow (augmenting paths), bipartite matching.
- Structures: segment tree, Fenwick tree, LRU cache + hash collisions,
  AVL/red-black rotations (only if they render legibly).
- Geometry: convex hull (gift wrapping / Graham scan), closest pair.
- Strings/DP: Rabin-Karp hashing, LIS O(n log n), matrix-chain order,
  regex NFA simulation.

Open questions: distinct top-level screen vs. a lesson type; pipe fields
vs. JSON for traces (pipe is cheaper to parse in ES5 and shorter in
stdout); whether the Lab shares progress/achievements with lessons.

## Input lessons (blocked on C24, 2026-10-02)

Teaching text input (`io.read_line()`, plus `io.read_int()`/`read_float()
Result variants) is wanted and safe, but the pinned toolchain's stdin
functions are broken (compiler finding C24, AUDIT 33.5): run mode prints
an empty line, compile mode aborts in glibc. Acceptance check:
`bash tools/compiler-repros/c24/run.sh` must print `C24 fixed: yes`.

Once fixed, the playground work is small and already designed:

1. `/api/compile` accepts a bounded `stdin` string (e.g. 64 KB) and passes
   it through `runXiom` (which already supports an `input` option).
2. The run panel gets a collapsible "Program input" box (sticky value,
   passed on Run).
3. Lessons gain an optional `sample_input` field; the audit and the
   expected-output generator pass it so input lessons stay deterministic
   and auto-validated.
4. An early lesson teaches `read_line`/`read_int`, followed by practice
   exercises.

## Product versioning (2026-10-02)

The playground app now versions independently of the toolchain pin:
`package.json` started a 1.0.0 line (shown in the footer, reported by
`/api/version` as `server`). 1.x takes patches for fixes and minor
releases for features. Toolchain/stdlib/wasm stay separately pinned
components.

**The 2.0.0 release is the Algorithm Lab** - the visualization feature
(split player, line highlight, Tier 1 algorithms, compare mode; see
"Algorithm Lab"). Gamified learning follows in **2.2.0** ("UX /
gamification ideas"), and the Lab expands in 2.1.0/2.3.0. The full
ordered plan is the "Release phase plan" above; partial landings bump the
minor, the feature-complete Lab lands as 2.0.0.

## UX / gamification ideas (2.2.0 phase, owner 2026-09-30)

Shipped in this round: a "What's new" dialog (curated `js/help.js`,
entry points in the header Help menu and the landing footer) and a
"Progress & sync" help dialog that explains local progress, JSON
export/import and the optional GitHub sync (what is stored where, and how
to delete it).

Owner's ideas for later, with a suggested order (keep everything usable
signed out, syncable through the existing progress documents, and free of
punishing/streak-pressure patterns):

1. Make completion visible: per-lesson checkmarks already exist; add
   level completion rings/percentages on the landing and a subtle
   "lesson complete" transition. Low risk, immediate delight.
2. Achievements / XP: local-first achievements derived from progress
   (first run, first loop, 10 lessons, a level cleared, contracts first
   violation caught...). XP is derived, never authoritative; sync via the
   progress document. Requires a small achievement engine + icons.
3. Auto-validation surfacing: expected-output matching already runs; show
   it as a first-class "Validated" state with a reveal for the reference
   solution after N attempts (avoid spoilers by default).
4. Graduation certificate: client-side generated (canvas/PNG or print
   CSS) from verified completions; a shareable artifact, no server data.
   Do this last, once 1-3 are stable.

Open questions to settle before building: whether achievements sync as
part of progress or stay device-local; how much motion/celebration is
acceptable on the landing; certificate design/branding with the website.

## C3 status (2026-09-29: delivered)

The registry exported the bundle and it was independently verified from
the playground side (transfer tarball sha256, `index.json` digest, all 342
artifacts re-hashed; SESSION 18.1). Playground implementation shipped:
vendored `packages/xiom-hello|xiom-csv` from the verified artifacts,
`lib/packages.js` (import parsing, sha-verified bundle extraction with a
cache, stdlib-shadowing guard, work-dir copies), server wiring for the
check stage plus the `stageForRun` bridge for the execute stage,
`examples/packages/main.xi`, and sandboxed tests (check cross-platform,
run where execution is enabled). Two follow-ups: the one batched ops mount
request (SESSION 18.2: extract `/opt/xiom/registry-bundle`, read-only bind
mount `/registry-bundle`, `XIOM_PACKAGE_BUNDLE=/registry-bundle`) and the
compiler run-path fix C22 (SESSION 18.3), which retires the bridge.

## C3 background (2026-09-28)

Registry answered the four questions: ~330 real signed `xiom.*` packages
are live on production, the index contract is stable/public, and the
no-egress path is queued as the registry's `scripts/export-bundle.js`
(vendored index + tarballs + bundle.json + OFFLINE.md, exported from
production, pinned by sha256). Playground plan: receive the bundle, one
batched ops ask to mount it read-only, install the vendored packages into
`XIOM_HOME/packages/` (or vendor under `<repo>/packages/xiom-<pkg>/` via
`xiom pkg`'s local fallback), then wire a package example (`xiom.hello`,
`xiom.csv`) with an offline test and close C3. The P2 rollback window was
closed by ops the same day (AUDIT 31.1), and ops deleted the retained
pre-P2 backup on owner sign-off (2026-09-28, AUDIT 31.1).

Status 2026-09-28 (end of day): the bundle has not been delivered yet;
C3 stays waiting on the registry's `scripts/export-bundle.js` output.
The ops mount request is batched and will be sent with the bundle's
sha256, so no separate message has gone out.