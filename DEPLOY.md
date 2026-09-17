# Playground -- Deployment Guide

Read this before changing deployment. The playground is a static site with a
prebuilt WASM module; there is no build step on the server.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `css/`, `js/`, `lessons/` | the site |
| `xiom_wasm.js`, `xiom_wasm_bg.wasm`, `xiom_wasm.d.ts` | checked-in WASM compiler |
| `server.js`, `server.py` | local development servers only - never published |
| `tools/` | lesson/syntax validation scripts - never published |

## How deploys work

- `/opt/xiom/bin/playground-deploy.sh` (from `xiom-lang/.github`,
  `scripts/playground-deploy.sh`) fetches this repository into
  `/opt/xiom/playground` and publishes the static tree to
  `/home/lefteris/web/playground.xiom-lang.org/public_html`.
- It runs hourly from `/etc/cron.d/xiom-deploy` (minute 29). Pushing to
  `main` goes live within the hour; run the script on the VPS for an
  immediate publish.
- The script deletes development-only paths from the docroot
  (`.git`, `.kilo`, `tools`, `server.js`, `server.py`, `README.md`,
  `DEPLOY.md`, workspace files).

## Verifying

```
curl -sI https://playground.xiom-lang.org/ | head -3
curl -s https://playground.xiom-lang.org/ | head -c 200
```

Then open the page and run a sample lesson. If the page loads but the
compiler fails, check the browser console for `SharedArrayBuffer` or COOP/COEP
errors - the vhost then needs these response headers:

```
add_header Cross-Origin-Opener-Policy same-origin;
add_header Cross-Origin-Embedder-Policy require-corp;
```

They are added through a custom Hestia web template on the VPS (this host is
nginx-only; templates live in
`/usr/local/hestia/data/templates/web/nginx/php-fpm/`).

## Updating the WASM module

The WASM build comes from the compiler repository (`crates/xiom-wasm`).
Wiring it to releases (so the playground tracks each compiler release) is a
planned follow-up; until then, replacing `xiom_wasm_bg.wasm` plus its `.js`
glue and committing is the update path.

## Rules

- Pure ASCII files only.
- Do not publish `tools/`, dev servers, or editor state; the deploy script
  strips them, but keep new files out of the published set where possible.
- The repo may contain a `.kilo/` worktree copy; it is gitignored and
  stripped during deploy - never edit files there.
