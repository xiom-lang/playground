# Playground security hardening plan (2026-09-25)

Goal: submitted programs keep arbitrary native execution inside the
container, but can no longer reach the server's secrets, the multi-tenant
progress store, or any file outside the tool's own working set -- and
cannot reach the network at the kernel level. The host boundary must stay
at least as strong as it is today.

Context and evidence: `AUDIT.md` section 28. The ops relay is
`docs/OPS_SECURITY_REQUEST.md`. Checklist for execution:
`docs/checklists/security-hardening.md`.

## 1. Threat model

An attacker can submit any XIOM source and press Run. That gives them:

- arbitrary native code as container uid 10001 (user-declared
  `extern "C"` + `system()` verified on v0.61.3);
- shell command execution inside the container (`process.spawn_command`);
- file read/write through `io`/`io.fs` (real `fopen`/`getenv`, not stubs);
- process listing and `/proc` inspection as the same uid.

Assets to protect, in order:

1. The host and the other services on it (current container boundary).
2. Account secrets: `SESSION_SECRET` (cookie forgery = account
   impersonation), `AUTH_HELPER_KEY`, `GITHUB_CLIENT_ID`.
3. User progress documents on `/data` (read, forge, or delete any account).
4. Service availability (bounded today by queue, memory and pid limits).

## 2. Target architecture

```mermaid
flowchart LR
  B[Browser] --> N[nginx TLS]
  N --> S[playground server]
  S -->|whitelisted env| W[xiom-sandbox wrapper]
  W -->|Landlock policy| X[xiom driver + clang + program]
  X -->|read-write| T[/tmp only]
  X -->|read-only| R[/app + /toolchain]
  X -.->|denied by kernel| D[/data, /proc, /sys, TCP]
  S -->|narrow API, host-side| H[auth/progress helper]
```

The wrapper runs as the same uid, applies the policy to itself, and execs
the compiler driver; Landlock rules are inherited across `execve`, so
`clang`, the linker and the produced program all stay confined.

## 3. Phases

### P0 -- landed 2026-09-25 (commit 162e041)

- Environment whitelist for every compiler child (`server.js`,
  `userChildEnv()`): only `PATH`, `HOME`, `TMPDIR`/`TEMP`, locale and
  `XIOM_BIN`/`XIOM_STDLIB` reach the toolchain.
- Canary test in `tools/test-server.js` (Linux suite 38/38).
- Audit evidence in `AUDIT.md` section 28.
- Still required from the owner/ops: rotate `SESSION_SECRET` and
  `AUTH_HELPER_KEY` (see the ops request).

### P1 -- Landlock wrapper (playground repo, no new host service)

Deliverables:

- `sandbox/xiom-sandbox.c`: small C helper, no dependencies. Sets
  `PR_SET_NO_NEW_PRIVS`, then a Landlock ruleset:
  - handled rights: all filesystem rights of the running ABI, plus TCP
    bind/connect when ABI >= 4;
  - allowed read-write: `/tmp`;
  - allowed read+execute: `/usr`, `/bin`, `/sbin`, `/lib`, `/lib64`,
    `/etc/ld.so.cache` and the loader paths, `/toolchain`, `/app`;
  - allowed devices: `/dev/null`, `/dev/zero`, `/dev/urandom`;
  - everything else is denied by omission, including `/data`, `/proc`,
    `/sys` and the rest of `/dev`;
  - TCP connect/bind denied by rule.
- Dockerfile: compile the helper with the clang already installed in the
  image; failure to build fails the image build (fail closed at build time).
- `server.js`: when `XIOM_SANDBOX` is `require` (production) or `auto`
  (dev/CI), spawn `xiom-sandbox -- <xiom> ...` instead of `<xiom>`.
  `require` mode refuses to run when the wrapper or Landlock is missing;
  the API returns a clear error and `/api/health` reports
  `sandbox: "require" | "auto" | "off"` plus a `landlock` ABI field.
- `tools/verify-sandbox.js` (zero-dep, Linux): runs the denial probes and
  a warm-run timing check; exit non-zero on any escape.
- `tools/test-server.js`: execution tests for the denials (skipped on
  Windows like the other execution tests).

Acceptance:

- From a submission: reading `/data/accounts/*`, `/proc/self/environ`,
  `/proc/<server>/environ`, `/etc/xiom/*` fails; writing outside `/tmp`
  fails; spawning `sh -c 'cat /proc/...'` fails; TCP connect fails.
- The compiled program still runs, and the full Linux lesson audit passes
  410/410 with `XIOM_SANDBOX=require`.
- Warm repeat runs stay in the millisecond range (wrapper overhead is a
  few `prctl`/`landlock` syscalls once per execution).
- CI (ubuntu-latest, kernel 6.x) runs `tools/verify-sandbox.js` on every
  push; the nightly job runs the audit with the sandbox required.

Rollback: set `XIOM_SANDBOX=off` and redeploy; the env whitelist and secret
rotation remain in force.

### P2 -- data-plane containment (defense in depth, ops + playground)

Even with P1, keep the blast radius small if the kernel policy is ever
bypassed:

- Move session signing/verification behind the host helper (or store
  opaque session ids host-side) so `SESSION_SECRET` leaves the container.
- Move the progress documents to a store the container cannot read: either
  through the helper API, or a second volume that is only mounted into a
  future runner container, not into the web container.
- Rotate secrets again at the cutover and document the key handling in the
  ops helper docs.

Acceptance: with the web container compromised at the server process
level, an attacker still cannot sign sessions or read other users'
progress.

### P3 -- abuse controls and monitoring

- Per-IP token bucket for `/api/compile`, `/api/check`, `/api/ir`,
  `/api/tokens`, `/api/format` (in-memory, no dependency), with queue-depth
  and 429 counters exposed on `/api/health`.
- Alert when queue depth stays saturated or compile volume spikes (reuse
  the existing uptime check).
- Keep the image rebuild cadence and kernel updates with ops.

Acceptance: a single IP cannot occupy the queue; abuse is visible before
it becomes an outage.

## 4. Ownership

| work | owner |
|---|---|
| P1 wrapper, server integration, tests, CI job | playground lane |
| Secret rotation, Landlock/kernel confirmation, egress verification | ops + owner |
| P2 host-side session/progress service (decision first) | ops + playground |
| P3 rate limiting, health counters, alerting | playground + ops |
| Phase sequencing and cutover window | owner |

## 5. Residual risks after P0-P3

- Kernel or Landlock implementation bugs (mitigated by P2 containment and
  keeping the container boundary).
- CPU/DoS within the limits and queue (mitigated by P3).
- Compiler/toolchain supply chain (unchanged; release artifacts are
  checksum-verified).
- Side channels against shared caches in `/tmp` (same uid; content-keyed
  script cache is not secret).
- Perfect prevention is not claimed: the goal is that a submission cannot
  read files outside its working set, cannot reach the network, and cannot
  touch another account's data or any server secret.
