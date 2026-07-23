# XIOM Playground v0.49.9

Browser-based XIOM code editor and compiler. Write `.xi` code, compile to LLVM IR, see diagnostics — all in your browser.

## Quick Start

```bash
cd xiom-playground
python server.py
# Open http://localhost:3000
```

The playground uses the WASM compiler (`xiom.wasm`) for in-browser compilation. The Python server provides a dev-mode compile API that falls back to the native `xiom` binary if installed.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main playground UI — code editor, compile button, output panel |
| `server.py` | Dev server with `/api/compile` endpoint |
| `xiom.wasm` | WASM compiler (lex→parse→check→codegen) |
| `xiom_v0.49.9.wasm` | Versioned snapshot |

## Production

For production deployment at `playground.xiom-lang.org`, serve the static files with any HTTP server. The WASM compiler handles compilation entirely in the browser — no backend needed.

```bash
# Production deploy (any static server)
python -m http.server 8080
# or
npx serve .
```

## Features

- Syntax-highlighted code editor
- Real-time compilation via WASM
- LLVM IR output display
- Error diagnostics with line numbers
- Example programs (Hello World, Fibonacci, Structs)
- Ctrl+Enter to compile

## Requirements

- Modern browser with WebAssembly support (Chrome, Firefox, Safari, Edge)
- Python 3 for dev server (optional — any static server works)
