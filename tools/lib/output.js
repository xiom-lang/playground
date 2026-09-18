// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
// Canonical program-output normalization shared by the expected-output
// generator and the lesson audit. The browser re-implements the same rules
// inline (see normalizeOutputText in js/compiler.js); keep them in sync.
'use strict';

/**
 * Normalize captured program output for storage and comparison:
 * - CRLF -> LF (Windows and Linux runs must agree);
 * - strip ANSI color sequences (a TTY-aware toolchain may emit them);
 * - drop trailing spaces/tabs on each line and trailing newlines.
 * @param {string|null|undefined} text
 * @returns {string}
 */
function normalizeOutput(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n/g, '\n')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n+$/, '');
}

module.exports = { normalizeOutput };
