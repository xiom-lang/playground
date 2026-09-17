# Playground -- Deployment Guide

The playground is **not a static site**. `js/compiler.js` compiles and runs
programs through `server.js` (`/api/compile`, `/api/check`, `/api/ir`,
`/api/tokens`, `/api/format`, `/api/lessons`), and the in-browser WASM
compiler only covers pure programs. Because the server executes
user-submitted code, the container is the security boundary.

## Runtime architecture

- `server.js`: zero dependencies, Node `http`, listens on
  `HOST:PORT` (defaults 127.0.0.1:3000; production sets 0.0.0.0:3000
  inside the container).
- It spawns the real compiler via `XIOM_BIN` with `XIOM_STDLIB` pointing at
  the toolchain's `lib/`; `clang` is installed in the image for linking.
- Production container: `xiom-playground` from `docker-compose.yml`, bound to
  `127.0.0.1:3300` on the host (Gitea owns 3000). Hestia nginx terminates
  TLS for `playground.xiom-lang.org` and proxies to that port.

## Sandbox (do not weaken)

`docker-compose.yml` runs the server with: non-root user, read-only root
filesystem, `tmpfs` for `/tmp`, `cap_drop: ALL`,
`no-new-privileges:true`, and memory and pid limits. Egress is blocked by
`scripts/playground-egress-guard.sh` from `xiom-lang/.github`, which inserts
an idempotent `DOCKER-USER` rule dropping container-initiated NEW
connections. The guard runs from the deploy script and from cron at boot
(an internal Docker network cannot publish a port on Docker 28.x, which is
why the guard exists).

User programs therefore cannot write outside `/tmp`, grow without bound, or
reach the network. Keep all of these when editing.

## Deploy / update

On the VPS: `/opt/xiom/bin/playground-deploy.sh` (from `xiom-lang/.github`,
`scripts/playground-deploy.sh`) fetches this repository into
`/opt/xiom/playground`, extracts the released Linux toolchain into
`/opt/xiom/toolchain` on first run, then `docker compose up -d --build`.
It runs hourly from `/etc/cron.d/xiom-deploy` (minute 29).

Hestia template: `xiom-playground` (nginx-only host, templates live in
`/usr/local/hestia/data/templates/web/nginx/php-fpm/`) proxying the domain
to `127.0.0.1:3300`:

```
v-change-web-domain-tpl lefteris playground.xiom-lang.org xiom-playground
v-rebuild-web-domain lefteris playground.xiom-lang.org
nginx -t
```

## Verification

```
docker compose -f /opt/xiom/playground/docker-compose.yml ps
curl -s http://127.0.0.1:3300/api/lessons | head -c 200
curl -sI https://playground.xiom-lang.org/ | head -5
curl -s https://playground.xiom-lang.org/api/lessons | head -c 200
```

Then open the page and run a sample lesson; the Output tab must show real
program output. If it shows "Server not running.", the container or the
proxy is down.

## Updating the WASM module

The in-browser compiler comes from the compiler repository
(`crates/xiom-wasm`). Replacing `xiom_wasm_bg.wasm` plus its `.js` glue and
committing is the update path until the release pipeline ships it.

## Rules

- Pure ASCII files only.
- Never publish `tools/`, dev servers, or editor state; the runtime image
  copies the whole repository but serves only what `server.js` exposes.
- `.kilo/` worktrees are development state; never edit files there.
