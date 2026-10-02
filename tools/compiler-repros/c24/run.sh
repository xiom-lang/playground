#!/usr/bin/env bash
# C24 acceptance check: io.read_line() must echo piped input.
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
cp "$ROOT/read_line.xi" "$WORK/read_line.xi"

echo "=== run mode:"
out="$(cd "$WORK" && printf 'Ada\n' | timeout 60 "$XIOM" run --no-cache -O0 read_line.xi 2>/dev/null | grep -v '^ *compiled:' | head -1)"
rc=$?
echo "run: [${out:-<none>}] rc=$rc"

echo "=== compile mode:"
( cd "$WORK" && timeout 120 "$XIOM" -o "$WORK/prog.exe" read_line.xi >/dev/null 2>&1 )
printf 'Ada\n' | timeout 60 "$WORK/prog.exe" > "$WORK/out.txt" 2> "$WORK/err.txt"
rc2=$?
echo "compile+run: [$(head -1 "$WORK/out.txt")] rc=$rc2"
if [ "$rc2" -ne 0 ]; then
  echo "stderr: $(head -1 "$WORK/err.txt")"
fi

if [ "$out" = "got: [Ada]" ] && [ "$rc2" -eq 0 ]; then
  echo "C24 fixed: yes"
else
  echo "C24 fixed: no"
fi
