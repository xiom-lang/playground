// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Plain-language sandbox denials.
//
// The container policy (Landlock) returns EACCES/EPERM for denied
// operations. When the raw errno reaches the runner output, map it to what
// the playground actually allows instead of an unhelpful kernel message.
'use strict';

const DENIED_RE = /(eacces|eperm|permission denied|operation not permitted|access denied|read-only file system|os error (1|13|30))/i;
const CONNECT_RE = /(connect|tcp|socket|network|dns|resolve|http|https|url)/i;
const WRITE_RE = /(open|write|create|mkdir|rename|remove|unlink|append|truncate|touch|chmod|chown|copy|move)/i;
const READ_RE = /(read|open|stat|list|walk|scan|metadata|environ)/i;
const PROTECTED_PATH_RE = /(\/proc|\/data|\/etc|\/root|\/home|\/var)/;

const NETWORK_MESSAGE = 'The playground sandbox has no network access, so this program cannot reach the network.';
const PROTECTED_MESSAGE = 'The playground sandbox keeps /proc and the app data directories unreachable; only /tmp is read-write.';
const WRITE_MESSAGE = 'The playground sandbox only allows writing inside /tmp, and those files are cleared between runs.';
const READ_MESSAGE = 'The playground sandbox denied this read; programs can only read the toolchain and their own /tmp work directory.';
const GENERIC_MESSAGE = 'The playground sandbox denied this operation.';

function friendlyDenial(text) {
  const s = String(text || '');
  if (!s || !DENIED_RE.test(s)) return '';
  if (CONNECT_RE.test(s)) return NETWORK_MESSAGE;
  if (PROTECTED_PATH_RE.test(s) && READ_RE.test(s)) return PROTECTED_MESSAGE;
  if (WRITE_RE.test(s)) return WRITE_MESSAGE;
  if (READ_RE.test(s)) return READ_MESSAGE;
  return GENERIC_MESSAGE;
}

module.exports = {
  friendlyDenial,
  messages: {
    network: NETWORK_MESSAGE,
    protectedPath: PROTECTED_MESSAGE,
    write: WRITE_MESSAGE,
    read: READ_MESSAGE,
    generic: GENERIC_MESSAGE,
  },
};
