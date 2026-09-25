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

- [ ] Ops: confirm `uname -r` and `CONFIG_SECURITY_LANDLOCK=y` (5.13+;
      ABI 4 for TCP rules needs 6.7+). If older, take option 2 (host-side
      runner) instead.
- [ ] Add `sandbox/xiom-sandbox.c` with the documented allowlist
      (`/tmp` rw; `/app` + `/toolchain` ro; loader paths; `/dev/null`,
      `/dev/zero`, `/dev/urandom`; deny `/data`, `/proc`, `/sys`, TCP).
- [ ] Dockerfile compiles the wrapper with the image clang; a compile
      failure fails the image build.
- [ ] `server.js`: `XIOM_SANDBOX=require|auto|off`, spawn the wrapper,
      fail closed in `require` mode.
- [ ] `/api/health` reports `sandbox` mode and the Landlock ABI.
- [ ] `tools/verify-sandbox.js`: denial probes (data, proc, env, write
      outside /tmp, spawned shell, TCP) plus a warm-run timing check.
- [ ] `tools/test-server.js`: Linux execution tests for the denials.
- [ ] CI: run `tools/verify-sandbox.js` on ubuntu-latest per push; run the
      Linux lesson audit with `XIOM_SANDBOX=require` nightly.
- [ ] Linux lesson audit 410/410 with the sandbox required.
- [ ] VPS canary: deploy with `require`, check `/api/health`, run the
      probes against production.
- [ ] Update `DEPLOY.md` sandbox section and `SESSION.md` status.

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
