#!/usr/bin/env bash
# Compile every .xi in a Windows temp dir from a /tmp copy, 4 in parallel.
# For failures whose first error is an undefined module, retry with all
# detected module imports prepended and record that fact.
# Usage: compile-dir.sh <win-src-dir> <win-out-dir>
set -u
SRC_WIN="$1"
OUT_WIN="$2"
if [ ! -x /tmp/xiom-toolchain/bin/xiom ]; then
  rm -rf /tmp/xiom-toolchain; cp -a /home/lefteris/xiom_v0613/tc /tmp/xiom-toolchain
fi
X=/tmp/xiom-toolchain/bin/xiom
export XIOM_STDLIB=/tmp/xiom-toolchain/lib HOME=/tmp/xiom-home
mkdir -p /tmp/xiom-home
rm -rf /tmp/compile-src /tmp/compile-out
mkdir -p /tmp/compile-src
cp -a "$SRC_WIN"/. /tmp/compile-src/
mkdir -p "$OUT_WIN"
rm -f "$OUT_WIN"/*.status "$OUT_WIN"/*.err

worker() {
  f="$1"
  tag=$(basename "$f" .xi)
  err=$(timeout 20 "$X" --check "$f" 2>&1)
  if [ $? -eq 0 ]; then echo "ok" > "$OUT_WIN/$tag.status"; : > "$OUT_WIN/$tag.err"; return; fi
  mods=""
  for m in io string math; do
    if echo "$err" | grep -q "undefined variable '$m'"; then mods="$mods$m,"; fi
  done
  if [ -n "$mods" ]; then
    tmp=$(mktemp /tmp/check-XXXXXX.xi)
    for m in io string math; do
      case "$mods" in *"$m,"*) echo "use xiom.$m;" >> "$tmp" ;; esac
    done
    echo >> "$tmp"
    cat "$f" >> "$tmp"
    err2=$(timeout 20 "$X" --check "$tmp" 2>&1)
    if [ $? -eq 0 ]; then echo "ok prepended=${mods%,}" > "$OUT_WIN/$tag.status"; : > "$OUT_WIN/$tag.err"; rm -f "$tmp"; return; fi
    echo "fail prepended=${mods%,}" > "$OUT_WIN/$tag.status"
    echo "$err2" > "$OUT_WIN/$tag.err"
    rm -f "$tmp"
    return
  fi
  echo "fail" > "$OUT_WIN/$tag.status"
  echo "$err" > "$OUT_WIN/$tag.err"
}
export -f worker
export OUT_WIN X XIOM_STDLIB HOME

ls /tmp/compile-src/*.xi | xargs -P 4 -I{} bash -c 'worker "$@"' _ {}
echo "compiled: $(cat "$OUT_WIN"/*.status | wc -l), ok: $(grep -l '^ok' "$OUT_WIN"/*.status | wc -l)"
