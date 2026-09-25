# Ops request: playground in-container isolation (2026-09-25)

Relay from the playground lane to `xiom-lang/ops` (the ops repository is not
edited from here by policy). Severity: high. References: playground
`AUDIT.md` section 28 (evidence and measurements),
`docs/SECURITY_HARDENING.md` (the full remediation plan), commit `162e041`
(what already landed).

## What was found

The playground container executes arbitrary submitted XIOM programs. Probes
on the pinned v0.61.3 Linux toolchain showed:

- Submitted programs inherited the server's environment, which Compose
  populates from `/opt/xiom/playground.env`; `io.env_var("SESSION_SECRET")`
  printed the secret in one line.
- The container uid (10001 `xiomp`) also owns `/data`, so a submission can
  list `/data/accounts`, read every account progress document, overwrite it
  with a forged revision, or delete it.
- User code can declare its own `extern "C"` and call libc (`system()` was
  verified) and can spawn `/bin/sh`. Even with the child environment
  stripped, same-uid process inspection reaches
  `/proc/<server-pid>/environ` (the server's exec-time environment), which
  still holds the Compose secrets.
- Egress remains blocked by the `DOCKER-USER` guard and the container stays
  a solid boundary for the host. That part is unchanged.

## What the playground lane already did

- Commit `162e041`: every compiler child gets a whitelisted environment
  (`PATH`, `HOME`, `TMPDIR`/`TEMP`, locale, `XIOM_BIN`, `XIOM_STDLIB`).
  A canary test starts the server with a variable in its environment and
  asserts a submitted program cannot read it (Linux suite 38/38).
- The sandbox flags in `docker-compose.yml` (non-root, read-only root,
  `cap_drop: ALL`, `no-new-privileges`, exec tmpfs, limits) are untouched.

## What we need from ops

1. IMMEDIATE, with the owner: rotate `SESSION_SECRET` and
   `AUTH_HELPER_KEY`, restart `xiom-playground` and
   `xiom-playground-auth.service`, after a snapshot/backup. Assume the
   values are exposed: arbitrary code with the inherited environment has
   been possible on the public site. Sessions will be signed out. Also
   consider rotating the GitHub OAuth client secret if the helper key or
   client id were affected.
2. VERIFY the egress guard from inside the running container, for example:
   `docker exec xiom-playground node -e "const n=require('net');const s=n.connect(443,'1.1.1.1');s.on('connect',()=>{console.log('REACHABLE');process.exit(1)});s.on('error',()=>{console.log('blocked');process.exit(0)});setTimeout(()=>{console.log('timeout=blocked');process.exit(0)},4000)"`
   Expected: `blocked` or `timeout=blocked`, exit 0. Repeat for DNS
   resolution only if the guard covers UDP/53. If either succeeds, the
   guard needs attention before anything else.
3. CONFIRM the kernel supports Landlock, which the preferred fix uses:
   `uname -r` and
   `grep -i landlock /boot/config-$(uname -r) 2>/dev/null || echo 'check config'`.
   Landlock needs Linux 5.13+ with `CONFIG_SECURITY_LANDLOCK=y`; ABI 4
   (TCP restrictions) needs 6.7+. If the VPS kernel is older, the fallback
   is the host-side runner service (option 2 below).
4. DECIDE and schedule the isolation workstream with the owner:
   - Option 1 (preferred; playground-side, no new host service): a Landlock
     wrapper built into the playground image around every compiler child.
     It allows `/tmp` (read-write), `/app` and `/toolchain` (read-only) and
     the system loader paths, and denies `/data`, `/proc`, `/sys` and TCP
     connect/bind. The policy is inherited by `clang` and by the executed
     program, including shell commands spawned from it.
   - Option 2 (strongest; ops-side): a host-side runner service (same
     pattern as the auth helper) that executes each submission in a fresh
     `docker run --rm` container: `--network none`, own uid, read-only
     toolchain mount, tmpfs `/tmp`, no `/data`, no secrets. The playground
     speaks a narrow request/response protocol to it over the Docker
     gateway. Do NOT give the playground container the Docker socket; that
     would hand root-equivalent control to submitted code through the
     server.
   - Option 3 (defense in depth): move the progress store and session
     signing to a host-side service so the web container holds no
     multi-tenant data and no long-lived secrets. This can land before or
     after option 1/2 and makes the isolation failure smaller.
5. CONTAINER constraints for any option: keep `cap_drop: ALL`, the
   read-only rootfs, `no-new-privileges`, the exec tmpfs, the memory/pid
   limits and the egress guard exactly as they are.

## Acceptance criteria (ops verifies with the playground lane)

- A submitted program cannot read `/data/accounts/*`, `/proc/*/environ`,
  `/etc/xiom/*` or anything outside `/tmp`, `/app` (read-only) and
  `/toolchain` (read-only) -- including through spawned shell commands or
  user-declared `extern "C"` calls.
- TCP connect and bind from a submission fail at the kernel level, not only
  through iptables.
- The full lesson audit still passes on Linux with the sandbox enabled
  (410/410), and a warm repeat run of an unchanged program stays in the
  millisecond range.
- `/api/health` reports the sandbox mode so drift is visible.

## P1 delivered (2026-09-25) -- in-container verification recipe

The image now builds `/usr/local/bin/xiom-sandbox` (clang, build fails if it
does not compile) and `docker-compose.yml` sets `XIOM_SANDBOX=require` with
`XIOM_SANDBOX_BIN=/usr/local/bin/xiom-sandbox`. `/api/health` reports
`sandbox: {mode, active, landlock, error}`.

After the playground deploys (hourly pull or `playground-deploy.sh`), verify
inside the running container:

```
docker cp tools/verify-sandbox.js xiom-playground:/tmp/verify-sandbox.js
docker exec xiom-playground node /tmp/verify-sandbox.js \
  --sandbox /usr/local/bin/xiom-sandbox --toolchain /toolchain --require-net
docker exec xiom-playground node -e \
  "require('http').get('http://127.0.0.1:3000/api/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{const j=JSON.parse(d);console.log(JSON.stringify(j.sandbox))})})"
```

Expected: every probe `ok` (escape dir `/data`, `tcp-connect` denied on ABI
4, warm-run in milliseconds), and `sandbox: {"mode":"require","active":true,
"landlock":4,...}`. Then submit the crafted program through the public API
(`/api/compile` with a source that reads `/data/accounts/*`,
`/proc/1/environ`, spawns `sh -c 'cat /proc/...'` and opens a TCP
connection): every access must be denied and `/api/health` must stay ok. The
rollback is `XIOM_SANDBOX=off` plus a redeploy; the env whitelist and the
rotated secrets stay in force.
