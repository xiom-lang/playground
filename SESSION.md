# XIOM Playground -- Session Handoff

Last updated: 2026-09-29 (C3 delivered: offline packages vendored, wired
and tested; Phase E sweep and B1-B5 complete; production verified).
Branch `main` at/after this section 18 commit, working tree clean, all
commits pushed to `origin/main`; CI green (Validate + CodeQL). Production
serves the swept lessons and the capability metadata, and a live
`/api/check` round-trips. The one batched ops mount request is in section
18.2; the C22 compiler relay is in section 18.3. Production runs **toolchain v0.62.1** (stdlib
0.62.0, wasm v0.62.1, `capabilities.format: true`) with P1 Landlock
(`require`, ABI 4), P3 rate limits + external `abuse` monitor, P2
host-side state and the repo-pinned VPS deploy (option C). Security P0-P3
is fully closed (the rollback window closed and the retained pre-P2
backup deleted on owner sign-off). The sandbox capability tiers ship in
the reference panel; the only open item is C3 (registry bundle). Handoff
detail: section 17.
Read with `ROADMAP.md` (next work), `AUDIT.md` (findings and verification
records), `README.md` and `DEPLOY.md`.

## 1. Repository and scope

`xiom-lang/playground` (E:\xiom-lang\playground): browser editor + lessons at
playground.xiom-lang.org. Node zero-dependency server compiles/runs programs
through the pinned XIOM toolchain in a sandboxed container; a bundled WASM
compiler covers pure programs only.

Other sessions own: `xiom-lang/ops` (VPS, Docker host, deploy scripts),
`xiom-lang/registry` (packages; no accounts by design), `xiom-lang/website`
(site + docs). The compiler/stdlib repos (`E:\xiom-lang\xiom`,
`E:\xiom-lang\stdlib`) hold the C-findings from `AUDIT.md`; do not edit them
from this session unless the owner asks.

## 2. State: what is already done

Audit (AUDIT.md) is fully implemented for this repository. Current shape:

- Runtime hardening: path-traversal containment, 512 KB body cap, async
  compile/check queues (compiles 1, checks 2), per-request work dirs under
  `<tmp>/xiom_pg_work/`, process-tree kill on timeout, 30 s compile budget,
  `/api/version`, `/api/health`, warning/error diagnostics, no-cache for
  code/HTML, immutable for wasm/images. The Dockerfile creates `/data` and
  `.dockerignore` keeps the image slim (see the gotcha in section 6).
- Lessons: all 410 solutions and templates type-check; all 410 execute and
  match a stored expected output. `js/limitations.json` and
  `tools/lesson-baseline.json` are empty (no badges, Run enabled everywhere).
  12 non-UTF-8 files were fixed earlier; `tools/migrate-lessons.js` remains
  idempotent.
- Toolchain: `TOOLCHAIN_VERSION` = v0.61.3 (mirror checksum matches the GitHub
  release digest; the two SHA256SUMS files are identical);
  `tools/fetch-toolchain.sh|.ps1` verify SHA256SUMS and
  support `TOOLCHAIN_TAG`; `/api/version` reads `XIOM_TOOLCHAIN_VERSION` ->
  `/toolchain/.mirror-tag` -> repo file. v0.61.1 fixed C1 (`--version`),
  C2 (`xiom fmt` now works - verified through `/api/format`), C3
  (`--opt-level` in the script-run path with level-aware caching), C6 (the
  release `lib/package.xi` is the `xiom-std` manifest), and C17/C18/C19 (all
  410 lessons run, deterministic output). `capabilities.format` is true with
  this toolchain. v0.61.3 (2026-09-23, R64/R65 batch) ships the AI-context
  pack, target-accurate `xiom.env` constants, a JIT `-fPIC` link fix and the
  `stdlib-v0.61.3` pin; the stdlib surface is unchanged (516 modules, 6,523
  functions) and all 410 lessons keep identical outputs (AUDIT section 26).
- Expected outputs (A3): `tools/generate-expected-outputs.js` sweeps every
  solution twice on Linux and stores `expected_output`; 410/410 deterministic,
  skip list empty (`tools/expected-output-skips.json`). The Output tab matches
  reference-solution runs; `tools/lesson-audit.js` asserts stored outputs in
  the nightly job and `--check` gates the data on every push.
- Compiler-lane tooling: `docs/COMPILER_REPROS.md` (exact C3/C6 repros, the
  harness recipe) and `tools/bench-cold-compile.js` (cache-clearing cold
  benchmark with same-machine `--compare`; reference medians for v0.60.1,
  R55 and the v0.61.1 release are in AUDIT section 24).
- Expected-output/A2-style UI: lesson badges come from limitations (now none);
  stdlib reference regenerated for v0.61.1 (516 modules, 6,523 functions).
- Accounts (C2): GitHub sign-in with a host-side auth helper (Option B; the
  container keeps zero egress and never holds the client secret), signed
  HttpOnly sessions, per-account progress documents on the `playground-data`
  volume with revision-checked merges, account chip and sync UI. Verified on
  the VPS by the owner. Contract in DEPLOY.md; policy facts in the same file.
- Registry browser (C1): `js/registry.js` Packages panel (browse
  `/index.json`, search `/search?q=`, metadata `/packages/:name`, graceful
  loading/empty/unreachable states; no package execution).
- Progress/history (B1-B4): `js/history.js` capped per-lesson run history,
  "Recent runs" block, continue-where-you-left-off card with level rings,
  JSON export/import, and `syncProgress()` (live when signed in).
- Mobile (A4): screens <=768px never download Monaco; a plain-text editor
  (16px, no iOS zoom) with Run/Copy, and Run/Format/examples read
  `getMobileCodeValue()`. Landing scrolls inside a `100dvh` container and the
  onboarding dialog scrolls on short screens.
- Landing: website page banner (`img/playground.webp`; wordmark XIOM /
  PLAYGROUND left as the h1) with the headline "Try XIOM in your browser."
  (h2) and the two primary actions centered inside the banner on a soft scrim;
  on phones they flow under the artwork with stacked full-width buttons.
  Footer carries the website social row and canonical legal links. Positioning
  aligned with the website wording (AUDIT section 20).
- Run feedback: the status bar shows a live compile clock
  ("Compiling... 2.4s") during the server compile, then the server-reported
  total ("[OK] Ran in 2.6s").
- Reliability fixes worth remembering: `/tmp` tmpfs must be `exec`; the
  toolchain cache needs a writable `HOME` (`HOME=/tmp/xiom-home`);
  `lib/toolchain.js` must stay inside the image (`tools/` is excluded from the
  build context - enforced by a test); mobile scroll and the 500 outage were
  both caught by browser/layout verification (AUDIT sections 13, 23-25).

Data branches (parking for release absorption, not merged):
`verify/release-v0.61.1` (absorbed into main; kept for reference). Older
branches (`verify/compiler-preview-*`, `verify/toolchain-v0.61.0-data`) are
superseded snapshots and can be deleted once nobody needs the history.

## 3. Next work

Roadmap: Phase A and Phase B are complete. Phase C: C1 done, C2 done, C4
conformance done; **C3** ("package examples that run") still waits on the
first real `xiom.*` packages. The public registry was re-checked on
2026-09-24 and carries only `xiom.staging-e2e-probe`, so C3 stays open. Phase
C is otherwise finished.

### Toolchain currency: decision C + B (2026-09-24; C landed 2026-09-25)

