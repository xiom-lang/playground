# XIOM Playground -- Roadmap

Status as of 2026-09-18. The audit (`AUDIT.md`) is fully implemented for this
repository; only cross-repo compiler/stdlib findings remain (C1-C17). This
roadmap covers the product work agreed for the playground.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done.

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
  - Narrow screens (<=768px) never download Monaco; the editor slot becomes a
    read-only program view with a copy-to-clipboard button, and Run plus the
    expected-output comparison use that source. Resizing across the
    breakpoint lazily loads Monaco (or the read-only view) without losing the
    program text.
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
- [ ] C3. Package examples that run
  - "Open in playground" only for examples whose code is stdlib-only and
    sandbox-compatible; unblocks when the first real `xiom.*` packages are
    published (compiler/stdlib release integration).
- [x] C4. Shared design system
  - The playground already matches the registry/website tokens (indigo
    `#5C6BFF` on `#08090B`, panel/line/paper palette, Inter/system stack, no
    webfonts). Future: extract one canonical token file all three properties
    import or copy (registry proposal).

## Cross-repo (compiler / stdlib / ops, tracked in AUDIT.md)

- C1 `--version` reports 0.58.0 for tagged releases.
- C2 `xiom fmt` unwired (playground degrades gracefully).
- C3 Script mode ignores `--opt-level`, `--parallel`, `--incremental`.
- C5/C17 Six codegen bug classes block 31 lessons from executing.
- C6 Pinned stdlib tag ships the benchmark `package.xi`.
- C8 No WASM release asset (in-browser compiler is manually copied).
- C18 `Str` values through `Vec`/fields/`.to_str()` print nondeterministic
  pointer data (28 lessons cannot carry an expected output).
- C19 `Float64.to_str()` prints the IEEE-754 bit pattern instead of the value.
- Ops: re-clone `/opt/xiom/playground` after the history rewrite if not done.

## Acceptance for VPS testing

Phase A and B are shippable when: the browser smoke checks pass, autocomplete
and reference tiers work against the pinned toolchain, lesson history
survives reloads and can be exported/imported, and the known-limitation
badges match `tools/lesson-baseline.json` (CI enforces).
