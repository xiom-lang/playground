// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Shared child-process execution for the playground server and its tools.
// Every run is bounded by a timeout and killed as a process tree, so a stuck
// clang cannot outlive its compile.
'use strict';

const { spawn } = require('child_process');

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }
  }
}

/**
 * Spawn a process and always resolve (never reject) with its result.
 * @param {string} bin executable path
 * @param {string[]} args arguments
 * @param {{cwd?: string, env?: object, timeoutMs?: number, input?: string|null}} options
 * @returns {Promise<{success: boolean, code: number, signal: string|null, spawnError: boolean, stdout: string, stderr: string, timedOut: boolean}>}
 */
function runProcess(bin, args, options) {
  const opts = options || {};
  const timeoutMs = opts.timeoutMs || 30000;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, {
        cwd: opts.cwd || process.cwd(),
        env: opts.env || process.env,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({ success: false, code: -1, signal: null, spawnError: true, stdout: '', stderr: String((err && err.message) || err), timedOut: false });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    const finish = (code, spawnError, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (spawnError) stderr = (stderr ? stderr + '\n' : '') + spawnError;
      resolve({
        success: code === 0 && !timedOut && !signal,
        code: typeof code === 'number' ? code : -1,
        signal: signal || null,
        spawnError: Boolean(spawnError),
        stdout,
        stderr,
        timedOut,
      });
    };

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => finish(-1, String((err && err.message) || err), null));
    child.on('close', (code, signal) => finish(code, null, signal));
    if (opts.input != null) child.stdin.end(opts.input); else child.stdin.end();
  });
}

module.exports = { killTree, runProcess };
