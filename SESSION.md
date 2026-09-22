# XIOM Playground -- Session Handoff

Last updated: 2026-09-19. Branch `main`, commit `f718ae6`, working tree clean,
all commits pushed to `origin/main`.

Read with `ROADMAP.md` (next work), `AUDIT.md` (findings, C1-C19), `README.md`
and `DEPLOY.md`.

## 1. Repository and scope

`xiom-lang/playground` (E:\xiom-lang\playground): browser editor + lessons at
playground.xiom-lang.org. Node zero-dependency server compiles/runs programs
through the pinned XIOM toolchain in a sandboxed container; a bundled WASM
compiler covers pure programs only.

Other sessions own: `xiom-lang/ops` (VPS, Docker host, deploy scripts),
`xiom-lang/registry` (packages; auth later), `xiom-lang/website` (docs).
The compiler/stdlib repos (`E:\xiom-lang\xiom`, `E:\xiom-lang\stdlib`) hold
the C1-C17 findings from `AUDIT.md`; they are not edited from this session
unless the owner asks.

## 2. State: what is already done

Audit (AUDIT.md) is fully implemented for this repository:

- Runtime hardening: path-traversal containment, 512 KB body cap, async
  compile/check queues (compiles 1, checks 2), per-request work dirs under
  `<tmp>/xiom_pg_work/`, process-tree kill on timeout, 30 s compile budget,
  `/api/version`, `/api/health`, format capability probe, warning/error
  diagnostics, cache policy (no-cache for code/HTML, immutable for wasm/images).
- Lessons: all 410 solutions and templates type-check (was 225/343); 12
  non-UTF-8 files fixed; 379 solutions execute on Linux; 31 remain blocked by
  compiler codegen bugs (C17). Migration tool `tools/migrate-lessons.js` is
  idempotent; baseline in `tools/lesson-baseline.json`.
- Versioning: `TOOLCHAIN_VERSION` (v0.60.1), `WASM_VERSION` (v0.58.0),
  `package.json` v0.61.0; `/api/version` reads the toolchain tag from
  `XIOM_TOOLCHAIN_VERSION` -> `/toolchain/.mirror-tag` -> repo file.
- Automation: `tools/fetch-toolchain.sh|.ps1` (SHA256SUMS verified,
  `TOOLCHAIN_TAG` override), `tools/lesson-audit.js` (baseline gate,
  `--fail-on-failures`), `tools/test-server.js` (18 checks),
  `.github/workflows/validate.yml` (syntax, stdlib/limitations freshness,
  lesson audit, smoke tests) and `drift.yml` (weekly latest.json check).
- Stdlib reference: `tools/generate-stdlib-ref.js` -> `js/stdlib-ref.json`
  (516 modules, 6,522 public functions; tiers `playground` 17 top-level /
  `docs` 61 / `local` 204; docs URLs; 527 curated descriptions). Panel in
  `js/stdlib-ref.js` is lazy and tiered with search, docs links, and
  copy-to-editor.
- Editor: `js/completions.js` provides data-driven Monaco completions
  (modules after `use xiom.`, members after imported aliases, methods after
  `.`, keywords/types, signature snippets).
- Known limitations: `tools/generate-limitations.js` -> `js/limitations.json`
  (31 lessons with reasons); lesson list badges them and disables Run.
- Expected outputs (A3): `tools/generate-expected-outputs.js` sweeps every
  solution twice on Linux and stores `expected_output`; 351/379 runnable
  lessons are deterministic, the 28 with varying output are listed in
  `tools/expected-output-skips.json` (compiler findings C18/C19). The Output
  tab matches reference-solution runs, `tools/lesson-audit.js` asserts stored
  outputs in the nightly job, and `--check` gates the data on every push.
- Mobile (A4): screens <=768px never download Monaco; they get a plain-text
  editor (16px, no iOS focus zoom) with Run and Copy, and Run/Format/examples
  all read `getMobileCodeValue()`.
- Mobile scrolling (2026-09-22): the landing is now an explicit scroll
  container (`height: 100dvh` + `overflow-y: auto`; `min-height` alone let
  iOS clip the page under the `body { overflow: hidden }` shell) and the
  onboarding dialog scrolls on short screens. AUDIT.md section 13.
- Visual polish (A6): labeled landing section, search empty states, indigo
  `:focus-visible` rings, theme-token fixes, one stdlib search box, and
  working dotted queries (`io.println`).
