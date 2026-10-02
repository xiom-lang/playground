# Playground sandbox capabilities

What a program submitted to playground.xiom-lang.org can and cannot do, and
where each restriction comes from. The reference panel badges (`limited` /
`blocked`) use the same facts; the code that generates those badges lives in
`tools/generate-stdlib-ref.js`.

The short version: computation is unrestricted, the network is gone, the
filesystem is a temporary scratch pad, and process spawning is contained.

## What works fully

- Numbers, strings, collections, generics, contracts, pattern matching, and
  the rest of the language and stdlib surface: compute anything.
- Console output (`io.print`, `io.println`). Console input exists in the
  stdlib (`io.read_line`, `io.read_int`) but is broken on the pinned
  toolchain (compiler finding C24, AUDIT 33.5), so lessons do not use it
  yet; when fixed, input arrives as ordinary data through the runner.
- Random numbers, time, hashing, sorting, text processing.
- Reading the toolchain and the standard library (read-only).

## Network: blocked

- The sandbox policy denies `connect(2)` and `bind(2)` for TCP (Landlock
  ABI 4); the container additionally has an egress guard. Both are enforced
  outside the program.
- `net.*` modules compile, so lessons can show the API, but a real
  connection fails. When a raw denial reaches the output pane, the runner
  says "the playground sandbox has no network access" instead of showing
  an errno.
- The reference panel badges every `net.*` module `blocked`.

## Files: /tmp only, ephemeral

- Each run gets its own directory under the server temp root. Programs can
  create, read, and write files there, and in `/tmp` generally.
- `/tmp` is a size-limited tmpfs. Work directories are deleted after the
  request and the container does not keep them across restarts. Treat every
  file as gone the moment the program exits.
- `/proc`, `/data` (host-side account storage, not mounted in the current
  deployment), `/etc`, `/home`, and the rest of the filesystem are
  unreachable. The toolchain is mounted read-only.
- When a raw file denial reaches the output pane, the runner explains the
  rule ("only /tmp is writable" / "/proc and the app data directories are
  unreachable") instead of showing an errno.

## Processes: contained

- Spawning a process works, but the child inherits the same sandbox: it
  cannot escape to the network or to denied paths, and it is killed with
  the request when the run times out.

## Environment: whitelist

- Compiler and program children receive a small whitelist only: `PATH`,
  `HOME`, `TMPDIR`/`TEMP`, locale variables, and the toolchain locations.
- Server secrets (`SESSION_SECRET`, helper keys, OAuth client id) are not
  visible, and a regression test asserts a submitted program cannot read a
  canary variable.

## Resource limits

- Request bodies: 512 KB.
- Compile queue: 1 compile at a time; check queue: 2.
- Compile/run budget: 30 seconds, then the process tree is killed.
- Rate limit: burst of 10 compiler requests, refilling one token per 4
  seconds per client IP. Denials return HTTP 429 with `Retry-After` and a
  readable message.
- `/api/health` exposes queue state, counters, rate-limit state, and an
  `abuse` monitor field for ops.

## Accounts and progress (host side)

- Sign-in and progress documents live on the host-side helper, outside the
  container. The container holds no user documents and no session secret;
  cookies are verified against the helper when helper mode is enabled.
- Progress sync is optional; lessons and runs work signed out.

## Where each restriction comes from

| Restriction | Enforced by |
|---|---|
| Network, filesystem, process confinement | `sandbox/xiom-sandbox.c` (Landlock), applied per request in `server.js` |
| No container egress | ops firewall guard on the VPS |
| Environment whitelist | `server.js` (`userChildEnv`) |
| Queues, timeouts, body cap, rate limits | `server.js` |
| Progress/account isolation | host-side helper (`lib/auth.js`, `lib/progress-store.js`) |

## Not a restriction (on purpose)

The stdlib is not filtered. Source-level filtering is bypassable (a program
can declare its own `extern "C"`), so the sandbox, not an import list, is
the security boundary. The `playground` / `docs` / `local` tiers in the
reference panel are presentation groups, not compile-time blocks.

Evidence and history: `AUDIT.md` sections 28-31 (security audit, Landlock
implementation, abuse controls) and `docs/SECURITY_HARDENING.md`.
