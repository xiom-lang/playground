# XIOM Playground -- Session Handoff

Last updated: 2026-09-24. Branch `main`, commit `518e0d4` (this handoff updates
SESSION.md only), working tree clean, all commits pushed to `origin/main`.
Production is healthy (`https://playground.xiom-lang.org/api/health` -> 200)
but the container still runs toolchain v0.60.1 -- see "Toolchain currency".

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
- Toolchain: `TOOLCHAIN_VERSION` = v0.61.1 (mirror checksum matches the GitHub
  release digest); `tools/fetch-toolchain.sh|.ps1` verify SHA256SUMS and
  support `TOOLCHAIN_TAG`; `/api/version` reads `XIOM_TOOLCHAIN_VERSION` ->
  `/toolchain/.mirror-tag` -> repo file. v0.61.1 fixed C1 (`--version`),
  C2 (`xiom fmt` now works - verified through `/api/format`), C3
  (`--opt-level` in the script-run path with level-aware caching), C6 (the
  release `lib/package.xi` is the `xiom-std` manifest), and C17/C18/C19 (all
  410 lessons run, deterministic output). `capabilities.format` is true with
  this toolchain.
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
conformance done; **C3** ("package examples that run") waits on the first real
`xiom.*` packages being published by the compiler/stdlib sessions. Phase C is
otherwise finished.

### Open decision: how the toolchain stays current

Facts as of 2026-09-24:

- The repo pins `TOOLCHAIN_VERSION` = v0.61.1; push CI, the nightly audit and
  the sweep tools all use that pin.
- The **VPS deploy script does not read the repo pin**. It reads
  `https://dl.xiom-lang.org/latest.json` and syncs `/opt/xiom/toolchain` with
  that tag. `latest.json` still advertises **v0.60.1** even though the v0.61.1
  assets are mirrored and checksum-verified, so the container is stuck on
  v0.60.1 while the repo is on v0.61.1 (the server's `/api/version` reports
  the container toolchain truthfully, so the UI label is v0.60.1 there).
- The weekly `drift.yml` compares `latest.json` with the pin and, when they
  differ, type-checks lessons with the "latest" toolchain. With a stale
  `latest.json` it now fetches the *older* v0.60.1, so the check is useless
  until the mirror metadata is fixed. It also never fails or notifies today.

Options for the next session (owner decision):

- A. Keep the manual pin and the absorption runbook (section 3.1). Each
  release requires a sweep + audit + baseline refresh, so an automatic bump
  would break the nightly expected-output assertions if it ran alone.
- B. Keep the manual pin but automate the *signal*: make the drift workflow
  open an issue (or fail loudly) when `latest.json` != `TOOLCHAIN_VERSION`,
  so a release is never silently missed.
- C. Make the repo pin the single source of truth for the VPS as well: ops
  changes `playground-deploy.sh` to read `TOOLCHAIN_VERSION` from the
  playground checkout instead of `latest.json` (the deploy already has the
  repo). Then the deployed compiler always matches CI/the repo pin, and a
  release is adopted by one reviewed commit. `latest.json` remains the mirror
  index (and the website's version source).

Recommended: **C + B**. C removes the manual ops step and the current
mismatch; B keeps drift visible for other consumers. Either way, the immediate
ops action is to refresh `latest.json` to v0.61.1 so the VPS upgrades.

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

Never hand-edit generated files. Until step 3 runs, the nightly reports
expected-output mismatches for lessons whose output changed: that is the
intended drift signal.

### 3.2 Compiler-side follow-ups (not this repo)

- C8: no WASM release asset yet (v0.61.1 ships linux/macos/windows plus the
  VS Code extension); the in-browser compiler is still copied manually at
  v0.58.0.
- R64 (all-modules stdlib test) and R65-era edge cases remain queued in the
  compiler lane with repros; they do not affect the lesson set.
- The `xiom.fmt` reachable-only peek and script-run `--opt-level` are already
  fixed and measured (AUDIT sections 18, 24).

## 4. Architecture map

- `server.js`: zero-dep HTTP server; endpoints `/api/compile`, `/api/check`,
  `/api/ir`, `/api/tokens`, `/api/format`, `/api/lessons`, `/api/version`,
  `/api/health`, `/api/auth/config`, `/auth/github(callback)`,
  `/auth/logout`, `/api/me`, `/api/progress`; safe static serving from the
  repo dir; resolves the toolchain through `lib/toolchain.js`.
- `lib/`: `run-xiom.js` (spawn + timeout + process-tree kill),
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
- Docs: `docs/PROGRESS_SYNC.md`, `docs/COMPILER_REPROS.md`.

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
2. `node tools/test-server.js` (expect 34 passed, 1 Windows skip).
3. `node tools/generate-stdlib-ref.js --check`,
   `node tools/generate-limitations.js --check` and
   `node tools/generate-expected-outputs.js --check`.
4. `node tools/lesson-audit.js --check-only --baseline
   tools/lesson-baseline.json` (expect "No regressions against baseline").
5. `git status --porcelain` empty after staging; identity correct.
