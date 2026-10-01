#!/usr/bin/env bash
# C23 repro runner: run each file at -O0 and -O2 with a clean script cache.
# Usage: bash run.sh [toolchain-root]
#   toolchain-root defaults to $XIOM_TOOLCHAIN or /tmp/xiom-toolchain.
# Prints the outputs and whether -O2 differs from -O0 (C23 present: yes/no).
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

run_one() { # file opt -> stdout
  local file="$1" opt="$2"
  rm -rf "$WORK/home" "$WORK/run"
  mkdir -p "$WORK/home" "$WORK/run"
  export HOME="$WORK/home"
  cp "$ROOT/$file" "$WORK/run/main.xi"
  ( cd "$WORK/run" && timeout 120 "$XIOM" run --no-cache "$opt" main.xi 2>/dev/null | tail -1 )
}

present=0
unexpected=0
printf '%-8s %-6s %-6s %s\n' file -O0 -O2 difference
for f in l6-15 l7-39 l8-09; do
  o0="$(run_one "$f.xi" -O0)"
  o2="$(run_one "$f.xi" -O2)"
  diff="same"
  if [ "$o0" != "$o2" ]; then
    diff="DIFFERS"
    present=1
  fi
  if [ "$o0" != "2" ]; then
    unexpected=1
  fi
  printf '%-8s %-6s %-6s %s\n' "$f" "${o0:-?}" "${o2:-?}" "$diff"
done

if [ "$unexpected" -eq 1 ]; then
  echo "note: an -O0 run did not print 2; the host or toolchain differs from the report" >&2
fi
if [ "$present" -eq 1 ]; then
  echo "C23 present: yes (-O2 differs from -O0)"
else
  echo "C23 present: no (-O2 matches -O0)"
fi
