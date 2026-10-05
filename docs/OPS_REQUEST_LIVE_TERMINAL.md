# Ops request: stdin pass-through for live Terminal sessions

From: playground lane. Status: open (2026-10-05).
Companions: AUDIT 43-46, ROADMAP 2.1.6-2.1.9.

## What the playground is doing

The lessons Terminal now supports a **live session** (`/api/live/start`,
`input`, `output`, `close`): the sandboxed program is spawned once with
piped stdin/stdout and stays alive, so learners see prompts as printed
and answer them one line at a time (pause-at-read), exactly like a
terminal for the program's own I/O. No command execution, no shell.

It works today wherever the program runs unwrapped (local dev, CI): the
server test `live sessions stream prompts and take answers` drives
`Name? -> Ada -> Hello, Ada! -> 7 -> N=7 -> exit`.

## The blocker

In the production container the session starts but the program sees EOF
immediately, before any answer is written:

    Name?
    Hello, !        (read_line returned "")
    err             (read_int returned Err)

and the session end is signalled (code null). The same binary under the
WSL sandbox streams fine, so this is a wrapper-build behavior, not the
playground. Working hypothesis: the wrapper reads/consumes stdin up front
(or replaces it) before exec'ing the compiler, which is correct for
one-shot runs but makes interactive children impossible.

Current state on our side: `/api/live/start` returns 503 whenever the
program would run under the wrapper, `/api/version` exposes
`capabilities.live`, and the Terminal transparently falls back to replay
(restart the program with all answers so far). Production is not broken;
it just cannot be live yet.

## The ask

1. **Pass the inherited stdin file descriptor through to the executed
   child without reading it, closing it early, or substituting an empty
   one.** Preferred: a `--keep-stdin` flag (default off) so every
   existing one-shot caller keeps byte-identical semantics. If the
   one-shot path already only writes provided input and closes, making
   pass-through unconditional is fine too.
2. **Keep the child in the wrapper's process group and do not detach.**
   The playground kills the wrapper with SIGKILL on wall (90 s) or idle
   (30 s) timeouts; that signal must terminate the compiler and the user
   program as well.
3. **No other behavior change.** Same Landlock rules (allow /tmp
   read-write, /app and /toolchain read-only, deny /data, /proc, /sys,
   TCP), same environment whitelist, same canary (`--probe` and
   `-- XIOM_BIN --version`).

## Why this is safe

- The child is already confined and already may read stdin; the only
  difference is that reads can happen over time instead of from a
  pre-filled buffer. **No new capability is granted.**
- The pipe is created and owned by the playground server. The wrapper
  does not need to read it, buffer it, or expose anything else.
- What we are explicitly NOT asking for: host stdin/stdout passthrough,
  network access, extra filesystem rights, privilege changes, detaching
  or daemonizing the child, ignoring signals, or opening additional fds.
- The resource envelope stays enforced by the playground: 2 sessions per
  IP, 90 s wall clock, 30 s idle, 256 KB output, 64 KB per line, 256 KB
  total input; a 5 s sweeper kills and reaps expired sessions. The
  wrapper only has to not break process-group kill semantics.

## Acceptance criteria (ops CI)

1. Interactive fixture under the sandbox with the flag: prints a prompt,
   blocks on a read, receives a line, echoes it, reads a second line,
   exits 0. The run's wall time must exceed startup time (proving it
   waited rather than reading EOF).
2. Denial tests unchanged with the flag: TCP connect, reading /data,
   writing /app all fail with today's errors.
3. One-shot regression: `/api/compile` with `stdin` returns identical
   output; EOF semantics preserved when the caller closes stdin; exit
   codes unchanged.
4. Canary unchanged (`--probe`, `-- XIOM_BIN --version`).
5. Kill chain and fd hygiene: SIGKILL to the wrapper terminates compiler
   and program with no orphans; `/proc/<wrapper>/fd` does not grow across
   repeated sessions.
6. The new flag/behavior is documented and covered by at least one
   interactive test.

## Playground-side readiness when this lands

- We probe the new capability (e.g. `--keep-stdin` support), add it to
  the live spawn, and delete the 503 gate; `capabilities.live` flips to
  true and production goes live automatically - no client changes.
- The replay fallback stays as a safety net regardless.
