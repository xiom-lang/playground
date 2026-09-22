// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Toolchain resolution for the playground tools.
//
// The implementation lives in lib/toolchain.js so that server.js can use it
// inside the runtime image, which excludes tools/ from the build context.
'use strict';

module.exports = require('../../lib/toolchain');
