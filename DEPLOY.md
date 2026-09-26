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

`WARMUP_LESSONS` was tried and removed: warming the script cache requires
running `xiom run`, which executes incomplete lesson templates, so the
playground does not do it. A compile-only cache-prime mode is on the compiler
ask list (AUDIT section 18).

Egress is blocked by
`scripts/playground-egress-guard.sh` from `xiom-lang/ops`, which inserts
an idempotent `DOCKER-USER` rule dropping container-initiated NEW
connections. The guard runs from the deploy script and from cron at boot
(an internal Docker network cannot publish a port on Docker 28.x, which is
why the guard exists).

User programs therefore cannot write outside `/tmp` and `/data`, grow
without bound, or reach the network. Keep all of these when editing. The
health check uses `/api/health`, which is answered even while compiles are
queued.

### Landlock wrapper (P1, implemented 2026-09-25)

Every compiler child -- the driver, clang, the linker, the produced program
and anything they spawn -- runs through `sandbox/xiom-sandbox`, a small
Landlock helper built into the image (`Dockerfile` compiles it with clang;
the build fails if it does not compile). The policy is deny-by-default:

- read-write: `/tmp` only (work dirs, script cache, `HOME=/tmp/xiom-home`);
- read+execute: `/usr`, `/bin`, `/sbin`, `/lib`, `/lib64`, `/app`,
  `/toolchain`; read: `/etc/ld.so.cache`, `/dev/zero`, `/dev/urandom`;
  read-write: `/dev/null`;
- denied: `/data`, `/proc`, `/sys`, the rest of `/etc` and `/dev`, and
  every other path; TCP `connect`/`bind` are denied too (Landlock ABI 4,
  kernel 6.7+; the VPS is 6.8 and ops verified the denials in the live
  container).

Modes, from `XIOM_SANDBOX` (set to `require` in `docker-compose.yml`):

- `require` -- fail closed. The server probes the wrapper (`--probe`) and
  runs an end-to-end `xiom --version` canary at startup; when either fails,
  `/api/compile`, `/api/check`, `/api/ir`, `/api/tokens` and `/api/format`
  refuse to execute and say why.
- `auto` -- default for local dev/CI: sandbox when the canary works,
  otherwise run with a startup warning.
- `off` -- the rollback switch (`XIOM_SANDBOX=off` + redeploy). The env
  whitelist and secret rotation stay in force.

`/api/health` reports `sandbox: {mode, active, landlock, error}`; ops reads
it after deploys. The denial suite is `tools/verify-sandbox.js` (control,
`/tmp` read-write, escape read/write, `/proc`, `/etc`, spawned shell, TCP,
warm-run timing); CI runs it on every push and the nightly job executes all
410 lessons under the wrapper. The env whitelist from P0
(`server.js`, `userChildEnv()`) remains defense in depth.

In-container isolation limits before P1 (audited 2026-09-25, AUDIT section
28): the server and every submitted program share one uid, so a program
could read or overwrite other accounts' progress documents on `/data`, and
same-uid process inspection could reach the server's environment (the
compose `env_file` secrets). P1 closes both through the kernel policy; the
environment whitelist and the rotated secrets remain in force, and P2
(host-side sessions/progress) is the next layer if the owner wants it.
Until the P1 image is deployed and verified on the VPS, treat `/data` and
the server environment as reachable from submissions.

### Abuse controls (P3, implemented 2026-09-25)

The five compiler endpoints (`/api/compile`, `/api/check`, `/api/ir`,
`/api/tokens`, `/api/format`) are rate limited per client IP with a token
bucket: burst 10, refill one token every 4 s (`RATE_LIMIT_BURST`,
`RATE_LIMIT_REFILL_MS`; `RATE_LIMIT_BURST=0` disables). Over the limit they
return 429 with `Retry-After` and a compile-shaped body so the UI explains
the wait. The client IP is read from `X-Forwarded-For` only when the peer
is private/loopback (the TLS proxy or the host); P1 also prevents submitted
code from reaching the server port. `/api/health` exposes
`counters: {compile, check, ir, tokens, format, rateLimited}` and
`rateLimit: {burst, refillMs, buckets}` so the uptime check can alert on
sustained queue saturation or a rejection spike.

