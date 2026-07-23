# XIOM Playground v0.49.9

Browser-based XIOM code editor and compiler. Write `.xi` code, compile to LLVM IR, see diagnostics — all in your browser.

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
- **Server-side compilation** via local `xiom` binary (falls back to cargo)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Playground UI — editor, tabs, IR highlighting |
| `server.js` | Node.js dev server + `/api/compile` endpoint |
| `server.py` | Python dev server (alternative) |
| `xiom.wasm` | WASM compiler for browser |
| `xiom_v0.49.9.wasm` | Versioned snapshot |

## Production

For `playground.xiom-lang.org`, serve the static files with any HTTP server. The WASM compiler handles compilation in-browser.

## Requirements

- Node.js 18+ (or Python 3) for dev server
- Modern browser (Chrome, Firefox, Safari, Edge)
- `xiom` binary installed for server-side compilation
