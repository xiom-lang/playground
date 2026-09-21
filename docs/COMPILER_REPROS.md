# Compiler repro pack (from the playground lane)

Copy-paste repros for the open compiler-lane items plus the cold-compile
measurement harness used to verify perf work. All commands run on Linux (or
WSL) with `XIOM_BIN`/`XIOM_STDLIB` pointing at the toolchain under test; the
examples below assume the pinned v0.60.1 tree for C3/C6 and note where the
v0.61.0 preview differs.

## 1. Cold-compile harness (fmt reachable-only peek)

`tools/bench-cold-compile.js` (zero-dependency Node) measures the cost of a
program from a cold cache: it deletes `$TMPDIR/xiom_run` and `~/.xiom` before
every sample, so each number includes a full front-end + codegen + clang run.
It times both `xiom run` (total) and `xiom --emit-ir` (front-end only, which
is where `collect_external_decls` and the fmt peek live).

```bash
# Before the change (on the build that shows the problem):
node tools/bench-cold-compile.js --runs 3 --label before --json /tmp/before.json

# After the change (same machine, same shell session):
node tools/bench-cold-compile.js --runs 3 --label after --json /tmp/after.json

# Same-machine delta table:
node tools/bench-cold-compile.js --runs 3 --compare /tmp/before.json
```

Options: `--lesson L0-01` (adds a lesson solution), `--program file.xi`,
`--no-emit-ir`, `--timeout`, `--quiet`. Default programs: `hello`, `to_str`
(the peek trigger), `loop_200` (loop + `to_str`).

Reference run from the playground dev box (WSL Ubuntu, 3 samples, medians in
ms; absolute values are machine-specific, the ratio is the signal):

| program   | v0.60.1 run | v0.60.1 emit-ir | R55 run | R55 emit-ir |
|-----------|-------------|-----------------|---------|-------------|
| hello     | 3956        | 321             | 4916    | 1540        |
| to_str    | 3857        | 395             | 5847    | 2400        |
| loop_200  | 4283        | 452             | 6440    | 2662        |

The R55 front-end is 4-6x slower than the pinned release, and the gap is
largest for `to_str`: that is the broad fmt-closure peek. A reachable-only
peek should bring the emit-ir medians back toward the v0.60.1 column while
leaving `xiom run` totals improved by the same delta. Acceptance: emit-ir
median for `to_str` within ~1.3x of `hello`, and no lesson-audit regressions
(`node tools/lesson-audit.js --baseline tools/lesson-baseline.json` on
Linux).

## 2. C3 - script mode ignores `--opt-level` (and the run path has no opt flag)

Repro on v0.60.1 and v0.61.0:

```bash
printf 'use xiom.io;\n\nfn main() {\n  io.println("probe");\n}\n' > /tmp/probe.xi

# 1. Flag after the subcommand is treated as a filename:
xiom run --opt-level=0 /tmp/probe.xi
#   error: cannot read '--opt-level=0': No such file or directory (os error 2)

# 2. Flag before the subcommand consumes 'run' as the source:
xiom --opt-level=0 run /tmp/probe.xi
#   error: cannot read 'run': No such file or directory (os error 2)

# 3. --run accepts it but ignores it and never caches (compiles a.out each time):
xiom --opt-level=0 --run /tmp/probe.xi
#   compiled: a.out   (runs; level ignored; a second call recompiles)

# 4. Compile-only honors it (this is the only working -O0 path today):
xiom --opt-level=0 -o /tmp/prog /tmp/probe.xi && /tmp/prog
#   compiled: /tmp/prog
```

Measured cold compile-only effect (same machine): v0.61.0 ~2.3 s at `-O0`
vs ~7.8 s default; v0.60.1 ~3.8 s vs ~4.0 s (no effect, front-end-bound).
Request: thread the level into the script-run path (and include it in the
script-cache key), or expose an env var the driver can set; the playground
will detect the capability and pass `-O0` for edit-run loops.

Note: the script cache itself works when writable - `--force` exists for
cache bypass - so the driver-side ask is only the optimization level.

## 3. C6 - pinned stdlib ships the benchmark `package.xi`

```bash
head -6 "$XIOM_STDLIB/package.xi"
# package xiom_bench {
#   name: "xiom-bench";
#   version: "0.1.0";
#   description: "XIOM benchmarking suite -- measure and compare performance";
#   authors: ["XIOM Team"];
#   deps: { "xiom-std": "0.1.0" };
# }
```

This file is present in the pinned release tarball's `lib/` (v0.60.1) and in
the compiler repository's `stdlib/` checkout. It is the benchmark suite
manifest, not a stdlib manifest, so a `xiom build` run with that directory as
the project root picks up `xiom-bench`. Request: ship the correct stdlib
manifest (or drop the file from the release `lib/`); the playground only
reads `xiom/` modules, so this is a packaging/identity issue rather than a
runtime one.

## 4. Other open playground asks

- Script cache must not require a writable `HOME` (currently it silently
  stops caching when `~/.xiom` cannot be created; the VPS works around it with
  `HOME=/tmp/xiom-home`). Repro: `HOME=/tmp/readonly chmod 555 ...` then run
  the same program twice - second run recompiles.
- `L3-50` (tuple `Result` payload through `?`) is the only lesson without a
  deterministic expected output on R55; the playground skip list names it.