The owner decision is **C + B**:

- **B is implemented.** `.github/workflows/drift.yml` now fails the weekly
  job on any `latest.json` != `TOOLCHAIN_VERSION` drift instead of silently
  checking the wrong toolchain:
  - `latest > pin`: fetch the newer toolchain and type-check all lessons as
    preview evidence, then fail with the absorption steps (section 3.1).
  - `latest < pin`: fail with the ops request; the older toolchain is never
    fetched (exactly the failure mode that hid the stale mirror so far).
  - equal: green.
  Validated by YAML parse, `bash -n` on every run block and a live resolve
  against the mirror (AUDIT section 26).
- **C landed (ops, 2026-09-25).** `playground-deploy.sh` installs the
  compiler from the repo pin (`releases/$PIN/...`), with `latest.json` only
  as a fallback and a missing pinned archive failing the deploy; the mirror
  deploy selects the newest release by `published_at`, so the draft-flag
  freeze is fixed. The VPS container reports `toolchain v0.61.3`,
  `stdlib 0.61.3`, `capabilities.format: true` (verified 2026-09-25), and
  `latest.json` now advertises v0.61.3 as well (verified 2026-09-26). A
  manual dispatch of the drift workflow confirms `latest=v0.61.3
  pinned=v0.61.3 relation=same` and green. Details and history: section
  3.2 and AUDIT 26.2.

Last absorbed release: **v0.61.3 on 2026-09-24** (R64/R65 batch; no lesson
output changes; bench before/after in AUDIT section 26). The next release
is absorbed by the section 3.1 runbook plus one pin-bump commit; the drift
workflow (B) signals it weekly.

### 3.1 Absorbing a compiler release (runbook)

0. Pre-release verification on a local build:
   `node tools/generate-expected-outputs.js --wsl --wsl-toolchain <root>`
   then run the audit on the Linux side (section 5). Clear `/tmp/xiom_run`
   and `~/.xiom` first: the script cache is keyed by source content only, so
   an older build's binaries are silently reused otherwise (observed during
   the v0.61.0 verification).
1. Download the release artifact, verify SHA256SUMS, and check
   `xiom --version` plus `lib/package.xi`.
2. Bump `TOOLCHAIN_VERSION` and refetch with `tools/fetch-toolchain.ps1`
   (Windows) or `tools/fetch-toolchain.sh` (Linux/CI).
3. `node tools/generate-expected-outputs.js --wsl` re-executes every solution
   and rewrites `expected_output` plus `tools/expected-output-skips.json`.
4. On Linux: `node tools/lesson-audit.js --update-baseline
   tools/lesson-baseline.json`, then `node tools/generate-limitations.js`;
   regenerate `js/stdlib-ref.json` (`node tools/generate-stdlib-ref.js`) if
   the stdlib changed.
5. Run the gate (section 8) and commit the refreshed data with the bump.
6. Pending compiler fixes to re-verify at each absorption until they land:
   `net.tcp_connect("127.0.0.1", 1)` with no listener must return `Err`
   (the signedness fix needs the compiler m146 change plus the stdlib
   `Int32` extern declarations, merged as `c193bc4`; alone the stdlib
   change is behavior-neutral on the current pin, so only a release
   pairing both flips the check). If it still prints `Ok`, note it in
   AUDIT 29.4 and skip; if the pin bumps before a stdlib release, target
   stdlib `origin/main` at or after `c193bc4`. The direct-builtin probe
   from 11.1 is the quickest check (`connect_result` must be negative,
   not 4294967295).

Never hand-edit generated files. Until step 3 runs, the nightly reports
expected-output mismatches for lessons whose output changed: that is the
intended drift signal.

### 3.2 Ops change request: option C (playground-deploy.sh) -- landed 2026-09-25

Ops implemented this on 2026-09-25: `playground-deploy.sh` reads the pin
from `$WORK/TOOLCHAIN_VERSION` and installs
`releases/$PIN/xiom-${PIN#v}-linux-x64.tar.gz` (with `latest.json` only as a
fallback and a missing pinned archive failing the deploy), and
`dl-deploy.sh` selects the newest release by `published_at`. The container
and `/api/version` now report v0.61.3. The request below is kept for
history.

Handed to the owner 2026-09-24; ops repo `xiom-lang/ops`,
`scripts/playground-deploy.sh` (installed on the VPS as
`/opt/xiom/bin/playground-deploy.sh`). Requested change, after the
`git reset --hard FETCH_HEAD` that already brings the repo pin into
`$WORK`:

- Read the pin and use it for the installed toolchain:
  `PIN="$(tr -d '\r\n ' < "$WORK/TOOLCHAIN_VERSION")"`; compare it with
  `$TOOLCHAIN/.mirror-tag` as today (keep that file name: `/api/version`
  reads it), and construct the asset URL from the pin instead of
  `latest.json`:
  `url="https://dl.xiom-lang.org/releases/$PIN/xiom-${PIN#v}-linux-x64.tar.gz"`.
- Keep the staged download and swap exactly as is, so a missing asset leaves
  the running toolchain untouched (`curl -fsSL` fails and the script exits
  non-zero).
- `latest.json` stays the mirror index for the website and other consumers;
  it is no longer deploy input.
- Then a release is adopted by one reviewed commit to this repo (the pin
  bump), and the container always matches CI and the sweep data.

Safety note: with C in place, a pin bump whose release is not yet on the
mirror makes the hourly deploy fail loudly while the old toolchain keeps
running -- intended, and the drift workflow (B) reports the same drift
weekly.

### 3.3 Compiler-side follow-ups (not this repo)

- C8: the v0.61.3 SHA256SUMS lists `xiom-wasm-0.61.3.wasm`, but the file
  404s on both GitHub and the mirror (release-pipeline upload gap); the
  in-browser compiler is still the manual v0.58.0 copy. Flagged to the
  compiler/ops owner (AUDIT section 26).
- R64 (all-modules stdlib test / AI-context pack) and R65 (target-accurate
  `xiom.env` constants) shipped in v0.61.3; neither changes lesson output.
- `net.tcp_connect(host, port)` returns `Ok` even when nothing is
  listening (verified with no listener on `127.0.0.1:1`, sandboxed and
  unsandboxed), so it cannot be used to detect connection failures. The
  stdlib wrapper (`lib/xiom/net/net.xi` lines 49-78) checks the return of
  `xiom_socket_connect` correctly, so the suspect is the runtime builtin.
  The sandbox denial suite uses a raw `connect(2)` probe instead.
  Relayed to the compiler lane 2026-09-26 with the repro and the suspected
  builtin; status pending the next release (AUDIT section 29.4).
- The `xiom.fmt` reachable-only peek and script-run `--opt-level` are already
  fixed and measured (AUDIT sections 18, 24).

## 4. Architecture map

- `server.js`: zero-dep HTTP server; endpoints `/api/compile`, `/api/check`,
  `/api/ir`, `/api/tokens`, `/api/format`, `/api/lessons`, `/api/version`,
  `/api/health`, `/api/auth/config`, `/auth/github(callback)`,
  `/auth/logout`, `/api/me`, `/api/progress`; safe static serving from the
  repo dir; resolves the toolchain through `lib/toolchain.js`.
- `lib/`: `run-xiom.js` (spawn + timeout + process-tree kill + exit
  code/signal reporting),
  `toolchain.js` (toolchain resolution shared with the tools; must stay out
  of `.dockerignore`), `auth.js`, `progress-store.js`.
