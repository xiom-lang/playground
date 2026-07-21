# XIOM Playground

Browser-based XIOM compiler and playground powered by WebAssembly.

## Setup

```bash
cd xiom-playground
npm install
npm start
```

Opens at `http://localhost:3000` with hot-reload.

## Prerequisites

- Node.js 18+
- Rust toolchain with `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)

## Build WASM

From the repo root:

```bash
cargo build -p xiom-wasm --target wasm32-unknown-unknown --release
copy target\wasm32-unknown-unknown\release\xiom_wasm.wasm xiom-playground\xiom.wasm
```

## Python Server (alternative)

```bash
python server.py
```

Serves the playground on port 3000 with a `/compile` API endpoint using the native `xiom` CLI.

## Directory

```
xiom-playground/
├── public/
│   └── index.html        React mount point
├── src/
│   ├── index.jsx         Entry point
│   └── App.jsx           Code editor + compile UI
├── xiom.wasm             WASM compiler binary
├── xiom_v0.49.9.wasm     Versioned WASM snapshot
├── server.py             Alternative Python compile server
├── package.json
├── .gitignore
└── README.md
```
