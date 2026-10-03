# C25: `xiom run` script-cache hits close stdin

Playground finding C25 (AUDIT 33.7), found while wiring input lessons on
v0.62.3 (after C24 was fixed): the **first** run of a program reads piped
input, but every later run of the same source reads EOF, because the
script cache serves the result and the cache-hit execution path uses
`std::process::Command::output()` (`crates/xiom/src/main.rs`, the M10
cache branch around line 1579), which sets the child's stdin to null. The
compile-and-run path uses `.status()` and inherits stdin correctly.

## Symptom

```sh
printf 'Ada\n' | xiom run read_input.xi   # got: [Ada]   (cold: compiles)
printf 'Ada\n' | xiom run read_input.xi   # got: []      (cached: stdin closed)
```

Same source, same shell, only the cache state differs.

Second observation on v0.62.3: **`--no-cache` does not bypass a warm
cache** in any spelling (`run --no-cache`, `xiom --no-cache run`,
`XIOM_NO_CACHE=1`): the runs above still cache-hit and still lose stdin,
and the flag also appears not to prevent cache writes.

## Repro / acceptance

```sh
bash run.sh /path/to/toolchain    # or XIOM_TOOLCHAIN
```

`run.sh` runs the program twice with piped input (no `--no-cache`) and
once with `--no-cache`; the core acceptance is that **cold and cached runs
both read `Ada`** (`C25 fixed: yes`). The `--no-cache` line is printed for
context - it should also read `Ada` once the flag is honored again.

## Impact and workaround

Interactive input is unusable while the cache is warm, which is the
normal state in the playground (the first run warms it). The playground
runs input programs with a **fresh empty `HOME`** (server, lesson audit
and the expected-output generator), so the cache lookup misses and the
program compiles and inherits stdin; runs without input keep the cache
(instant reruns). The proper fix is for the cache-hit path to inherit
stdin like the compile path (`.status()` or `Stdio::inherit()` on stdin)
and for `--no-cache` to be honored.