- `js/`: `app.js` (shell, version footer, theme, continue card, compile
  clock), `history.js`, `editor.js` (Monaco + mobile editor), `completions.js`,
  `compiler.js` (WASM preview + server authority + expected-output match),
  `lessons.js`, `stdlib-ref.js`, `registry.js`, `wasm-loader.js`,
  `compiler-ref.js`, `syntax.js`.
- `tools/`: `lesson-audit.js`, `generate-expected-outputs.js`,
  `generate-stdlib-ref.js`, `generate-limitations.js`, `bench-cold-compile.js`,
  `migrate-lessons.js`, `lesson-patches.js`, `fetch-toolchain.*`,
  `test-server.js`, `lib/toolchain.js` (re-export), `lib/output.js`.
- Data: `js/stdlib-ref.json`, `js/limitations.json`,
  `tools/lesson-baseline.json`, `tools/expected-output-skips.json`,
  `TOOLCHAIN_VERSION`, `WASM_VERSION`, `img/playground.webp`.
- `sandbox/xiom-sandbox.c`: Landlock wrapper (P1), built by the Dockerfile
  and invoked by `server.js` for every compiler child.
- Docs: `docs/PROGRESS_SYNC.md`, `docs/COMPILER_REPROS.md`,
  `docs/SECURITY_HARDENING.md`, `docs/OPS_SECURITY_REQUEST.md`,
  `docs/checklists/security-hardening.md`.

## 5. Commands

```powershell
# Windows dev: the pinned toolchain lives in .toolchain/; program execution
# must run on Linux (Windows clang hangs at -O2).
node server.js                         # local server (resolves .toolchain)
node tools/test-server.js              # 34 smoke checks (1 Windows skip)
node tools/lesson-audit.js --check-only --baseline tools/lesson-baseline.json
node tools/generate-expected-outputs.js --check
node tools/generate-stdlib-ref.js --check
node tools/generate-limitations.js --check
node tools/bench-cold-compile.js       # cold-compile benchmark

# Linux execution (WSL): sweep and audit against a toolchain root:
node tools/generate-expected-outputs.js --wsl --wsl-toolchain /home/lefteris/xiom_mirror/tc
wsl -d Ubuntu -- bash -lc "cd /mnt/e/xiom-lang/playground && node tools/lesson-audit.js --baseline tools/lesson-baseline.json"
# WSL has Node 22 at /home/lefteris/node-v22.23.2-linux-x64 (section 6).
```

Toolchain roots used so far: `/home/lefteris/xiom_audit/tc` (pinned v0.60.1),
`/home/lefteris/xiom_mirror/tc` (mirrored v0.61.1), plus local-build previews
under `/home/lefteris/xiom_pre*/tc`. Wipe `/tmp/xiom_run` and `~/.xiom` when
switching between them.

## 6. Environment facts and gotchas

- Windows dev box; the Docker engine is not running locally, so container
  behavior is verified via a simulated build context (copy the repo applying
  `.dockerignore`, run `node server.js` there) and on the VPS.
- `.dockerignore` excludes `tools/`, `docs/`, `*.md`, `.toolchain`, `.github`,
  `.kilo`, `data/`. Runtime code must never require a file from those paths;
  `tools/test-server.js` walks server.js's require graph and fails if it does
  (this guard exists because the v0.61.1-era require of `tools/lib/toolchain`
  crash-looped the deployed container with an nginx 500).
- The VPS toolchain comes from `dl.xiom-lang.org/latest.json` (currently still
  v0.60.1); CI and the tools use the repo pin. See the decision in section 3.
- Compiler script cache: `xiom run` reuses binaries under `/tmp/xiom_run`
  (plus `~/.xiom`) keyed by source content only; clear both when switching
  builds. Compose sets `HOME=/tmp/xiom-home` so the cache works on the
  read-only rootfs, and `/tmp` is mounted with `exec` (a noexec tmpfs made
  every run fail with EACCES).
- Windows harness trap: stale `.xi` trees under `%TEMP%` inflate the
  front-end ~30x (the compiler scans them); keep TMP/TEMP clean when
  benchmarking.
- `%TEMP%\kilo` holds scratch scripts and the history backup bundle; treat as
  ephemeral. `.kilo/` worktrees are dev state: never edit them.
- Browser cache: JS/CSS/HTML are `no-cache`; wasm/images cached a day.
- `editor.action.insertSnippet` does not exist in Monaco 0.52; use
  `executeEdits` + `setSelection`.
- Keep the container sandbox intact (non-root, read-only rootfs, tmpfs
  `exec`, cap_drop, limits, no egress).
- Repo hygiene: `a.out` and `data/` are gitignored; local generation runs
  must not leave artifacts in the repo.

## 7. Conventions

- Commits: conventional messages, repo-local identity
  `Lefteris Notas <lefterisnotas@gmail.com>` (verify with
  `git log -1 --format='%an <%ae>'`). Use `git commit -s`: a DCO workflow
  checks sign-off on pull requests (direct pushes to main are unaffected).
- Frontend JS is ES5-style, no bundler, no dependencies; tools are
  zero-dependency Node (>=18); docs stay ASCII.
- Per tranche: implement, verify in a real browser or on Linux as
  appropriate, update `ROADMAP.md`/`AUDIT.md` statuses, commit, push to
  `origin/main` (normal push, never force).
- Generated data is never hand-edited: regenerate and run the `--check` gates.
- Never weaken the sandbox; never store secrets in the repo (they live in
  `/opt/xiom/playground.env` and the host helper env on the VPS).

## 8. Verification gate before commit

1. `node --check` on every JS file (server, lib, tools, js).
2. `node tools/test-server.js` (41 passed + 1 Windows execution skip on the
   dev box; 47 passed on Linux/CI, where the execution tests run).
3. `node tools/generate-stdlib-ref.js --check`,
   `node tools/generate-limitations.js --check` and
   `node tools/generate-expected-outputs.js --check`.
4. `node tools/lesson-audit.js --check-only --baseline
   tools/lesson-baseline.json` (expect "No regressions against baseline").
5. `git status --porcelain` empty after staging; identity correct.

## 9. Relay from the compiler lane (2026-09-25)

**Statement semicolons -- owner decision: option (a), the Rust-like tail
form, STAYS.** `;` separates statements; ONLY a block's final expression (its
value) may omit it; a statement before another statement needs the separator
(`P001` otherwise). Lesson guidance: make every statement end with `;` in
multi-statement solutions/templates (L0-first-steps and L1-foundations above
all), and use a tail expression only deliberately where a value is produced.
The compiler now states this in the canonical `AI_CONTEXT.md` and the MCP
`xiom_language_guide`; a `P001` note pointing at the missing separator is
queued in the compiler's Stage 6. This is a consistency/documentation change,
not a semantic one: single-statement bodies without the final `;` remain
valid, so existing lessons keep working (the lesson baseline gate is the
proof at the next run).

**Runner UX -- crash reporting (owner probe, 2026-09-25):** a program that
crashes is currently reported as "Program ran with no output". Repro: two
mutually recursive functions with no base case (`fn a() { b(); }` /
`fn b() { a(); }`) die in the XIOM runtime's fault trap -- Windows exit
`0xC000001D` (`-1073741795`), stdout empty. The runner should surface a
non-zero/crash exit ("program crashed (exit ...)") instead of only the empty
output, so learners can tell "ran with no output" from "died". The compiler
lane classified it as NOT a compiler bug (the program cannot terminate) and
recorded the runner-side fix in its SESSION under the website/playground
cross-lane status. An infinite-recursion warning lint is queued in the
compiler's Stage 6 (`docs/STAGE6_LINT_WAVE.md`, W002), which will let the
compiler warn on the unconditional-cycle shape before it ever runs.

