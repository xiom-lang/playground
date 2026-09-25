# Security hardening checklist (P0-P3)

Reference: `docs/SECURITY_HARDENING.md` (plan),
`docs/OPS_SECURITY_REQUEST.md` (ops relay), `AUDIT.md` section 28
(evidence). ASCII only; check an item only when its evidence exists.

## P0 -- immediate containment (landed 2026-09-25)

- [x] Whitelist the compiler-child environment (`server.js`
      `userChildEnv()`), commit `162e041`.
- [x] Canary test in `tools/test-server.js`; Linux suite 38/38.
- [x] Findings and measurements recorded in `AUDIT.md` section 28.
- [ ] Owner/ops: rotate `SESSION_SECRET` and `AUTH_HELPER_KEY` and restart
      the playground and auth helper.
- [ ] Ops: verify the container egress guard from inside the container
      (node connect probe in the ops request) and confirm the guard
      survives reboot.

## P1 -- Landlock wrapper (playground repo)

- [x] Ops: kernel 6.8.0-139, `CONFIG_SECURITY_LANDLOCK=y`, ABI 4 confirmed
      inside the live container (2026-09-25).
- [x] Add `sandbox/xiom-sandbox.c` with the documented allowlist
      (`/tmp` rw; `/app` + `/toolchain` ro; loader paths; `/dev/null`,
      `/dev/zero`, `/dev/urandom`; deny `/data`, `/proc`, `/sys`, TCP).
- [x] Dockerfile compiles the wrapper with the image clang; a compile
      failure fails the image build.
- [x] `server.js`: `XIOM_SANDBOX=require|auto|off`, spawn the wrapper,
      fail closed in `require` mode.
- [x] `/api/health` reports `sandbox` mode and the Landlock ABI.
- [x] `tools/verify-sandbox.js`: denial probes (data, proc, env, write
      outside /tmp, spawned shell, TCP) plus a warm-run timing check.
- [x] `tools/test-server.js`: Linux execution tests for the denials;
      server started in `require` mode with the toolchain staged under /tmp.
- [x] CI: `validate.yml` builds the wrapper, runs the denial suite with
      `--require-net` per push, and the nightly execution audit runs with
      the sandbox required.
- [x] Linux lesson audit 410/410 under `XIOM_SANDBOX=require` (local WSL,
      2026-09-25; the nightly CI job re-runs it).
- [ ] VPS canary: deploy, check `/api/health`, run the in-container denial
      suite and the crafted public-API probes (ops).
- [x] Update `DEPLOY.md` sandbox section and `SESSION.md` status.

## P2 -- data-plane containment (defense in depth)

- [ ] Owner decision: move sessions/progress host-side, or accept the
      container-resident store once P1 is verified.
- [ ] If moving: helper endpoints for session verify/sign and progress
      read/write, with the playground as a thin client.
- [ ] Export/backup existing `/data` documents before the migration.
- [ ] Remove `SESSION_SECRET`/`AUTH_HELPER_KEY` and the `/data` mount from
      the web container; rotate again at cutover.
- [ ] Update the privacy facts in `DEPLOY.md` and tell the website lane.

## P3 -- abuse controls and monitoring

- [ ] Per-IP token bucket for the compile/check/ir/tokens/format
      endpoints, in-memory, zero dependency; 429 responses counted.
- [ ] `/api/health` exposes queue depth and rejection counters.
- [ ] Alert on sustained queue saturation or compile-volume spikes through
      the existing uptime check.
- [ ] Document the counters in README/DEPLOY.