- Progress (B1-B4): `js/history.js` stores capped per-lesson run history,
  shows a "Recent runs" block per lesson, a continue-where-you-left-off card
  with level rings, JSON export/import, and a no-op `syncProgress()` adapter
  whose registry contract is `docs/PROGRESS_SYNC.md`.
- Positioning (2026-09-19): landing, onboarding, concept cards, contracts tab
  and the footer are aligned with the website's wording - runtime-checked
  contracts (verification export marked experimental), no unverifiable stats
  or performance claims, canonical cross-links, and explicit server-side
  execution transparency (AUDIT section 20). The landing footer also carries
  the website's social row (`.footer-social`, copied from xiom-website; keep
  the order, URLs and the Discord "open invite" wording in sync), and the
  landing header uses the website's page banner (`.page-banner`, artwork
  `img/playground.webp`, wordmark XIOM / PLAYGROUND; the hero logo was
  removed as redundant and the hero title is an h2 under the banner's h1).
  Per the website guidance the banner stays identity-only (wordmark, section,
  accent); the primary actions live in a centered CTA row in the hero below
  it, stacking full-width on phones, followed by the transparency line and
  progress actions.
- Compiler-lane repro pack: `docs/COMPILER_REPROS.md` plus
  `tools/bench-cold-compile.js` (cache-clearing cold benchmark with
  same-machine `--compare`); reference medians for v0.60.1 and the R55
  preview are in the doc.
- Toolchain verification (2026-09-19): a local v0.61.0 build (`16a89615`,
  compiler R47) was verified with a full sweep and an execution audit. 68
  expected outputs were corrected; C17 dropped from 31 to 27 blocked lessons
  (4 fixed); 26 lessons still lack deterministic output (19 nondeterministic,
  7 invalid UTF-8) and L5-21 still prints Float64 bit patterns. The refreshed
  data is parked on branch `verify/toolchain-v0.61.0-data` until ops
  publishes v0.61.0; the pin stays v0.60.1 (AUDIT.md section 16).
- History rewrite: all commits/tags now `Lefteris Notas
  <lefterisnotas@gmail.com>`; backup bundle at
  `C:\Users\lefte\AppData\Local\Temp\kilo\playground-backup-20260918.bundle`.
  If `/opt/xiom/playground` on the VPS was not re-cloned after the rewrite,
  pulls there will fail until it is (ops session).

## 3. Next work (ROADMAP.md)

Phase A (A3, A4, A6) and Phase B (B1-B4) are complete. Remaining:

Phase C: C1 (read-only registry browser) is implemented in `js/registry.js` -
the Packages panel browses `/index.json`, searches `/search?q=`, expands
version metadata from `/packages/:name`, and has loading/empty/unreachable
states. C4 conformance is recorded (playground tokens already match the
registry/website palette). C2 is done and verified on the VPS: GitHub sign-in,
sign-out, re-sign-in, and cross-device progress sync (Option B, host-side auth
helper; the container keeps zero egress and never holds the client secret).
C3 waits on the first published packages. `syncProgress()` is live when signed
in and a no-op otherwise; `docs/PROGRESS_SYNC.md` records that the registry
offers no user-scoped APIs.