**Toolchain:** `TOOLCHAIN_VERSION` stays v0.61.3 until the combined v0.62.0
release exists -- the compiler side is pre-flight green and waiting on the
stdlib lane's release; bump and refresh `latest.json` per section 3 after the
release is published.

### Follow-up implemented (2026-09-25)

- **Crash reporting fixed.** `lib/run-xiom.js` now also returns `signal`
  (signal-terminated children) and `spawnError`; `server.js` classifies a run
  that died -- a non-zero process exit, a signal, or the driver's masked
  `exit code: -1` on stderr (the Linux fault-trap path) -- as
  `Program crashed (exit code ...).` with `success:false`, `runError` set and
  `runOutput: null`, so it can never match an expected output and run history
  records a failure. Genuine empty runs keep "Program ran with no output."
  The exact repro, the Windows `0xC000001D` status and the shared signature
  of out-of-bounds/div-zero/unwrap faults are recorded in AUDIT section 27.
  `tools/test-server.js` gained a Linux execution test for the repro; the
  suite is 37/37 on Linux and 34 + 1 Windows skip on the dev box.
- **Semicolon guidance verified, no lesson edits needed.** Every
  `solution` and `code_template` field of all 410 lessons, plus every
  narrative ```xiom fence, was scanned (comments stripped, one-line and
  multi-line blocks): no statement that precedes another statement or a
  block end is missing `;`; the only non-semicolon block tails are
  deliberate value-producing expressions (function returns, match arms,
  if-values). L0 and L1 are fully clean, as are the L2 narratives. Future
  lesson edits follow the rule; the compiler-side `P001` note and the W002
  unconditional-cycle lint remain queued.
- **Beginner copy:** L0-01 states the rule, L0-02/L0-12 repeat it in common
  mistakes, and L0-08/L0-10/L0-28/L0-33 cover the if/while-condition trap.
  L6-16, where the value-tail form first appears, gained a tip explaining
  why the final expression skips `return` and `;` (AUDIT section 27.2).

## 10. Security audit: stdlib reach from submitted programs (2026-09-25)

Owner request: audit what a compiled submission can do via the stdlib (`io`,
directory creation, process, ...). Findings and evidence are in AUDIT
section 28. Summary:

- **Working capabilities (measured):** `io.env_var` read the server's
  secrets before the fix; `io.read_file`/`io.fs_*` read regular files;
  `io.write_file`/`io.create_dir` write under `/tmp`; `process.spawn_command`
  runs shell commands; user code can declare `extern "C"` and call libc
  (`system()` verified). Egress stays blocked by the ops guard.
- **Fixed here:** compiler children now get a whitelisted environment
  (`server.js` `userChildEnv()`), so the one-line `io.env_var("SESSION_SECRET")`
  leak is closed; a canary test covers it (suite 38/38 on Linux).
- **Open, needs the owner/ops (AUDIT 28.4):**
  1. ~~Rotate `SESSION_SECRET` and `AUTH_HELPER_KEY`~~ -- done by ops
     2026-09-25 (the other points stand).
  2. ~~Isolate each execution~~ -- P1 is implemented and locally verified;
     the remaining steps are the VPS deploy and the ops in-container
     verification (see below).
  3. If P1 verification fails, fall back to the host-side runner or move
     the progress store and secrets behind the host helper (P2).
- The website privacy page may need a note if isolation is deferred; the
  fact list in DEPLOY.md is unchanged until the owner decides.

### P1 Landlock sandbox: implemented and locally verified (2026-09-25)

Ops confirmed the VPS kernel 6.8 + Landlock ABI 4 (with real read/connect/
bind denials inside the live container), rotated `SESSION_SECRET` and
`AUTH_HELPER_KEY`, and made the egress guard boot-durable.

- `sandbox/xiom-sandbox.c`: deny-by-default Landlock policy, ABI-aware,
  `no_new_privs`, execs the target so the driver, clang, the linker, the
  program and anything they spawn inherit it. `--probe` reports the ABI;
  `--` wraps a command; `XIOM_SANDBOX_TARGET` covers the tools/audit.
- `server.js`: `XIOM_SANDBOX=require|auto|off`, startup probe + canary,
  fail-closed endpoints, `/api/health` reports
  `sandbox: {mode, active, landlock, error}`.
- `docker-compose.yml` sets `require` (version-controlled); the Dockerfile
  builds the wrapper and fails if it does not compile.
- `tools/verify-sandbox.js` (denial suite + warm-run timing),
  `tools/test-server.js` (require-mode health + confinement tests), and
  `validate.yml` (denial suite per push with `--require-net`; nightly
  410-lesson execution audit under the wrapper).
- Evidence: denial suite green, warm repeat 12-21 ms, test-server 40/40 in
  require mode, and the full execution audit **410/410 with no
  regressions** through the wrapper (AUDIT section 29). Local WSL kernel is
  ABI 3, so the TCP rule is exercised on ABI 4 hosts/CI/production. CI on
  the ABI 7 runner confirms `tcp=denied (EACCES from connect(2))`, all
  other denials, warm 2 ms, and test-server 40/40.
- **Resolved 2026-09-25:** deployed (`f5fccef`) and verified live by ops --
  see "P1 verified live on the VPS" below; the nightly CI (2026-09-26) also
  runs the denial suite and the 410/410 execution audit with the sandbox
  required.

### P1 verified live on the VPS (ops report, 2026-09-25)

Deploy `f5fccef`: startup `Sandbox: mode=require active=true
landlock_abi=4`; `verify-sandbox --require-net` all probes ok (control,
tmp-rw, escape read/write denied, proc/etc denied, spawned shell denied,
`tcp=denied` EACCES from `connect(2)`, warm-run 9 ms); `/api/health`
`{"mode":"require","active":true,"landlock":4,"error":null}`; in-container
egress still blocked; the public-API escape program prints
`data=denied / proc=denied / tmp=ok / spawn=ok / spawnproc=denied`. P1
acceptance met; rollback stays `XIOM_SANDBOX=off` + redeploy.

Nightly CI (2026-09-26): the scheduled run is green with the sandbox
required -- denial suite ok (`tcp=denied` EACCES, warm-run 3 ms) and the
full execution audit **410/410 with no regressions** through the wrapper.

### P2 design sent to ops (2026-09-25)

`docs/P2_STATE_HELPER_DESIGN.md`: extend the existing playground auth helper
(same unit, bind, port 3400, helper key) with opaque session tokens and
progress storage on the host (`/opt/xiom/playground-state`). The container
drops `SESSION_SECRET` and the `/data` mount; cookie verification is a
cached helper lookup; progress read/write proxies to the helper with the
existing revision/conflict semantics; the OAuth state moves to a per-boot
random key. Sessions are minted only by a completed OAuth exchange, so a
compromised container cannot forge identities or read the store without
live tokens. Cutover: snapshot `/data`, copy the account documents host-side,
deploy the helper endpoints and the container update, users sign in once.
The playground side (async `userFromRequest`, the progress-store client,
the mock helper and tests) starts when ops confirms the helper is live.

### P2 client landed behind the mode flag (2026-09-25)

`PLAYGROUND_STATE=helper` now switches the container to the host-side state
protocol while the default stays `local`, so main is deployable either way:
`lib/auth.js` keeps the HMAC path in local mode and, in helper mode, uses
opaque tokens from `/exchange`, a cached `GET /session` lookup, host-side
logout, and a per-boot OAuth state key (no `SESSION_SECRET`).
`lib/progress-store.js` proxies `GET/PUT/DELETE /progress` with the
caller's bearer token, keeping the revision/conflict shapes and the
container-side sanitization. The mock helper implements the full protocol
and five helper-mode tests cover sign-in, `/api/me`, progress round-trip +
409 + revoke, forged cookies and logout. Suite: 41 + 1 Windows skip, 47/47
on Linux with the sandbox required (AUDIT section 31).

Remaining for P2: ops implements and confirms the helper endpoints, then
the cutover per `docs/P2_CUTOVER_RUNBOOK.md` (paste-ready: backup, seed the
host store, install/verify the helper, rotate the key, flip
`PLAYGROUND_STATE=helper` via `/opt/xiom/playground.env`, verify, phase-2
compose cleanup, rollback).

### P2 accepted by ops (2026-09-25)

Ops accepts `docs/P2_STATE_HELPER_DESIGN.md` and implements the endpoints by
extending the existing auth helper (same port/key, constant-time compare,
sessions in `sessions.json`, documents under `/opt/xiom/playground-state/`
0600/0700 with atomic writes, absolute 30-day TTL). When ops confirms them
live, the owner schedules the cutover window; the playground client is
already landed and tested behind `PLAYGROUND_STATE=helper`.

**Helper live 2026-09-26 (ops):** service active with a clean start, state
dir `/opt/xiom/playground-state` created 0700 owned by `xiom-auth`, and the
C4 contract checks all pass (`/health` ok; `/session` 401 without/with a
bad bearer; `/progress` 401; logout 200; bad helper key 401; container-side
`http://host.docker.internal:3400/health` 200; ops local contract test
23/23 including null/stale-base 409s, delete idempotence, second-account
isolation, store mode 0600).

