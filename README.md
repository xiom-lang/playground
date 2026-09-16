<!-- Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
     SPDX-License-Identifier: MIT OR Apache-2.0 -->
# XIOM Playground v0.58.0

Browser-based XIOM code editor and compiler. Write `.xi` code, compile to LLVM IR, see diagnostics -- all in your browser.

## Quick Start

```bash
cd xiom-playground

# Node.js (recommended)
node server.js
# Open http://localhost:3000

# Python (alternative)
python server.py
# Open http://localhost:3000
```

## Features

- **Code editor** with line/column counter
- **Multi-tab output**: Output, LLVM IR (syntax-highlighted), Diagnostics
- **6 example programs**: Hello World, Fibonacci, Structs, Contracts, Option/if let, Vec/for
- **Ctrl+Enter** to compile
- **In-browser WASM compiler (v0.58.0)**: diagnostics + LLVM IR compile instantly in the browser (offline-capable for pure programs); the server still runs the program for the Output tab
- **Server-side compilation** via local `xiom` binary (fallback + program execution)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Playground UI -- editor, tabs, IR highlighting |
| `server.js` | Node.js dev server + `/api/compile` endpoint |
| `server.py` | Python dev server (alternative) |
| `js/wasm-loader.js` | Loads the in-browser WASM compiler (promise; falls back to server) |
| `xiom_wasm.js` + `xiom_wasm_bg.wasm` | WASM compiler for browser (v0.58.0, wasm-bindgen web target) |
| `xiom.wasm` / `xiom_v0.49.9.wasm` | Legacy WASM snapshots (v0.49.9 era) |
| `xiom_v0.49.9.wasm` | Versioned snapshot |

## Building the WASM compiler

```bash
# from the repo root
cargo build -p xiom-wasm --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir xiom-playground target/wasm32-unknown-unknown/release/xiom_wasm.wasm
```

Note: the in-browser compiler has no stdlib (no `use xiom.*` imports) -- it covers
pure language programs (functions, structs, enums, generics, contracts, Vec,
Option/Result builtins). Stdlib programs still work via the server endpoints.

## Production

For `playground.xiom-lang.org`, serve the static files with any HTTP server. The WASM compiler handles compilation in-browser.

## Requirements

- Node.js 18+ (or Python 3) for dev server
- Modern browser (Chrome, Firefox, Safari, Edge)
- `xiom` binary installed for server-side compilation
