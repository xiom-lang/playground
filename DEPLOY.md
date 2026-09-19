# Playground -- Deployment Guide

The playground is **not a static site**. `js/compiler.js` compiles and runs
programs through `server.js` (`/api/compile`, `/api/check`, `/api/ir`,
`/api/tokens`, `/api/format`, `/api/lessons`, `/api/version`, `/api/health`),
and the in-browser WASM compiler only covers pure programs. Because the server
executes user-submitted code, the container is the security boundary.

## Runtime architecture

- `server.js`: zero dependencies, Node `http`, listens on `HOST:PORT`
  (defaults 127.0.0.1:3000; production sets 0.0.0.0:3000 inside the
  container). It spawns the real compiler via `XIOM_BIN` with `XIOM_STDLIB`
  pointing at the toolchain's `lib/`; `clang` is installed in the image for
  linking.
- Every submission gets its own work directory under
  `<tmp>/xiom_pg_work/`, which is created and deleted per request. This is
  deliberate: the compiler indexes the source file's parent directory as a
  module catalog root, so writing submissions into the temp root would make
  every compile walk the whole temp tree.
- Compiles and checks run through bounded async queues (`MAX_COMPILES`,
  default 1; `MAX_CHECKS`, default 2). A running compile never blocks static
  files or `/api/health`. Timeouts kill the whole child process tree
  (`XIOM_COMPILE_TIMEOUT_MS`, default 30000; `XIOM_CHECK_TIMEOUT_MS`, default
  15000).
- `/api/version` reports the app, toolchain, stdlib, and WASM versions. The
  toolchain tag is read from `XIOM_TOOLCHAIN_VERSION`, then
  `/toolchain/.mirror-tag`, then `TOOLCHAIN_VERSION`.
- Production container: `xiom-playground` from `docker-compose.yml`, bound to
  `127.0.0.1:3300` on the host (Gitea owns 3000). Hestia nginx terminates
  TLS for `playground.xiom-lang.org` and proxies to that port.

## Sandbox (do not weaken)

`docker-compose.yml` runs the server with: non-root user, read-only root
filesystem, `tmpfs` for `/tmp`, `cap_drop: ALL`,
`no-new-privileges:true`, and memory and pid limits. The `/tmp` tmpfs is
mounted with `exec` on purpose: the toolchain writes compiled scripts under
`TMPDIR` and executes them, and Docker mounts tmpfs `noexec` by default.
Without `exec` every program run fails with
`cannot run '/tmp/xiom_run/...': Permission denied` (production incident
2026-09-19). Everything under `/tmp` is still ephemeral.

The container also sets `HOME=/tmp/xiom-home` on purpose: the toolchain's
script cache needs a writable `HOME`, and the read-only rootfs makes
`/home/xiomp` unwritable. With an unwritable `HOME` the cache is never
reused and every run recompiles (~3-6s per run on the VPS); with it, repeat
runs of an unchanged program finish in milliseconds. Both details are
container-only and invisible to CI, which runs on a normal filesystem.

`WARMUP_LESSONS` (compose sets 12) makes the first-run experience fast: after
container (re)creation the server compiles the first N lesson templates in
the background through the normal compile queue, yielding whenever user work
is pending, so the first Run in those lessons is a cache hit (milliseconds)
instead of a cold compile. Warmup progress appears as `warmup:` lines in
`docker compose logs`. Edited programs still pay one cold compile each
because the toolchain caches by source content.

Egress is blocked by
`scripts/playground-egress-guard.sh` from `xiom-lang/ops`, which inserts
an idempotent `DOCKER-USER` rule dropping container-initiated NEW
connections. The guard runs from the deploy script and from cron at boot
(an internal Docker network cannot publish a port on Docker 28.x, which is
why the guard exists).

User programs therefore cannot write outside `/tmp`, grow without bound, or
reach the network. Keep all of these when editing. The health check uses
`/api/health`, which is answered even while compiles are queued.

## Accounts (C2, implemented 2026-09-19; VPS env pending)

Sign-in is optional; the playground works fully without an account. GitHub
OAuth is playground-owned and the registry is not involved. Because the
container has no egress and executes user programs, the GitHub token exchange
runs on a small host-side helper, not in the container:

- Host helper (ops): `/opt/xiom/playground-auth`, systemd unit
  `xiom-playground-auth.service`, bound to the Docker gateway on port 3400
  (never public). `GET /health`; `POST /exchange {code, redirect_uri}` with
  header `X-Auth-Helper-Key` calls GitHub, discards the token, and returns
  `{"ok":true,"user":{"id","login","avatar_url"}}`. Installed and running.
- Helper config: `/etc/xiom/playground-auth.env` (root, 0600) holds
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_HELPER_KEY`, and
  `ALLOWED_REDIRECT_URI=https://playground.xiom-lang.org/auth/github/callback`.