Production incident fixed 2026-09-19: every program run failed with
`cannot run '/tmp/xiom_run/...': Permission denied`. The `/tmp` tmpfs was
mounted `noexec` (Docker's default), so the compiler could write but not
execute its scripts. Compose now mounts `/tmp` with `exec` (still ephemeral,
all other sandbox flags unchanged); see DEPLOY.md.

Second container-only issue found while measuring run time: the toolchain's
script cache needs a writable `HOME`, and the read-only rootfs makes
`/home/xiomp` unwritable, so every run recompiled (~6s even for an unchanged
program). Compose now sets `HOME=/tmp/xiom-home` on the tmpfs; repeat runs of
an unchanged program are cache hits (milliseconds), edited programs still pay
the cold compile (~3.5s dev box, ~6s VPS). Compiler-side follow-up (session
C3): honor `--opt-level` in script mode and/or make the cache independent of
`HOME` to cheapen cold compiles.

Compile speed: repeat runs of an unchanged program are cache hits
(~6-12ms); edited programs pay one cold compile (3.5s dev box, ~6s VPS).
A lesson-template warmup was tried and removed (warming requires
`xiom run`, which executes incomplete templates); the compiler ask is a
compile-only cache-prime mode. Cold-compile levers remain compiler-side
(script-run `--opt-level`, fmt peek) - AUDIT sections 18/19.

Cross-repo (compiler session): C1 `--version`, C2 `xiom fmt`, C3 script-mode
flags, C5/C17 codegen bugs (the 31 blocked lessons), C6 stdlib `package.xi`,
C8 WASM release asset, C18 `Str` data through containers printing
nondeterministic pointer values (28 lessons cannot carry an expected output),
C19 `.to_str()` on `Str`/`Float64` returning empty or bit-pattern values.
The VPS owner will test Phase B after the next hourly pull.

### Absorbing compiler fixes (C17/C18/C19)

v0.61.1 absorbed (2026-09-22): `TOOLCHAIN_VERSION` is v0.61.1 (mirror
checksum matches the GitHub release digest), and the full lesson set is on
main - 410/410 deterministic expected outputs, empty skip list, empty
`js/limitations.json`, empty baseline. Audit on the mirrored artifact:
410/410 type-check + run, zero failures. Only follow-up: ops must refresh
`dl.xiom-lang.org/latest.json` (still v0.60.1) so the VPS deploy upgrades its
container toolchain. Details in AUDIT.md section 25.

When a fix reaches a toolchain release:

0. Pre-release verification on a local build:
   `node tools/generate-expected-outputs.js --wsl --wsl-toolchain <root>`
   then run the audit on the Linux side (section 5). Clear `/tmp/xiom_run`
   and `~/.xiom` first: the script cache is keyed by source content only, so
   an older build's binaries are silently reused otherwise (observed during
   the v0.61.0 verification).
1. Bump `TOOLCHAIN_VERSION` and refetch with `tools/fetch-toolchain.ps1`
   (Windows) or `tools/fetch-toolchain.sh` (Linux/CI).
2. `node tools/generate-expected-outputs.js --wsl` re-executes every solution
   and rewrites `expected_output` plus `tools/expected-output-skips.json`:
   newly deterministic lessons lose their skip entry, C17-fixed lessons join
   the runnable set.
3. On Linux, `node tools/lesson-audit.js --update-baseline
   tools/lesson-baseline.json` refreshes the known-failure lists, then
   `node tools/generate-limitations.js` regenerates the lesson badges.
4. Run the gate in section 8 and commit the refreshed data together with the
   toolchain bump.

Never hand-edit the generated files. Until step 2 runs, the nightly execution
job reports expected-output mismatches for lessons whose output the fix
changed; that is the intended drift signal.

v0.61.0 (R47) status: verified on a local build of `16a89615`; 68 outputs
corrected and C17 down from 31 to 27 blocked lessons (4 fixed). The release
is not published on dl.xiom-lang.org yet, so the refreshed data is parked on
`verify/toolchain-v0.61.0-data`; details in AUDIT.md section 16.

## 4. Architecture map

- `server.js`: zero-dep HTTP server; endpoints `/api/compile`, `/api/check`,
  `/api/ir`, `/api/tokens`, `/api/format`, `/api/lessons`, `/api/version`,
  `/api/health`; safe static serving from the repo dir.
- `lib/run-xiom.js`: shared spawn with timeout + process-tree kill.
- `js/`: `app.js` (shell, version footer, theme, continue card), `history.js`
  (run history, export/import, sync adapter), `editor.js` (Monaco, mobile
  read-only view), `completions.js`, `compiler.js` (WASM preview + server
  authority + expected-output match), `lessons.js` (catalog, narrative,
  limitations, rings), `stdlib-ref.js` (tiered panel), `wasm-loader.js`,
  `compiler-ref.js`, `syntax.js`.
- `tools/`: `lesson-audit.js`, `generate-expected-outputs.js`,
  `expected-output-skips.json`, `migrate-lessons.js`, `lesson-patches.js`,
  `generate-stdlib-ref.js`, `generate-limitations.js`, `fetch-toolchain.*`,
  `test-server.js`, `lib/toolchain.js`, `lib/output.js`.
- Data: `js/stdlib-ref.json`, `js/limitations.json`,
  `tools/lesson-baseline.json`, `tools/expected-output-skips.json`,
  `TOOLCHAIN_VERSION`, `WASM_VERSION`.
