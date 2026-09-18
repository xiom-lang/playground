# XIOM Playground -- Session Handoff

Last updated: 2026-09-19. Branch `main`, commit `4445cac`, working tree clean,
all commits pushed to `origin/main`.

Read with `ROADMAP.md` (next work), `AUDIT.md` (findings, C1-C17), `README.md`
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
- History rewrite: all commits/tags now `Lefteris Notas
  <lefterisnotas@gmail.com>`; backup bundle at
  `C:\Users\lefte\AppData\Local\Temp\kilo\playground-backup-20260918.bundle`.
  If `/opt/xiom/playground` on the VPS was not re-cloned after the rewrite,
  pulls there will fail until it is (ops session).

## 3. Next work (ROADMAP.md)

Phase A:
- A3 expected outputs: generate `expected_output` for all lessons from a Linux
  execution sweep, show match/mismatch in the Output tab, assert it in
  `tools/lesson-audit.js` and CI. Largest remaining learning-UX item.
- A4 mobile lesson view: read-only lesson + copy-to-clipboard on narrow
  screens instead of cramped Monaco.
- A6 finish visual polish (landing hierarchy, empty/focus states, both themes).

Phase B (no backend):
- B1 local history store (IndexedDB/localStorage, capped, per-lesson runs).
- B2 history UI: per-lesson drawer, continue-where-you-left-off card,
  per-level rings.
- B3 export/import progress JSON.
- B4 `syncProgress()` adapter + `docs/PROGRESS_SYNC.md` endpoint contract for
  the registry service's future auth.

Phase C is blocked on the registry (search panel, GitHub OAuth SSO, shared
design system).

Cross-repo (compiler session): C1 `--version`, C2 `xiom fmt`, C3 script-mode
flags, C5/C17 codegen bugs (the 31 blocked lessons), C6 stdlib `package.xi`,
C8 WASM release asset.

## 4. Architecture map

- `server.js`: zero-dep HTTP server; endpoints `/api/compile`, `/api/check`,
  `/api/ir`, `/api/tokens`, `/api/format`, `/api/lessons`, `/api/version`,
  `/api/health`; safe static serving from the repo dir.
- `lib/run-xiom.js`: shared spawn with timeout + process-tree kill.
- `js/`: `app.js` (shell, version footer, theme), `editor.js` (Monaco,
  language, themes), `completions.js`, `compiler.js` (WASM preview + server
  authority), `lessons.js` (catalog, narrative, limitations), `stdlib-ref.js`
  (tiered panel), `wasm-loader.js`, `compiler-ref.js`, `syntax.js`.
- `tools/`: `lesson-audit.js`, `migrate-lessons.js`, `lesson-patches.js`,
  `generate-stdlib-ref.js`, `generate-limitations.js`, `fetch-toolchain.*`,
  `test-server.js`, `lib/toolchain.js`.
- Data: `js/stdlib-ref.json`, `js/limitations.json`,
  `tools/lesson-baseline.json`, `TOOLCHAIN_VERSION`, `WASM_VERSION`.

## 5. Commands

```powershell
# Dev toolchain is already in .toolchain/ (Windows). For Linux execution:
wsl -d Ubuntu -- bash /mnt/c/Users/lefte/AppData/Local/Temp/kilo/wsl_sweep.sh
# (toolchain persists at /home/lefteris/xiom_audit/tc; Node is NOT installed
#  in WSL, use python3 or install Node if a Node-based sweep is needed)

node server.js                         # local server (set XIOM_BIN/XIOM_STDLIB if needed)
node tools/test-server.js              # 18 smoke checks
node tools/lesson-audit.js --check-only --baseline tools/lesson-baseline.json
node tools/lesson-audit.js             # + execute solutions (Linux; Windows clang hangs at -O2)
node tools/generate-stdlib-ref.js --check
node tools/generate-limitations.js --check
node tools/migrate-lessons.js          # dry run; --apply to write
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
3. `node tools/generate-stdlib-ref.js --check` and
   `node tools/generate-limitations.js --check`.
4. `node tools/lesson-audit.js --check-only --baseline
   tools/lesson-baseline.json` (expect "No regressions against baseline").
5. `git status --porcelain` empty after staging; identity correct.