- Playground config: `/opt/xiom/playground.env` (root, 0600, outside the repo
  so the hourly `git reset --hard` and the Docker build context never touch
  it) holds `GITHUB_CLIENT_ID`, `AUTH_HELPER_URL=http://host.docker.internal:3400`,
  `AUTH_HELPER_KEY` (the same value as the helper), `SESSION_SECRET`
  (`openssl rand -hex 32`), and `PLAYGROUND_DATA_DIR=/data`.
  Compose reads it through an absolute `env_file` with `required: false`, so
  the feature stays inert when the file is absent (Compose v2.24+; the VPS
  runs Docker 28.x). `extra_hosts: host.docker.internal:host-gateway` lets the
  container reach the helper.
- Progress storage: named volume `playground-data` mounted at `/data` (the
  image creates `/data` owned by uid 10001); one JSON document per account,
  written atomically. No database. Sessions are stateless HMAC cookies, so
  logout is a cookie clear; account deletion removes the stored document.
- Endpoints: `GET /api/auth/config`, `GET /auth/github`,
  `GET /auth/github/callback`, `POST /auth/logout`, `GET /api/me` +
  `DELETE /api/me`, `GET/PUT /api/progress` (revision-checked, 409 on
  conflict). State-changing requests require a same-origin Origin header when
  present; the OAuth endpoints are rate limited per IP.
- Egress stays blocked. Container to host-bridge traffic is locally destined
  and normally bypasses DOCKER-USER; if it is blocked on the VPS, add one
  narrow accept rule (playground subnet to the gateway, tcp/3400) above the
  DROP. Do not open GitHub egress.

With no env configured the sign-in UI stays hidden and every existing route
behaves as before.

### User data and privacy facts (mirrored by xiom-lang.org/privacy.html)

Keep this list and the website's privacy page in sync; tell the website
session whenever one of these changes.

- Server-side processing: `/api/check`, `/api/compile`, `/api/ir`,
  `/api/tokens`, and `/api/format` receive submitted source. Programs are
  compiled and executed inside the sandboxed container (non-root, read-only
  rootfs, `cap_drop: ALL`, `no-new-privileges`, memory/pid limits, no network
  egress, tmpfs `/tmp`).
- Retention of submissions: each request gets a work directory under
  `/tmp/xiom_pg_work/` that is deleted when the request finishes. The
  toolchain's script cache in `/tmp/xiom_run/` holds compiled binaries plus
  one source copy per unique program until the container restarts (ephemeral
  tmpfs). Nothing is persisted to disk or logs.
- Accounts (optional): GitHub OAuth with `read:user` scope; the playground
  stores the numeric id, username, and avatar URL. The GitHub access token is
  discarded by the host-side helper after the profile fetch.
- Stored progress: one JSON document per account on the `playground-data`
  volume (`/data`) containing completed lesson ids, run timestamps,
  pass/fail, durations, and program output truncated to 400 characters. No
  source code, no free-play code, no personal profile data beyond the GitHub
  identity.
- Backups: the helper/playground env files are in the nightly restic set;
  the `playground-data` volume is **not** backed up today (ask ops to add
  `/var/lib/docker/volumes/playground_playground-data/_data` to
  `scripts/restic-backup.sh`). Restic retention overall is 30 daily / 12
  monthly snapshots with a nightly prune; a 5% read-data check runs
  Sundays.
- Cookies: a single HttpOnly, SameSite=Lax session cookie (Secure on https)
  with a 30-day lifetime; sign-out clears it.
- Deletion: `DELETE /api/me` removes the stored progress document and clears
  the cookie; export/import stays local to the browser.

## Deploy / update

On the VPS: `/opt/xiom/bin/playground-deploy.sh` (from `xiom-lang/ops`,
`scripts/playground-deploy.sh`) fetches this repository into
`/opt/xiom/playground`, extracts the released Linux toolchain into
`/opt/xiom/toolchain` on first run, then `docker compose up -d --build`.
It runs hourly from `/etc/cron.d/xiom-deploy` (minute 29).

Toolchain selection on the VPS follows `https://dl.xiom-lang.org/latest.json`
(the ops script records the tag in `/opt/xiom/toolchain/.mirror-tag`, which
`/api/version` reads). `TOOLCHAIN_VERSION` in this repository is the version
the lessons are verified against in CI; it is expected to track the latest
release closely but is not what the VPS installs.

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
curl -s http://127.0.0.1:3300/api/health
curl -s http://127.0.0.1:3300/api/version
curl -s http://127.0.0.1:3300/api/lessons | head -c 200
curl -sI https://playground.xiom-lang.org/ | head -5
curl -s https://playground.xiom-lang.org/api/version
```

Then open the page and run a sample lesson; the Output tab must show real
program output. If the footer shows no toolchain version, `/api/version`
failed; if Output shows "Server not running.", the container or the proxy is
down.

## Updating the WASM module

The in-browser compiler comes from the compiler repository
(`crates/xiom-wasm`). Replacing `xiom_wasm_bg.wasm` plus its `.js` glue and
updating `WASM_VERSION`, then committing, is the update path until the
release pipeline ships it as a release asset. The UI reads the version from
`/api/version`.

## Rules

- Pure ASCII files only.
- Never publish `tools/`, dev servers, or editor state; `.dockerignore`
  keeps `.git`, `.kilo`, `tools/`, `docs/`, and `.toolchain*` out of the
  runtime image, and `server.js` serves only files inside this directory
  (path traversal is rejected).
- `.kilo/` worktrees are development state; never edit files there.
