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