**Cutover executed and verified 2026-09-26 (ops):** helper mode live
(`State: helper sessions/progress`), `SESSION_SECRET` removed,
`AUTH_HELPER_KEY` rotated and matching, forged cookie 401, `/api/health`
keeps `sandbox.mode=require` and `abuse:ok`, browser sign-in and progress
sync confirmed writing host-side. The pre-P2 env and `/data` backup are
preserved for the 24-48 h rollback window. C7 landed in the repo (compose
drops the `/data` mount and `PLAYGROUND_DATA_DIR`; the named volume stays
unmounted for rollback) and the privacy facts in `DEPLOY.md` are updated;
the website page sync is handed to the website lane in the 2026-09-26
report. Remaining: owner's UptimeRobot keyword monitor on `"abuse":"ok"`.

### P3 monitor field confirmed (2026-09-25)

Ops wires an external UptimeRobot keyword monitor (VPS cron mail is rejected
by SPF) on the literal `"abuse":"ok"` in `/api/health`. The field flips to
`"saturated"` when the compile queue has been continuously busy for
`ABUSE_BUSY_MS` (default 180 s) or the limiter rejected `ABUSE_REJECTIONS`
requests within `ABUSE_WINDOW_MS` (default 50 in 5 min); the raw counters
stay in the payload. Verified by the suite (idle `"ok"`, burst instance
flips after its 429).

**Monitor wired 2026-09-26 (owner):** the UptimeRobot keyword monitor
reports healthy (`abuse:ok` on production). P3 is closed; no playground
action remains.

**Post-cutover ops state (2026-09-26):** `/opt/xiom/playground-state` is in
the nightly restic set (ops updated the script/runbook; the owner ran the
first backup with a dump check), and ops scheduled the window-close cleanup
once C7 has been deployed for 24-48 h: remove the retained
`playground_playground-data` volume and the pre-P2 env copy, keeping the
accounts backup until the owner signs off. Nothing needed from the
playground lane for the window close.

### P3 abuse controls landed (2026-09-25)

Per-IP token buckets on the five compiler endpoints (burst 10, refill 4 s,
`RATE_LIMIT_BURST`/`RATE_LIMIT_REFILL_MS`, `0` disables), 429 with
`Retry-After` and a compile-shaped body the UI can show, X-Forwarded-For
trusted only from private/loopback peers, and `/api/health` now carries
`counters` plus `rateLimit` for ops alerting. Verified by the test suite
(36 + 1 Windows skip; 42/42 on Linux with the sandbox required) and
recorded in AUDIT section 30. Ops can tune the knobs in compose and wire
the queue-depth/rejection alert; the uptime check already polls
`/api/health`.

Plan and relay for this audit:

- `docs/SECURITY_HARDENING.md` -- production-grade plan: P1 Landlock
  wrapper around every compiler child (deny `/data`, `/proc`, network;
  fail closed), P2 data-plane containment (sessions/progress host-side so
  the web container holds no long-lived secrets), P3 per-IP rate limits
  and health counters. Acceptance criteria and rollback per phase.
- `docs/OPS_SECURITY_REQUEST.md` -- the message for the ops lane: rotate
  `SESSION_SECRET`/`AUTH_HELPER_KEY`, verify the egress guard from inside
  the container, confirm the kernel Landlock ABI, and decide between the
  Landlock wrapper and a host-side runner service.
- `docs/checklists/security-hardening.md` -- the step-by-step execution
  checklist for P0-P3.

## 11. Cross-lane relays (2026-09-26)

Both relays below were sent through the owner; this records the exact asks
for the next handoff.

### 11.1 Compiler: net.tcp_connect reports success on a failed connect

Repro: `net.tcp_connect("127.0.0.1", 1)` with no listener prints `Ok` on the
v0.61.3 mirrored toolchain (sandboxed with the Landlock wrapper and
unsandboxed); the stdlib wrapper (`lib/xiom/net/net.xi` lines 49-78)
returns `Err` correctly when `xiom_socket_connect` returns a negative
value, so the runtime builtin is the suspect -- confirm it surfaces
`connect(2)`'s result/errno (or a negative sentinel) and waits on
non-blocking sockets before returning success. Impact: programs cannot
detect failed connections, and our first sandbox TCP probe was invalidated
by this.

**Compiler response (2026-09-26):** root cause is signedness; a
compiler-side fix landed (m146), and the pinned stdlib still needs the
`Int32` extern declarations. The wasm asset release (C8) does not fix it.

**Playground confirmation (2026-09-26):** declaring the builtin directly as
`fn xiom_socket_connect(...) -> Int` and connecting to the refused port
prints `connect_result=4294967295` (0xFFFFFFFF, the 32-bit -1
zero-extended), so `result < 0` in the current wrapper never triggers.
The fix therefore needs both the compiler change and signed-32-bit extern
declarations in the stdlib; re-check at the next absorption (pin bump,
SESSION 3.1) once a release carries both. Our sandbox denial suite is
unaffected (raw `connect(2)` probe).

