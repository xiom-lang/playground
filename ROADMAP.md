# XIOM Playground -- Roadmap

Status as of 2026-09-25. The audit (`AUDIT.md`) is fully implemented for this
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
- [ ] C3. Package examples that run
  - "Open in playground" only for examples whose code is stdlib-only and
    sandbox-compatible; unblocks when the first real `xiom.*` packages are
    published (compiler/stdlib release integration). Registry checked
    2026-09-24: only `xiom.staging-e2e-probe` is published, so C3 stays
    open.
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
- [~] D3. Data-plane containment: move session signing and the progress
  store host-side so the web container holds no long-lived secrets and no
  multi-tenant data. Design sent to ops
  (`docs/P2_STATE_HELPER_DESIGN.md`); the playground client is implemented
  behind `PLAYGROUND_STATE=helper` with full mock-helper tests (AUDIT
  section 31). Remaining: ops helper endpoints, cutover, privacy-facts
  update.
- [x] D4. Abuse controls: per-IP token buckets on the five compiler
  endpoints (429 + `Retry-After`) and queue/rejection counters on
  `/api/health` (AUDIT section 30). The alert wiring stays with ops.
- [x] D5. Owner/ops: rotate `SESSION_SECRET`/`AUTH_HELPER_KEY`, verify the
  container egress guard from inside, and confirm the kernel Landlock ABI
  (all three done 2026-09-25).

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
  still the manual v0.58.0 copy.
- C18/C19 fixed: every lesson produces deterministic output. R64 (all-modules
  stdlib test / AI-context pack) and R65 (target-accurate `xiom.env`
  constants) shipped in v0.61.3 and do not affect the lesson set.
- Ops: v0.61.3 assets are mirrored and checksum-verified, `latest.json` is
  current again, and the deploy installs from the repo pin (option C landed
  2026-09-25); the container runs v0.61.3. The weekly drift workflow now
  reports equal-or-newer and will fail loudly on the next release until it
  is absorbed.

## Acceptance for VPS testing

Phase A and B are shippable when: the browser smoke checks pass, autocomplete
and reference tiers work against the pinned toolchain, lesson history
survives reloads and can be exported/imported, and the known-limitation
badges match `tools/lesson-baseline.json` (CI enforces).
