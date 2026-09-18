#!/usr/bin/env bash
# Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
# SPDX-License-Identifier: MIT OR Apache-2.0
#
# Fetch the XIOM toolchain pinned in TOOLCHAIN_VERSION into .toolchain/.
# Verifies the release SHA256SUMS before extracting.
#
# Usage: tools/fetch-toolchain.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

TAG="$(tr -d '\r\n ' < TOOLCHAIN_VERSION)"
VERSION="${TAG#v}"
BASE_URL="https://dl.xiom-lang.org/releases/${TAG}"
DEST="$REPO/.toolchain"
STAGE="$REPO/.toolchain.stage"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  ASSET="xiom-${VERSION}-linux-x64.tar.gz" ;;
  Linux-aarch64) echo "error: no linux-aarch64 release asset" >&2; exit 1 ;;
  Darwin-*)      echo "error: no macOS release asset yet" >&2; exit 1 ;;
  MINGW*|MSYS*|CYGWIN*) ASSET="xiom-${VERSION}-windows-x64.zip" ;;
  *) echo "error: unsupported platform $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

rm -rf "$STAGE"
mkdir -p "$STAGE"
echo "toolchain: ${TAG} (${ASSET})"

curl -fsSL "$BASE_URL/SHA256SUMS" -o "$STAGE/SHA256SUMS"
curl -fsSL "$BASE_URL/${ASSET}" -o "$STAGE/${ASSET}"
(
  cd "$STAGE"
  grep " ${ASSET}\$" SHA256SUMS | sha256sum -c -
)

rm -rf "$STAGE/extract"
mkdir -p "$STAGE/extract"
case "$ASSET" in
  *.tar.gz) tar -xzf "$STAGE/${ASSET}" -C "$STAGE/extract" ;;
  *.zip)
    if command -v unzip >/dev/null 2>&1; then
      unzip -q -o "$STAGE/${ASSET}" -d "$STAGE/extract"
    else
      echo "error: unzip is required to extract ${ASSET}" >&2
      exit 1
    fi
    ;;
esac

if [ ! -f "$STAGE/extract/bin/xiom" ] && [ ! -f "$STAGE/extract/bin/xiom.exe" ]; then
  echo "error: archive did not contain bin/xiom" >&2
  exit 1
fi

rm -rf "$DEST"
mv "$STAGE/extract" "$DEST"
rm -rf "$STAGE"
echo "XIOM_BIN=$DEST/bin/xiom"
echo "XIOM_STDLIB=$DEST/lib"
