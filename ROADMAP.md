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
- [ ] A3. Expected output per lesson
  - Generate `expected_output` for every lesson from a Linux execution sweep
    (379 solutions run today), review once, and show a pass/fail match in the
    Output tab ("Output matches" / "Expected X, got Y").
  - Extend `tools/lesson-audit.js` to assert expected outputs in CI.
- [ ] A4. Mobile lesson experience
  - Read-only lesson view for narrow screens with copy-to-clipboard instead
    of a cramped Monaco instance.
- [x] A5. Editor autocomplete (data-driven)
  - Monaco completion provider built from `js/stdlib-ref.json`: module names
    after `use xiom.`, module members after an imported alias (`io.`, `math.`),
    method names after `.`, keywords/types, and parameter snippets.
- [~] A6. Visual polish
  - Tier badges, limitation badges, copy buttons, docs links, and panel
    spacing are in place; landing hierarchy and mobile polish remain.

## Phase B -- Progress and history (this repository, no backend)

Goal: make progress durable and reviewable without requiring an account.

- [ ] B1. Local history store
  - IndexedDB/localStorage history: per lesson, timestamped run results
    (success, output, duration), capped and pruned.
- [ ] B2. History UI
  - Per-lesson history drawer (last runs, pass/fail), "continue where you
    left off" card on the landing screen, per-level completion rings.
- [ ] B3. Export / import
  - Download/upload a JSON progress file; document it as the pre-account
    backup path.
- [ ] B4. Sync adapter contract (no server yet)
  - A single `syncProgress()` interface that is a no-op locally and is ready
    to call the registry service's progress API once auth exists; document
    the endpoint contract in `docs/PROGRESS_SYNC.md`.

## Phase C -- Ecosystem integration (blocked on the registry)

Goal: connect the playground to a visual registry without weakening the
sandbox.

- [ ] C1. Registry search panel (read-only)
  - Package search and package pages embedded/linked; no package execution
    in the sandbox (egress is blocked by design).
- [ ] C2. Shared account (GitHub OAuth)
  - Registry owns authentication; playground/docs consume it for optional
    progress sync across devices.
- [ ] C3. Package examples that run
  - "Open in playground" only for examples whose code is stdlib-only and
    sandbox-compatible.
- [ ] C4. Shared design system
  - Common tokens/components between registry UI and playground.

## Cross-repo (compiler / stdlib / ops, tracked in AUDIT.md)

- C1 `--version` reports 0.58.0 for tagged releases.
- C2 `xiom fmt` unwired (playground degrades gracefully).
- C3 Script mode ignores `--opt-level`, `--parallel`, `--incremental`.
- C5/C17 Six codegen bug classes block 31 lessons from executing.
- C6 Pinned stdlib tag ships the benchmark `package.xi`.
- C8 No WASM release asset (in-browser compiler is manually copied).
- Ops: re-clone `/opt/xiom/playground` after the history rewrite if not done.

## Acceptance for VPS testing

Phase A and B are shippable when: the browser smoke checks pass, autocomplete
and reference tiers work against the pinned toolchain, lesson history
survives reloads and can be exported/imported, and the known-limitation
badges match `tools/lesson-baseline.json` (CI enforces).