**Update 2026-09-27 (compiler + stdlib relays):** the stdlib's `Int32`
extern declarations are merged and pushed as `c193bc4` (`fix(net): extern
returns Int32 (m146 prep)`) across all four declarations (`net.xi`,
`http.xi`, `socket.xi`, `websocket.xi`), present in the stdlib tip
`1fbb45a`; `git ls-remote` confirms it on the stdlib `origin/main`. Alone
it is behavior-neutral on the v0.61.3 pin (the `-1` -> `4294967295`
widening persists), so a refused-port connect only surfaces as `Err` in
the first compiler release that pairs m146 with stdlib >= `c193bc4`. Until
a stdlib release is cut (queue F, gated on 100% + tag), absorption step 6
may target stdlib `origin/main` at or after `c193bc4` whenever the pin
bumps. The pending wasm-asset release includes neither half.

**Update 2026-09-29 (stdlib release cut):** the stdlib lane published
`stdlib-v0.62.0` (run 36495200067: Ubuntu and Windows gates, package and
GitHub Release all green; the staging canary's version pin-PR PAT gap
stayed known-red under continue-on-error). Assets, verified from the
playground side against the GitHub API and the downloaded `SHA256SUMS`:
`xiom-std-0.62.0.tar.gz` (1,055,855 B,
sha256 `1d379b5d1e2a3fb10445bfd6d1ba55f482e9fe08dd6bbc64b0ecf2da166d9324`)
matches the sums file; release published 2026-09-29T00:10:41Z, subject sha
`0e631018100b157539614cc92fc471f22663baff`, ref
`refs/tags/stdlib-v0.62.0`. The registry lane is re-dispatching the
publish to finish verification. Nothing changes for the playground pin:
toolchain v0.62.1 already bundles stdlib 0.62.0 (`/api/version` reports
`stdlib: 0.62.0`, 516 modules).

**Playground cross-check of the release asset (2026-09-29):** downloaded
`xiom-std-0.62.0.tar.gz` (sha256 verified above) and compared it
file-by-file with the stdlib bundled in the pinned toolchain
(`.toolchain/lib`): of the 531 files that differ, 521 differ only by CRLF
line endings (Windows toolchain packaging; byte-identical after
normalization) and 10 carry real differences -
`math/{matrices,number_systems,primitives,queueing}.xi`,
`num/{base,convert,float,precision_integer,precision_rational}.xi`,
`regex/syntax.xi`. The release side carries additional `ensures:` clauses
(a later contract-annotation pass) plus small code changes (e.g.
`math/primitives.xi` frexp normalization now uses `f >= 2.0` / `f < 1.0`),
so the tag points at commits newer than the snapshot embedded in
toolchain v0.62.1. No action for the current pin (the playground consumes
the toolchain, never the tarball), but re-run the lesson output audit at
the next pin bump: contract additions and the primitives changes can
alter edge-case behavior.

### 11.2 Registry: first real xiom.* packages (C3)

Answered 2026-09-28 (registry): production carries ~330 real `xiom.*`
packages (e.g. `xiom.hello@0.1.0`, `xiom.csv@0.1.0`, all signed); `GET
/index.json` is the stable public contract and artifacts are public via
`GET /packages/<name>/<version>/package.tar.gz`, so a pinned consumer can
verify sha256 + ed25519 from the index alone. `xiom-std@0.62.0` is gated on
the stdlib release workflow, not needed for C3. The no-egress path does not
exist yet: the registry offers `scripts/export-bundle.js` producing
`index.json` + `artifacts/<name>/<version>/package.tar.gz` + `bundle.json`
(hashes/signatures/source URLs) plus `OFFLINE.md`, exportable from
production and pinned by sha256; queued as the C3 deliverable. The
playground consumes it through `xiom pkg`'s local-packages fallback
(`<repo>/packages/xiom-<pkg>/` or `XIOM_HOME/packages/<pkg>-<ver>/`).

**Playground -> registry (2026-09-29, relayed through the owner):** the
exact message text for the relay:

> Playground -> registry (2026-09-29): C3 is the playground's only open
> item and it is blocked on the offline bundle. `scripts/export-bundle.js`
> and `OFFLINE.md` are in place, but no `bundle.json`/artifacts have been
> produced yet. Please export the bundle against
> `https://registry.xiom-lang.org` (at least `--latest-only`) covering
> `xiom.hello@0.1.0` and `xiom.csv@0.1.0` - vendored `index.json` +
> `artifacts/<name>/<version>/package.tar.gz` + `bundle.json` +
> `OFFLINE.md`, sha256-pinned - and reply with the bundle's location and
> sha256. The playground then sends its single batched ops mount request
> (read-only) and wires the offline example with a sandboxed test to close
> C3. No other registry action is pending from this lane.

### 11.3 Compiler: direct `for x in Vec` iterates zero times (2026-09-27)

While sweeping lesson prose (section 12), we found that on v0.61.3
`for x in ["a","b","c"] { io.println(x) }` compiles, runs, and prints
nothing; when the body needs the element as `Str` the compiler reports the
binder as `Int` (`argument type mismatch ... found Int`). Every lesson
solution already uses the indexed idiom
`for __i in range(0, v.len()) { let x = v[__i]; ... }` (with
`use xiom.iter;`), which works but prints
`xiom: warning: unknown type 'Iterator' -- defaulting to i64`. Ask: is
direct iteration supposed to work, and is the `Iterator` warning a known
pending fix? Prose still teaches the direct form in 40 places; L0's five
affected lessons were rewritten and executed; the remaining 35 are in the
Phase E sweep (AUDIT 32.1).

### 11.4 Compiler: is a bare-literal `12.to_str()` guaranteed? (2026-09-27)

Verified on v0.61.3: `to_string(Int)` and `int_to_string(Int)` work,
`to_string(Bool)` does not exist, and the `.to_str()` method works on Int,
Bool and Float64 including on bare literals (`12.to_str()` prints 12) and
parenthesized expressions. The owner flagged the literal-after-number shape
as fragile; L0-02 now teaches `to_string(12)` for whole numbers with a note
that variables can use `age.to_str()`. Ask: is the bare-literal method form
guaranteed by the grammar, or should lessons prefer `to_string(...)` /
parenthesized receivers?

## 12. Lesson content QA (2026-09-26)

**Compiler answers received (2026-09-27):** (a) bare-literal conversion is
guaranteed -- `12.to_str()`, `(12).to_str()` and `12.to_string()` all work,
member access binds to the literal; L0-02 back to the bare `.to_str()` form
with `to_string(12)` as the Int-only alternative. (b) Direct `for x in Vec`
is supported and correct on current main; the zero-iteration behaviour is
the v0.61.3 pin, so the range+index rewrites stay until the pin moves
(revisit after the next absorption); the `Iterator` warning is Range-only
noise, safe for lessons, logged for compiler polish.

Owner report: L0-02 claimed numbers print without quotes, but
`io.println` is text-only (`io.println(1)` is a type error on v0.61.3).
A corpus check with the new `tools/audit-snippets.js` extracted 418
complete `fn main` programs from lesson prose: 406 fail standalone, 213
only for a missing module line (the excerpt convention), and 197 for real
reasons -- dominantly printed non-Str values, plus missing `;`,
`->` where a match arm needs `=>`, and a few malformed samples.

Fixed and compile-verified: L0-01 (semicolon habit + tail-expression
exception note), L0-02 (number printing via `.to_str()`; tips, mistakes,
try_it, template and solution corrected), L0-03 (samples and solution now
compute instead of printing hand-written answers), L0-04 and L0-07
(samples print variables/booleans with `.to_str()`; solutions print the
computed values -- outputs unchanged, so `expected_output` and the
baseline stay valid). Details, counts and the remaining sweep:
AUDIT section 32 and ROADMAP Phase E. Sweep command:
`node tools/audit-snippets.js --level Lx --imports`.

