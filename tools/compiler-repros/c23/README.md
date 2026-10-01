# C23: v0.62.1 silently miscompiles at -O2

Repro pack for the playground finding C23 (see `AUDIT.md` 33.4). The three
`.xi` files are byte-exact copies of the lesson solutions, extracted from
`lessons/L6-engineering/L6-15.json`, `lessons/L7-mastery/L7-39.json` and
`lessons/L8-ecosystem/L8-09.json` on 2026-10-01.

## Symptom

The same source prints different values depending on the optimization
level, deterministically (`--no-cache`, repeated runs, fresh `HOME`):

| File | correct answer | observed at -O2 on the reporter host |
|---|---|---|
| `l6-15.xi` | `2` (two "personal" notes) | `3` |
| `l7-39.xi` | `2` (one of three marked done) | `3` |
| `l8-09.xi` | `2` (two recipes under 30 min) | `0` |

`-O0` prints the correct value on every host tested. The GitHub Actions
runner's `-O2` output differed from the reporter's WSL host (its nightly
flagged the *stored* values as mismatched while the WSL host matched
them), so the failure is host/clang-dependent - the toolchain links the
host LLVM.

Shapes involved: borrowed structs holding `Vec`s, indexed/`.get()` reads,
string-field comparisons, `.set()`/`.push()` inside `while` loops, and
counts or vectors returned from the loop functions. Reducing the programs
(single-field structs, fewer items, no strings) did not reproduce; the
trigger is subtler than one operation.

## Repro

```sh
# any v0.62.1 toolchain root
bash run.sh /path/to/toolchain        # or set XIOM_TOOLCHAIN
```

Each file is run at `-O0` and `-O2` with `--no-cache` and a fresh script
cache; the script prints the outputs and whether `-O2` differs from `-O0`
(`C23 present: yes/no`).

Manual form:

```sh
cp l7-39.xi /tmp/repro/main.xi
cd /tmp/repro
xiom run     --no-cache main.xi     # prints 3 on an affected host
xiom run -O0 --no-cache main.xi     # prints 2 (correct)
```

## Reporter environment (one affected host)

- WSL2 Ubuntu, pinned toolchain v0.62.1 (`/home/lefteris/xiom_v0621/tc`),
  kernel `6.6.87.2-microsoft-standard-WSL2`.
- Host LLVM: `Ubuntu clang version 18.1.3 (1ubuntu1)` (the toolchain links
  the host clang).
- All three programs are deterministic (no rand/time/IO) and the
  difference survives `--no-cache`, repeated runs, and a wiped
  `HOME`/script cache.
- Example run: `l6-15 2/3 DIFFERS`, `l7-39 2/3 DIFFERS`, `l8-09 2/0
  DIFFERS`, `C23 present: yes`.

## After the fix

`run.sh` is also the playground's acceptance check for the absorption:
when the pin includes the fix, `-O2` and `-O0` must match on all three
files (the script prints `C23 present: no`). The playground itself runs
interactive code at `-O0` since 2026-09-30, so this does not block the
site; it is a correctness bug at the default level.
