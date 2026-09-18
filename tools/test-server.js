// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Playground server smoke tests. Starts server.js on a random port and
 * exercises the HTTP surface, including the path-traversal containment,
 * body limits, queue responsiveness, and - when a toolchain is available -
 * a real type check and run.
 *
 * Usage: node tools/test-server.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { REPO, XIOM_BIN, childEnv } = require('./lib/toolchain');

const PORT = 3400 + Math.floor(Math.random() * 200);
const HOST = '127.0.0.1';
let passed = 0;
let failed = 0;
const skipped = [];

function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failed++;
    console.error('  FAIL ' + name + ': ' + ((err && err.message) || err));
  }
}

async function okAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failed++;
    console.error('  FAIL ' + name + ': ' + ((err && err.message) || err));
  }
}

function request(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = http.request({
      host: HOST,
      port: PORT,
      path: requestPath,
      method,
      headers: data === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('request timeout')));
    if (data !== null) req.write(data);
    req.end();
  });
}

// Raw request so the client cannot normalize "../" away.
function rawRequest(requestTarget) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, HOST, () => {
      socket.write('GET ' + requestTarget + ' HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n');
    });
    let response = '';
    socket.on('data', (chunk) => { response += chunk; });
    socket.on('end', () => {
      const status = Number((response.match(/^HTTP\/1\.1 (\d+)/) || [])[1] || 0);
      resolve({ status, body: response.split('\r\n\r\n').slice(1).join('\r\n\r\n') });
    });
    socket.on('error', reject);
    socket.setTimeout(15000, () => socket.destroy(new Error('raw request timeout')));
  });
}

function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      request('GET', '/api/health')
        .then((res) => {
          if (res.status === 200) resolve(res);
          else retry();
        })
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() > deadline) reject(new Error('server did not become healthy'));
      else setTimeout(poll, 200);
    };
    poll();
  });
}

function startServer() {
  const child = spawn(process.execPath, [path.join(REPO, 'server.js')], {
    cwd: REPO,
    env: Object.assign({}, childEnv, { PORT: String(PORT), HOST, MAX_CHECKS: '2', MAX_COMPILES: '1' }),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => process.stdout.write('[server] ' + chunk));
  child.stderr.on('data', (chunk) => process.stderr.write('[server] ' + chunk));
  return child;
}

function stopServer(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  }
}

async function main() {
  const hasToolchain = fs.existsSync(XIOM_BIN) || /[\\/]/.test(XIOM_BIN) === false;
  const child = startServer();
  try {
    await waitForHealth(15000);

    console.log('server surface:');
    await okAsync('GET /api/health returns ok', async () => {
      const res = await request('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.status, 'ok');
      assert.ok(payload.queue);
    });

    await okAsync('GET /api/version reports toolchain and capabilities', async () => {
      const res = await request('GET', '/api/version');
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.ok(typeof payload.server === 'string' && payload.server.length > 0);
      assert.ok(typeof payload.toolchain === 'string' && payload.toolchain.length > 0);
      assert.ok(payload.capabilities && typeof payload.capabilities.format === 'boolean');
    });

    await okAsync('GET /api/lessons returns the catalog', async () => {
      const res = await request('GET', '/api/lessons');
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.total_lessons, 410);
    });

    await okAsync('GET /index.html serves the app', async () => {
      const res = await request('GET', '/index.html');
      assert.strictEqual(res.status, 200);
      assert.ok(/XIOM/i.test(res.body));
    });

    console.log('static containment:');
    for (const target of ['/../server.js', '/%2e%2e/server.js', '/..%2fserver.js', '/../../etc/passwd', '/.git/config', '/.kilo/worktrees']) {
      await okAsync('rejects ' + target, async () => {
        const res = await rawRequest(target);
        assert.notStrictEqual(res.status, 200, 'expected non-200 for ' + target);
      });
    }

    console.log('request limits:');
    await okAsync('rejects oversized body with 413', async () => {
      const big = JSON.stringify({ source: 'x'.repeat(600 * 1024) });
      const res = await request('POST', '/api/check', big);
      assert.strictEqual(res.status, 413);
    });

    await okAsync('rejects invalid JSON with 400', async () => {
      const res = await request('POST', '/api/check', '{not json');
      assert.strictEqual(res.status, 400);
    });

    await okAsync('rejects non-string source with 400', async () => {
      const res = await request('POST', '/api/check', { source: 42 });
      assert.strictEqual(res.status, 400);
    });

    await okAsync('rejects unsupported method with 405', async () => {
      const res = await request('DELETE', '/api/lessons');
      assert.strictEqual(res.status, 405);
    });

    console.log('compile pipeline:');
    if (!hasToolchain) {
      skipped.push('compiler not available at ' + XIOM_BIN);
      console.log('  skip compiler tests (' + XIOM_BIN + ' not found)');
    } else {
      await okAsync('POST /api/check passes valid code quickly', async () => {
        const res = await request('POST', '/api/check', { source: 'use xiom.io;\nfn main() { io.println("ok"); }\n' });
        assert.strictEqual(res.status, 200);
        const payload = JSON.parse(res.body);
        assert.strictEqual(payload.success, true, JSON.stringify(payload.diagnostics));
        assert.ok(payload.elapsedMs >= 0);
      });

      await okAsync('POST /api/check reports syntax errors as diagnostics', async () => {
        const res = await request('POST', '/api/check', { source: 'fn main( { }\n' });
        assert.strictEqual(res.status, 200);
        const payload = JSON.parse(res.body);
        assert.strictEqual(payload.success, false);
        assert.ok(payload.diagnostics.some((d) => d.kind === 'error'));
      });

      // Program execution is skipped on Windows: the clang shipped with the
      // Windows toolchain currently hangs optimizing the C runtime at -O2
      // (compiler finding C5/C3). CI runs these on Linux.
      const executionEnabled = process.platform !== 'win32' || process.env.XIOM_TEST_RUN_WINDOWS === '1';
      if (!executionEnabled) {
        skipped.push('program execution on Windows toolchain (set XIOM_TEST_RUN_WINDOWS=1 to force)');
        console.log('  skip execution tests (known Windows clang -O2 pathology; set XIOM_TEST_RUN_WINDOWS=1 to force)');
      } else {
        await okAsync('POST /api/compile runs a program', async () => {
          const res = await request('POST', '/api/compile', { source: 'use xiom.io;\nfn main() { io.println("audit-hello"); }\n' });
          assert.strictEqual(res.status, 200);
          const payload = JSON.parse(res.body);
          assert.strictEqual(payload.success, true, JSON.stringify(payload.diagnostics));
          assert.ok(payload.output.indexOf('audit-hello') >= 0, 'unexpected output: ' + payload.output);
        });

        await okAsync('health stays responsive during a compile', async () => {
          const compile = request('POST', '/api/compile', { source: 'use xiom.io;\nfn main() {\n  var i = 0;\n  while i < 50 { io.println("tick"); i = i + 1; }\n}\n' }).catch(() => null);
          await new Promise((resolve) => setTimeout(resolve, 150));
          const started = Date.now();
          const health = await request('GET', '/api/health');
          const elapsed = Date.now() - started;
          assert.strictEqual(health.status, 200);
          assert.ok(elapsed < 2000, 'health took ' + elapsed + 'ms while compiling');
          await compile;
        });
      }
    }
  } finally {
    stopServer(child);
  }

  console.log('');
  console.log('passed=' + passed + ' failed=' + failed + (skipped.length ? ' skipped=' + skipped.length : ''));
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('smoke tests failed: ' + ((err && err.stack) || err));
  process.exit(1);
});