## 13. Backlog and waiting state (2026-09-28)

Backlog B1-B5 is implemented (ROADMAP's backlog section; AUDIT 32.4):

- B1 capability tiers (`full`/`limited`/`blocked`) generated in
  `tools/generate-stdlib-ref.js`, regenerated into `js/stdlib-ref.json`,
  and surfaced as panel badges plus a one-line sandbox note;
- B2 friendly sandbox-denial messages in the runner (`lib/denials.js`);
- B3 `docs/SANDBOX_CAPABILITIES.md`, linked from the panel;
- B4 a "Playground vs a real compiler" note in L8-20;
- B5 the Phase E prose sweep finished L2-L8 (AUDIT 32.4).

These were playground-only changes: no ops requests, no container/VPS
changes. Compiler lane replied (2026-09-28): `tcp_connect`, the wasm
glue, strict mode and the `opt` warning are shipped; the Range-only
`Iterator` warning and the W005 float-to-str stub are queued as polish
with the tier-2 lints. Nothing playground-side is blocked on the compiler
lane.

C3 delivered 2026-09-29 (section 18): the registry bundle is exported and
independently verified, the playground resolves packages offline (vendored
pins plus the mounted bundle when present), and the example plus sandboxed
tests are green. Waiting: the one batched ops mount request (section 18.2)
and the compiler run-path fix C22 (section 18.3); neither blocks the
current offline functionality.

## 14. v0.62.0 absorption attempt and relay (2026-09-28)

Release v0.62.0 landed on the mirror; we executed the full absorption
(step 6 tcp_connect fixed, strict contracts and exact arity verified, 411/411
sweep, stdlib surface 6,932 functions, bench within noise) and then **held
it**: the tree is back at v0.61.3 because two blockers would degrade
production.

- **opt warning on every run**: v0.62.0's IR verification calls `opt` with
  the removed `-passname` syntax; the toolchain bundles no LLVM and uses
  the host's (LLVM 18 here and in the container), so every program would
  show `warning: LLVM IR verification failed ...` in the UI. Relayed to
  the compiler lane for a fix (use `-passes=`, skip when incompatible, or
  bundle LLVM).
- **C8 glue**: the wasm asset is published and checksum-verified, but the
  ABI changed (1/10 -> 3/73 imports/exports), so the v0.58.0 glue is
  incompatible; the matching `xiom_wasm.js`/`.d.ts` are not published
  anywhere we can see. Relayed to the compiler lane.

Everything verified in the attempt is recorded in AUDIT section 33; the
step-6 `tcp_connect` fix is confirmed present in the v0.62.0 artifact and
closes at the next successful absorption (likely v0.62.1 with the `opt`
fix). Until then: pin stays v0.61.3, backlog B1-B5 unchanged, and the
for-in idiom can be simplified back to direct iteration once the pin
moves.

## 15. v0.62.1 absorbed (2026-09-28)

Both v0.62.0 blockers are fixed and the pin is **v0.62.1**. Verified: no
`opt` warning, refused-port `tcp_connect` returns Err (step 6 closed),
strict contracts/arity clean across 411 lessons, sweep 411/411, stdlib
surface 6,932 functions, baseline and generated data refreshed, Windows
audit green, bench within load noise. C8 absorbed: the release ships the
wasm glue, `WASM_VERSION` is v0.62.1, the loader uses the new file names,
and the Node functional test passes (`XIOM v0.62.1 (WASM)`, pure program
compiles); the owner confirmed the browser console line on production (`[xiom-wasm] in-browser compiler ready: XIOM v0.62.1 (WASM)`).

Lesson-content note: direct `for x in Vec` works on this pin, so the
`range`+index workarounds can be simplified back to direct iteration during
the L2-L8 sweep (Phase E); `range` stays valid but warns. Ops deploys the
new pin on the next hourly run (repo-pinned toolchain, option C).
## 16. C3 unblocked and the P2 rollback window closed (2026-09-28)

Registry answered the four C3 questions: packages are live and the index
contract is public and stable, so C3 no longer waits on a first publish.
The remaining piece is the offline path: registry will build
`scripts/export-bundle.js` (vendored `index.json` + tarballs + `bundle.json`
+ `OFFLINE.md`, exported from production, pinned by sha256). When it lands
the plan is: ops mounts the bundle read-only at a fixed path (one batched
ops request), the playground installs the vendored packages into
`XIOM_HOME/packages/` at startup (or the example vendors them under
`<repo>/packages/xiom-<pkg>/` via `xiom pkg`'s local fallback), and a
package example (`xiom.hello`, `xiom.csv`) becomes the C3 "Open in
playground" entry with an offline test. Verified here: 330 packages in the
index, `xiom.hello@0.1.0` carries sha256 + signature, and `xiom-pkg`
documents the local-packages fallback.

Ops closed the P2 rollback window the same day: the retained
`playground_playground-data` volume and the pre-P2 env copy are removed,
restic snapshot 3052c07f contains the host state document and the dump is
valid, and production is healthy (`abuse:ok`, `sandbox.mode=require`,
landlock 4). The accounts backup stays until owner sign-off (AUDIT 31.1).
## 17. Handoff (2026-09-28, end of session)

State: pin **v0.62.1** (stdlib 0.62.0); the wasm loader is
browser-verified on production; security P0-P3 closed (P2 rollback window
closed and the retained pre-P2 backup deleted on owner sign-off). Phase E
prose sweep is complete: the full-corpus audit ended at 199 ok + 73
missing-import + 144 excerpt + 5 failing, the five were fixed (L1-19
`let mut`; L2-05/07/08/09 missing `.to_str()`), L1+L2 re-audited to 0
failing, and all levels re-verified (L8 1/1, L7 4 excerpt, L6 9/25, L5
39/54, L4 33/43, L3 56/71, L0 90/90; all residuals excerpt-class).
Loop-fence runs: 40 executed, 39 clean; the failure exposed C21
(reference iteration passes `--check` but fails codegen), and the 10
prose fences teaching it were rewritten to while+index/while+get and
re-run. Backlog B1-B5 shipped (capability tiers and panel badges,
friendly sandbox denials, SANDBOX_CAPABILITIES.md, the L8 note). AUDIT
32.4 records the sweep, the rename classes and findings C20/C21.
Deploy check (2026-09-29, after the 00:29 UTC pull): production serves
the swept lesson JSONs (L8-10 `module`, L5-29 while+get, L4-24/30
rewrites, L1-19/L2-05 fixes), the capability metadata in
`js/stdlib-ref.json`/panel JS/CSS, and `/api/check` round-trips on the
deployed API. Same day: the stdlib lane cut `stdlib-v0.62.0` (assets live,
registry re-dispatch pending on their side); the pin is unchanged and
`/api/version` reports `stdlib: 0.62.0` (516 modules).

Next work:
1. C3 is delivered and wired (section 18). Follow-ups: send the batched
   ops mount request (18.2) when convenient, and remove the
   `stageForRun` bridge once the compiler ships C22 (18.3).
2. Optional cleanup: simplify the L0 range+index loop rewrites back to
   direct `for x in Vec` (works on v0.62.1) and run the five loop lessons
   to confirm outputs; re-run `audit-snippets --level L0` after.
3. Optional: if the compiler lane fixes C20 (module-local type identity
   across modules, AUDIT 32.4), L6-10/L6-15 prose can pass structs
   between modules again instead of the top-level shared type.

Sweep recipe (if a level needs a re-run): `tools/snippet-sweep/`
`extract-level.js` -> WSL `compile-dir.sh` -> `fix-level.js` -> re-extract
and recompile to verify; manual leftovers go through `patch-lesson.js`
with a JSON under `tools/snippet-sweep/patches/` (recorded per level);
`dedupe-imports.js` cleans repeated import blocks. Cross-check with
`node tools/audit-snippets.js --imports` (buckets `ok` / `missing-import`
/ `excerpt` / `failures`; only failures exit 1).

Environment/gotchas: Windows `.toolchain` is v0.62.1; the Linux sweep
toolchain lives at `/home/lefteris/xiom_v0621/tc` in WSL (node at
`/home/lefteris/node-v22.23.2-linux-x64/bin`); `/tmp` is wiped between
WSL invocations on this machine now, so recreate `/tmp/xiom-toolchain`
inside the same bash command (the compile script does this automatically
when the directory is missing); clear `/tmp/xiom_run` and `~/.xiom` when
switching builds; sweeps/audits run from Windows (the `--wsl` flag is
Windows-only); lesson-audit check-only takes ~20-25 min and has
intermittently crashed under machine load (exit -1, no diagnostics --
transient, re-run); never pipe binary through PowerShell (hash from files
instead). A stray `/tmp/xiom61/lib` from an older session can add
duplicate-module warnings when compiling with `/tmp` as the source
parent; the compile script's isolated copy avoids it. Gate: section 8
(all four steps) plus CI.

## 18. C3 delivered: offline package catalog (2026-09-29)

### 18.1 Bundle and wiring

The registry exported the bundle (production source, `--latest-only`) and
it was independently verified from the playground side:

- `registry-bundle.tar.gz`, 8,108,574 B, sha256
  `aed9703a4abbc0b11ee13b9b21def1fb992a51766c97c9186e367c3a97367da5`.
- `index.json`, 441,830 B, sha256
  `02280fa79e28c34a76a0c9e02a57eb47bfa570cf17698d4f60ad8238c723a21d`.
- 342 artifacts / 14,804,564 B: every sha256 and size in `bundle.json`
  re-checked; both pins confirmed (`xiom.hello@0.1.0` sha256
  `2fc7a2aa...d6e8`; `xiom.csv@0.1.0` sha256 `8d779431...abb5`).

Playground implementation:

- `packages/xiom-hello/` and `packages/xiom-csv/` vendored byte-for-byte
  from the verified artifacts (provenance in `packages/README.md`).
- `lib/packages.js`: parses `use xiom.<pkg>` imports, refuses to shadow
  stdlib modules, resolves from the mounted bundle (`XIOM_PACKAGE_BUNDLE`,
  sha256-verified extraction with a per-package cache) or the vendored
  trees, and copies `package.xi` + `src/` into the submission work dir
  (2 MB cap). `tools/prepare-packages.js` is the same resolver as a CLI.
- `server.js` prepares packages when the submission is written (the check
  stage resolves them) and stages them next to `xiom run`'s temp copy
  (`stageForRun`, bridge for C22).
- `examples/packages/main.xi` uses both packages; `tools/test-server.js`
  checks offline resolution cross-platform and runs the example where
  execution is enabled (43 passed / 0 failed / 1 skipped locally; the run
  path verified in WSL against v0.62.1 with the expected output).
- A bundle-only package (`xiom.bmp@0.1.0`, 6,418 B artifact) was extracted
  and type-checked through the same path.
- Production deploy verified after the 15:29 UTC pull: the example passes
  `/api/check` and runs through `/api/compile` in the live sandbox with
  the expected output (greeting, `rows: 3`, the three CSV rows,
  `rectangular: true`); `sandbox.mode=require`, landlock 4.

### 18.2 Ops request (delivered 2026-09-29)

> Playground -> ops (2026-09-29): one batched request for the C3 offline
> package catalog. (1) Place `registry-bundle.tar.gz` (8,108,574 B,
> sha256 `aed9703a...67da5`) on the VPS and extract it to
> `/opt/xiom/registry-bundle` (the directory form is also available;
> `index.json` sha256 `02280fa7...3a21d`). (2) Add a read-only bind mount
> to the playground compose service:
> `/opt/xiom/registry-bundle:/registry-bundle:ro`. (3) Add
> `XIOM_PACKAGE_BUNDLE=/registry-bundle` to `/opt/xiom/playground.env`
> (root, 0600, outside the repo). (4) Restart the service once. No
> egress, no writable mounts, and the sandbox policy is untouched; the
> two vendored packages keep working if the mount is not added.

**Delivered (2026-09-29):** ops exported a newer bundle on the VPS (352
artifacts / 15.75 MB, 353 packages; offline `--verify` clean), mounted it
read-only at `/registry-bundle`, set `XIOM_PACKAGE_BUNDLE` and recreated
the container (health 200, `abuse:ok`, sandbox `require`, egress guard
re-armed). The mount initially lived in an untracked
`docker-compose.override.yml`; the repo now carries the mount and the env
var upstream (`docker-compose.yml`, validated with `docker compose
config`), so ops deletes the override and the playground.env line once
the hourly deploy has shipped it. Production verified from this lane:
`/api/check` + `/api/compile` resolve and run `xiom.bmp` (not vendored in
this repo) and `xiom.loss` (published after our local export) in the live
sandbox. The 17:29 UTC deploy after the upstream landed recreated the
container from the repo compose (no override) and both package checks
plus the hello/csv example still pass -- the mount is carried upstream.

**Reply for ops (via the owner):**

> Playground -> ops (2026-09-29): thanks -- the mount is verified live
> from here (`xiom.bmp` and `xiom.loss` check and run in the sandbox;
> `xiom.loss` is newer than the local export, so we know we are reading
> the VPS bundle). The mount and `XIOM_PACKAGE_BUNDLE=/registry-bundle`
> are now upstream in `docker-compose.yml` (validated with `docker
> compose config`; explicit environment wins over `env_file`, so no gap
> when you remove the playground.env line). Please delete
> `docker-compose.override.yml` before the next hourly deploy (17:29 UTC)
> and the playground.env line at your convenience -- with both files
> defining the same mount, the merged compose could report a duplicate
> mount at container create; the running container is unaffected either
> way. Refresh recipe noted in DEPLOY.md, including the rate-limiter
> caveat for cold exports. No further ops action pending from the
> playground lane.

### 18.3 Compiler request (C22, via the owner)

> Playground -> compiler (2026-09-29): C22 -- `xiom run` cannot resolve
> sibling modules or packages. Repro on v0.62.1: with
> `<dir>/main.xi` importing `<dir>/packages/xiom-hello/src/hello.xi`
> (module `xiom.hello`), `xiom --check ./main.xi` passes but
> `xiom run ./main.xi` fails with `undefined variable 'hello'`. Cause:
> the run path reads the script text and compiles a temp copy under
> `std::env::temp_dir()/xiom_run` (main.rs ~358-448), so the catalog
> source dirs come from the temp file's location, never the script's
> directory. Impact: the playground's execute stage cannot run package
> imports while the check stage can. The playground stages package
> sources into `<tmp>/xiom_run/packages` as a bridge
> (`lib/packages.js stageForRun`) and will delete it once the run path
> adds the script's parent directory (with the existing grandparent
> guard) as a catalog source dir, mirroring `check_source`.