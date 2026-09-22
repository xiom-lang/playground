// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Shared toolchain resolution for the playground server and its tools.
//
// This lives in lib/ (not tools/) on purpose: the runtime Docker image
// excludes tools/ from the build context, and server.js must be able to
// resolve the toolchain inside the image, where XIOM_BIN points at the
// mounted /toolchain.
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const EXT = process.platform === 'win32' ? '.exe' : '';

function resolveToolchain() {
  const candidates = [
    process.env.XIOM_BIN,
    path.join(REPO, '.toolchain', 'bin', 'xiom' + EXT),
    path.join(REPO, '..', 'target', 'debug', 'xiom' + EXT),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'xiom' + EXT; // rely on PATH
}

const XIOM_BIN = resolveToolchain();

const TOOLCHAIN_VERSION = (() => {
  try {
    return fs.readFileSync(path.join(REPO, 'TOOLCHAIN_VERSION'), 'utf8').trim();
  } catch {
    return 'unknown';
  }
})();

const childEnv = Object.assign({}, process.env);
if (fs.existsSync(XIOM_BIN)) childEnv.XIOM_BIN = XIOM_BIN;
if (!childEnv.XIOM_STDLIB) {
  const stdlib = path.join(REPO, '.toolchain', 'lib');
  if (fs.existsSync(stdlib)) {
    childEnv.XIOM_STDLIB = stdlib;
    // A stale global XIOM_HOME stdlib would be scanned alongside the pinned
    // one (module collisions) and can win resolution on some compilers.
    delete childEnv.XIOM_HOME;
  }
}

module.exports = { REPO, EXT, XIOM_BIN, TOOLCHAIN_VERSION, childEnv, resolveToolchain };
