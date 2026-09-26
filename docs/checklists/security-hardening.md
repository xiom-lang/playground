# Security hardening checklist (P0-P3)

Reference: `docs/SECURITY_HARDENING.md` (plan),
`docs/OPS_SECURITY_REQUEST.md` (ops relay), `AUDIT.md` sections 28-29
(evidence). ASCII only; check an item only when its evidence exists.

## P0 -- immediate containment (landed 2026-09-25)

- [x] Whitelist the compiler-child environment (`server.js`
      `userChildEnv()`), commit `162e041`.
- [x] Canary test in `tools/test-server.js`; Linux suite 38/38.
- [x] Findings and measurements recorded in `AUDIT.md` section 28.
- [x] Owner/ops: rotate `SESSION_SECRET` and `AUTH_HELPER_KEY` and restart
      the playground and auth helper (ops, 2026-09-25).
- [x] Ops: verify the container egress guard from inside the container
      (`timeout=blocked` in the 2026-09-25 report) and confirm the guard
      survives reboot (30 s + 90 s @reboot hook).

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
- [x] VPS canary: deploy, check `/api/health`, run the in-container denial
      suite and the crafted public-API probes (ops, deploy `f5fccef`:
      `mode=require active=true landlock=4`, all probes ok, TCP EACCES,
      warm 9 ms, escape program denied). P1 acceptance met.
- [x] Update `DEPLOY.md` sandbox section and `SESSION.md` status.

## P2 -- data-plane containment (defense in depth)

- [x] Owner/ops decision: move sessions and progress host-side (ops hosts
      the service).
- [x] Endpoint/protocol design sent to ops:
      `docs/P2_STATE_HELPER_DESIGN.md` (opaque session tokens, helper-minted
      on OAuth exchange; progress proxy with revision semantics; host store
      at `/opt/xiom/playground-state`; container drops `SESSION_SECRET` and
      `/data`).
- [x] Ops: implement the helper endpoints and the state directory; confirm
      the deployment is live (2026-09-26: service active, state dir 0700
      owned by xiom-auth, C4 checks pass, ops contract test 23/23).
- [x] Playground: async `userFromRequest` with cache, per-boot OAuth state
      key, progress-store helper client, mock-helper protocol tests
      (`PLAYGROUND_STATE=helper`; AUDIT section 31).
- [x] Cutover: restore the pre-P2 env and recreate; the host store is
      additive (executed 2026-09-26: helper mode live, `SESSION_SECRET`
      removed, key rotated, forged cookie 401, health unchanged, browser
      sign-in + host-side progress writes confirmed).
- [x] Update the privacy facts in `DEPLOY.md` and tell the website lane
      (`DEPLOY.md` updated; website-page sync handed to the website lane in
      the 2026-09-26 report; do it after the rollback window).

## P3 -- abuse controls and monitoring

- [x] Per-IP token bucket for the compile/check/ir/tokens/format
      endpoints, in-memory, zero dependency; 429 responses counted
      (`server.js`, `RATE_LIMIT_BURST`/`RATE_LIMIT_REFILL_MS`).
- [x] `/api/health` exposes queue depth and rejection counters
      (`counters` + `rateLimit`; verified by `tools/test-server.js`).
- [x] Alert on sustained queue saturation or compile-volume spikes through
      the existing uptime check (owner wired the external UptimeRobot
      keyword monitor on `"abuse":"ok"`, 2026-09-26, reports healthy).
- [x] Document the counters in `DEPLOY.md` (abuse-controls section).
- [ ] Ops: close the 24-48 h rollback window once C7 has been deployed
      (remove the retained `playground_playground-data` volume and the
      pre-P2 env copy; keep the accounts backup until the owner signs off).
