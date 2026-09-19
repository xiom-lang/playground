<!-- Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
     SPDX-License-Identifier: MIT OR Apache-2.0 -->
# XIOM Playground

Browser-based XIOM editor and lesson platform. Programs are type-checked,
compiled, and executed by the installed XIOM toolchain through a sandboxed
Node server; a bundled WASM compiler provides instant IR and offline
diagnostics for pure (stdlib-free) programs.

Live: https://playground.xiom-lang.org

## Quick start

```bash
# 1. Fetch the pinned toolchain into .toolchain/ (verifies SHA256SUMS)
tools/fetch-toolchain.sh          # Linux/macOS/WSL/Git Bash
powershell -File tools\fetch-toolchain.ps1   # Windows PowerShell

# 2. Start the server
node server.js                    # or: npm start
# Open http://localhost:3000
```

The server resolves the compiler from `XIOM_BIN`, then `.toolchain/bin/xiom`,
then `../target/debug/xiom` (a compiler checkout), then `PATH`. The stdlib
resolves from `XIOM_STDLIB`, then `.toolchain/lib`, then `../stdlib`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/compile` | Type-check, compile, and run a program; returns output, diagnostics, contracts |
| POST | `/api/check` | Type-check only (fast, no codegen) |
| POST | `/api/ir` | LLVM IR for a program |
| POST | `/api/tokens` | Token stream for a program |
| POST | `/api/format` | Source formatting (reports unsupported when the toolchain has no `fmt`) |
| GET | `/api/lessons` | Lesson catalog |
| GET | `/api/version` | App, toolchain, stdlib, wasm versions |
| GET | `/api/health` | Liveness and queue depth (never queued) |

Request bodies are JSON and capped at 512 KB; `source` is capped at 200 KB.
Compiles and checks run through a bounded async queue, so static files and
health checks stay responsive while a submission compiles.

## Features

- Lesson browser with 410 interactive lessons across 9 levels
- Monaco editor, output tabs for Output / Diagnostics / LLVM IR / Tokens / Contracts
- Keyboard shortcut Ctrl+Enter (Cmd+Enter) to run
- In-browser WASM compiler: instant IR preview and offline diagnostics for pure programs
- Server toolchain is authoritative for diagnostics and produces real program output
- Expected-output match for reference solutions ("Output matches the expected result")
- Local run history per lesson, continue-where-you-left-off, progress export/import
- Read-only package browser for the public XIOM registry (search, versions, digests)
- Full standard library reference generated from the toolchain (516 modules / 6,522 public functions) with search
- Light/dark themes, progress tracking, responsive layout

## Versioning

| File | Meaning |
|---|---|
| `TOOLCHAIN_VERSION` | The released XIOM toolchain the lessons are verified against |
| `WASM_VERSION` | Version of the bundled `xiom_wasm_bg.wasm` |
| `package.json` `version` | Playground app version |

`tools/fetch-toolchain.*` downloads the pinned release from
`https://dl.xiom-lang.org/releases/<tag>/` and verifies the release
`SHA256SUMS`. `GET /api/version` reports all four values (app, toolchain,
stdlib, wasm) and the active capability set; the UI reads it at load.

## Validation

```bash
node tools/test-server.js                    # HTTP smoke tests (no framework)
node tools/lesson-audit.js --check-only      # compile every lesson + template
node tools/lesson-audit.js                   # also execute every passing solution
node tools/lesson-audit.js --check-only --baseline tools/lesson-baseline.json
node tools/generate-stdlib-ref.js --check    # stdlib reference matches the toolchain
node tools/generate-expected-outputs.js --check   # expected outputs are complete and current
```

`expected_output` for each lesson is generated from a Linux execution sweep by
`tools/generate-expected-outputs.js` (each solution runs twice; only
deterministic outputs are stored). Lessons whose output varies between runs are
recorded in `tools/expected-output-skips.json` and stay without the field, so
the CI assertion introduced in `tools/lesson-audit.js` cannot flake. The Output
tab compares the run result with the expected output for unmodified solutions.

`js/stdlib-ref.json` is generated from the pinned toolchain by
`tools/generate-stdlib-ref.js` (curated descriptions are preserved by
signature match) and is lazy-loaded by the reference panel. `--check` fails
CI when it drifts from the toolchain.

`tools/lesson-baseline.json` records known lesson failures so CI fails only
on regressions. All 410 solutions and templates currently type-check; the
baseline therefore contains only execution failures caused by compiler
codegen defects (see `AUDIT.md` section 10). Regenerate it with
`npm run audit:lessons:baseline`; the command is safe to re-run and preserves
the execution baseline.

CI (`.github/workflows/validate.yml`) runs JS syntax checks, the pinned
toolchain fetch, the lesson audit against the baseline, and the server smoke
tests on every push/PR; the nightly run also executes all solutions.

## WASM compiler

The in-browser compiler is built from the compiler repository
(`crates/xiom-wasm`, wasm-bindgen `web` target). Replacing
`xiom_wasm_bg.wasm`, `xiom_wasm.js`, and `xiom_wasm.d.ts` and updating
`WASM_VERSION` is the update path until the release pipeline ships a WASM
asset. It has no stdlib: pure programs only.

## Production

See `DEPLOY.md`. The container is the security boundary: the server runs
non-root on a read-only filesystem with a tmpfs `/tmp`, dropped
capabilities, memory/pid limits, and blocked egress.

## Requirements

- Node.js 18+
- A modern browser
- The pinned toolchain (`tools/fetch-toolchain.*`) for server-side compilation