External monitoring field: `/api/health` carries a single keyword-friendly
field, `"abuse":"ok"` or `"abuse":"saturated"` (ops runs an UptimeRobot
keyword monitor on the literal `"abuse":"ok"`; local cron mail is rejected
by SPF, so alerts come from external infrastructure). `saturated` means the
compile queue has been continuously busy for `ABUSE_BUSY_MS` (default
180000) or the rate limiter rejected `ABUSE_REJECTIONS` requests within
`ABUSE_WINDOW_MS` (default 50 within 300000). Both knobs plus
`RATE_LIMIT_BURST`/`RATE_LIMIT_REFILL_MS` can be tuned in the compose
environment; the raw counters stay in the payload for diagnosis.

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

### State modes (P2, client implemented 2026-09-25)

`PLAYGROUND_STATE` selects where sessions and progress live:

- unset or `local` (current) -- sessions are stateless HMAC cookies signed
  with `SESSION_SECRET`; progress documents live on the `playground-data`
  volume at `/data`. The helper only performs the OAuth code exchange.
- `helper` -- the helper mints an opaque session token on `/exchange` and
  owns `GET /session`, `POST /session/logout`, `GET/PUT/DELETE /progress`
  backed by `/opt/xiom/playground-state/` (see
  `docs/P2_STATE_HELPER_DESIGN.md`). The container then needs no
  `SESSION_SECRET` and hides no multi-tenant data; cookie verification is a
  cached helper lookup (positive 60 s, negative 10 s; `SESSION_CACHE_MS`)
  and the OAuth state is signed with a key generated at startup.

Cutover to `helper`: follow `docs/P2_CUTOVER_RUNBOOK.md` (paste-ready:
backup, seed `/opt/xiom/playground-state`, install and verify the helper
endpoints, rotate `AUTH_HELPER_KEY`, add `PLAYGROUND_STATE=helper` to
`/opt/xiom/playground.env` and recreate the container, verify, then the
phase-2 compose cleanup). Summary: snapshot `/data`, copy
`/data/accounts/*.json` to `/opt/xiom/playground-state/accounts/`, confirm
the helper endpoints live, then flip the mode; users sign in once. Verify
sign-in, `/api/me`, a progress round-trip with a 409 conflict,
`DELETE /api/me`, a forged cookie (401), the startup log line
`State: helper sessions/progress (...)`, and `docker inspect` showing no
`SESSION_SECRET`. Rollback: restore the pre-P2 env copy and recreate; the
host store is additive and can be copied back to the volume.

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
- Backups: the helper/playground env files and the `playground-data` volume
  (`/var/lib/docker/volumes/playground_playground-data/_data`, confirmed as
  `playground_playground-data`) are in the nightly restic set as of ops commit
  `80933b2`, and the restore procedure is documented in the ops
  `docs/VPS_BACKUP_MONITORING.md` (B5a). The restic job is prepared but not
  yet scheduled - Backblaze B2 credentials and `/etc/xiom-backup.env` are
  owner actions still pending - so the website privacy page keeps the interim
  wording ("nightly backups with 30-day / 12-month retention", future tense)
  until ops confirms the first snapshot and a restore drill; then it becomes
  "nightly backups age out after 30 days, with 12 monthly snapshots kept".
  Restic retention is 30 daily / 12 monthly with a nightly prune and a 5%
  read-data check on Sundays.
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

Toolchain selection is repo-pinned as of 2026-09-25 (option C landed):
`playground-deploy.sh` reads `TOOLCHAIN_VERSION` from the playground
checkout (`$WORK` after the `git reset --hard`) and installs
`releases/$PIN/xiom-${PIN#v}-linux-x64.tar.gz` from the mirror, recording
the tag in `/opt/xiom/toolchain/.mirror-tag` (which `/api/version` reads).
`latest.json` is consulted only as a fallback, and a missing pinned archive
fails the deploy instead of silently serving a different compiler. The
mirror deploy (`dl-deploy.sh`) now selects the newest release by
`published_at` instead of GitHub's frozen `releases/latest` flag; the index
advertises v0.61.3 and the drift workflow reports `relation=same` (verified
2026-09-26). The VPS runs v0.61.3 (`/api/version` confirms toolchain and
stdlib 0.61.3, `capabilities.format: true`). A release is adopted by one
reviewed pin-bump commit; the exact request and history are in `SESSION.md`
section 3.

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
