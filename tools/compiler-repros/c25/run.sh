#!/usr/bin/env bash
# C25 acceptance check: cached runs must read piped stdin like cold runs.
# Usage: bash run.sh [toolchain-root]
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
TC="${1:-${XIOM_TOOLCHAIN:-/tmp/xiom-toolchain}}"
XIOM="$TC/bin/xiom"
if [ ! -x "$XIOM" ]; then
  echo "toolchain not found: $XIOM (pass a toolchain root or set XIOM_TOOLCHAIN)" >&2
  exit 2
fi
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export XIOM_STDLIB="$TC/lib"
export HOME="$WORK/home"
mkdir -p "$HOME"
cp "$ROOT/read_input.xi" "$WORK/read_input.xi"

run_once() { # extra-args...
  ( cd "$WORK" && printf 'Ada\n' | timeout 60 "$XIOM" run "$@" read_input.xi 2>/dev/null | grep -v '^ *compiled:' | head -1 )
}

cold="$(run_once -O0)"
cached="$(run_once -O0)"
nocache="$(run_once -O0 --no-cache)"
echo "cold:    [${cold:-<none>}]"
echo "cached:  [${cached:-<none>}]"
echo "nocache: [${nocache:-<none>}]"

# Core acceptance: a warm cache must still deliver stdin.
if [ "$cold" = "got: [Ada]" ] && [ "$cached" = "got: [Ada]" ]; then
  echo "C25 fixed: yes"
else
  echo "C25 fixed: no"
fi
if [ "$nocache" != "got: [Ada]" ]; then
  echo "note: --no-cache still does not bypass the cache (separate observation)"
fi