- Docs: `docs/PROGRESS_SYNC.md` (registry progress API contract).

## 5. Commands

```powershell
# Dev toolchain is already in .toolchain/ (Windows). Program execution must
# run on Linux; the expected-output sweep drives WSL Ubuntu itself:
node tools/generate-expected-outputs.js --wsl
# (toolchain persists at /home/lefteris/xiom_audit/tc; Node is NOT installed
#  in WSL, so the tool runs a python3 worker there)

node server.js                         # local server (set XIOM_BIN/XIOM_STDLIB if needed)
node tools/test-server.js              # 32 smoke checks (incl. mocked C2 auth)
node tools/lesson-audit.js --check-only --baseline tools/lesson-baseline.json
node tools/lesson-audit.js             # + execute solutions (Linux; Windows clang hangs at -O2)
node tools/generate-expected-outputs.js --check
node tools/generate-stdlib-ref.js --check
node tools/generate-limitations.js --check
node tools/migrate-lessons.js          # dry run; --apply to write
```

Linux-side audit with a specific toolchain (Node 22 lives in the WSL home;
section 6 lists the helper env):

```powershell
wsl -d Ubuntu -- bash -lc "source /home/lefteris/xiom_fix/env.sh && cd /mnt/e/xiom-lang/playground && node tools/lesson-audit.js --baseline tools/lesson-baseline.json --json /tmp/audit.json"
```

## 6. Environment facts and gotchas

- Windows dev box; Docker Desktop engine is not running (no local image build).
- Windows clang hangs optimizing the C runtime at default `-O2`, so program
  execution must be verified in WSL/Linux; `tools/test-server.js` skips
  execution tests on Windows unless `XIOM_TEST_RUN_WINDOWS=1`.
- `%TEMP%\kilo` holds the audit scratch work (probe scripts, wsl sweep
  wrappers, backup bundle); treat as ephemeral.
- Browser cache: server sends `no-cache` for JS/CSS/HTML now; wasm/images are
  cached a day. Hard-reload if an old script lingers.
- `editor.action.insertSnippet` does not exist in Monaco 0.52; use
  `executeEdits` + `setSelection` (as `insertStdlibSnippet` does).
- `.kilo/` worktrees are dev state: never edit them. One stale worktree
  (`subsequent-velvet`) still points at the pre-rewrite commit.
- Keep the container sandbox intact (non-root, read-only rootfs, tmpfs,
  cap_drop, limits, egress guard).
- Compiler script cache: `xiom run` reuses binaries under `/tmp/xiom_run`
  (plus `~/.xiom`) keyed by source content only. After switching compiler
  builds, clear both or the old build's binaries are served silently
  (observed when v0.61.0 first reproduced v0.60.1 behavior). Sweep/audit
  runs must clear the cache first.
- WSL: Node 22.23.2 is installed without sudo at
  `/home/lefteris/node-v22.23.2-linux-x64`; `/home/lefteris/xiom_fix/env.sh`
  exports PATH plus `XIOM_BIN`/`XIOM_STDLIB` for the local v0.61.0 build at
  `/home/lefteris/xiom_fix/tc`. The pinned v0.60.1 toolchain remains at
  `/home/lefteris/xiom_audit/tc`.

## 7. Conventions

- Commits: conventional messages, repo-local identity
  `Lefteris Notas <lefterisnotas@gmail.com>` (already configured; verify with
  `git log -1 --format='%an <%ae>'` before pushing).
- Frontend JS is ES5-style, no bundler, no dependencies; tools are
  zero-dependency Node (>=18); docs stay ASCII.
- Per tranche: implement, verify, update `ROADMAP.md`/`AUDIT.md` statuses,
  commit, push to `origin/main` (normal push, never force).
- Generated data is never hand-edited: regenerate and run the `--check` gates.

## 8. Verification gate before commit

1. `node --check` on every JS file (server, lib, tools, js).
2. `node tools/test-server.js` (expect 18 passed, 1 Windows skip).
3. `node tools/generate-stdlib-ref.js --check`,
   `node tools/generate-limitations.js --check` and
   `node tools/generate-expected-outputs.js --check`.
4. `node tools/lesson-audit.js --check-only --baseline
   tools/lesson-baseline.json` (expect "No regressions against baseline").
5. `git status --porcelain` empty after staging; identity correct.
