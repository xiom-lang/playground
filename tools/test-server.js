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
const os = require('os');
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

function requestTo(port, method, requestPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const headers = Object.assign({}, extraHeaders || {});
    if (data !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({
      host: HOST,
      port,
      path: requestPath,
      method,
      headers,
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

function request(method, requestPath, body) {
  return requestTo(PORT, method, requestPath, body);
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

function waitForHealth(timeoutMs, port) {
  const targetPort = port || PORT;
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      requestTo(targetPort, 'GET', '/api/health')
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

function startServerWithEnv(extraEnv, port) {
  const child = spawn(process.execPath, [path.join(REPO, 'server.js')], {
    cwd: REPO,
    env: Object.assign({}, childEnv, { PORT: String(port || PORT), HOST, MAX_CHECKS: '2', MAX_COMPILES: '1' }, extraEnv || {}),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => process.stdout.write('[server] ' + chunk));
  child.stderr.on('data', (chunk) => process.stderr.write('[server] ' + chunk));
  return child;
}

function startServer() {
  return startServerWithEnv({}, PORT);
}

/**
 * Mock of the host-side auth helper: accepts POST /exchange with the shared
 * key and returns the queued users in order. No GitHub involved.
 */
function startMockHelper(users) {
  let index = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const json = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'POST' && req.url === '/exchange') {
        if (req.headers['x-auth-helper-key'] !== 'test-helper-key') {
          json(401, { ok: false, error: 'bad helper key' });
          return;
        }
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { parsed = null; }
        if (!parsed || !parsed.code || !parsed.redirect_uri) {
          json(400, { ok: false, error: 'bad body' });
          return;
        }
        const user = users[index % users.length];
        index += 1;
        json(200, { ok: true, user });
        return;
      }
      json(404, { ok: false, error: 'no route' });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, HOST, () => resolve({ server, port: server.address().port }));
  });
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
  const authPort = PORT + 137;
  const authDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiom_pg_auth_'));
  let authChild = null;
  let helper = null;
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

    await okAsync('GET /js/stdlib-ref.json serves the generated reference', async () => {
      const res = await request('GET', '/js/stdlib-ref.json');
      assert.strictEqual(res.status, 200);
      assert.ok(/application\/json/.test(res.headers['content-type'] || ''));
      const payload = JSON.parse(res.body);
      assert.ok(payload.counts.modules >= 400, 'modules: ' + payload.counts.modules);
      assert.ok(payload.counts.functions >= 5000, 'functions: ' + payload.counts.functions);
      assert.ok(payload.modules.every((m) => Array.isArray(m.functions)));
      assert.ok(payload.modules.every((m) => m.tier === 'playground' || m.tier === 'docs' || m.tier === 'local'));
    });

    await okAsync('GET /js/limitations.json lists blocked lessons', async () => {
      const res = await request('GET', '/js/limitations.json');
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.ok(payload.lessons.length >= 1);
      assert.ok(payload.lessons.every((l) => l.id && l.reason));
      assert.ok(payload.lessons.every((l) => l.title));
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

      await okAsync('failure output surfaces the first diagnostic message', async () => {
        // A syntax error fails during the check stage, so no clang runs.
        const res = await request('POST', '/api/compile', { source: 'fn main( { }\n' });
        const payload = JSON.parse(res.body);
        assert.strictEqual(payload.success, false);
        assert.ok(payload.output.startsWith('Compilation failed:'), payload.output);
        const firstWithMessage = payload.diagnostics.find((d) => d.kind === 'error' && d.message);
        if (firstWithMessage) {
          const firstLine = String(firstWithMessage.message).split('\n')[0];
          assert.ok(payload.output.indexOf(firstLine) >= 0, 'missing "' + firstLine + '" in: ' + payload.output);
        }
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
    console.log('accounts (C2, mocked helper):');
    await okAsync('GET /api/auth/config reports unconfigured without env', async () => {
      const res = await request('GET', '/api/auth/config');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(JSON.parse(res.body).configured, false);
    });

    await okAsync('account routes require a session when unconfigured', async () => {
      assert.strictEqual((await request('GET', '/api/me')).status, 401);
      assert.strictEqual((await request('GET', '/api/progress')).status, 401);
      assert.strictEqual((await request('PUT', '/api/progress', { document: {} })).status, 401);
      assert.strictEqual((await request('GET', '/auth/github')).status, 503);
    });

    helper = await startMockHelper([
      { id: 101, login: 'alice', avatar_url: 'https://example.invalid/a.png' },
      { id: 202, login: 'bob', avatar_url: 'https://example.invalid/b.png' },
    ]);
    authChild = startServerWithEnv({
      GITHUB_CLIENT_ID: 'test-client-id',
      OAUTH_CALLBACK_URL: 'http://127.0.0.1:' + authPort + '/auth/github/callback',
      AUTH_HELPER_URL: 'http://127.0.0.1:' + helper.port,
      AUTH_HELPER_KEY: 'test-helper-key',
      SESSION_SECRET: 'test-session-secret-0123456789abcdef',
      PLAYGROUND_DATA_DIR: authDataDir,
      COOKIE_SECURE: '0',
    }, authPort);
    await waitForHealth(15000, authPort);

    let aliceCookie = null;
    let revision = null;
    const authEnv = () => ({
      GITHUB_CLIENT_ID: 'test-client-id',
      OAUTH_CALLBACK_URL: 'http://127.0.0.1:' + authPort + '/auth/github/callback',
      AUTH_HELPER_URL: 'http://127.0.0.1:' + helper.port,
      AUTH_HELPER_KEY: 'test-helper-key',
      SESSION_SECRET: 'test-session-secret-0123456789abcdef',
      PLAYGROUND_DATA_DIR: authDataDir,
      COOKIE_SECURE: '0',
    });

    await okAsync('GET /api/auth/config reports configured with env', async () => {
      const res = await requestTo(authPort, 'GET', '/api/auth/config');
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.configured, true);
      assert.strictEqual(payload.signedIn, false);
      assert.strictEqual(payload.user, null);
    });

    await okAsync('sign-in redirect carries client, scope, callback and signed state', async () => {
      const res = await requestTo(authPort, 'GET', '/auth/github');
      assert.strictEqual(res.status, 302);
      const location = res.headers.location;
      assert.ok(location.startsWith('https://github.com/login/oauth/authorize?'), location);
      const params = new URL(location).searchParams;
      assert.strictEqual(params.get('client_id'), 'test-client-id');
      assert.strictEqual(params.get('scope'), 'read:user');
      assert.strictEqual(params.get('redirect_uri'), authEnv().OAUTH_CALLBACK_URL);
      const state = params.get('state');
      assert.ok(state && state.split('.').length === 3, 'signed state expected');
      const callback = await requestTo(authPort, 'GET',
        '/auth/github/callback?code=code-1&state=' + encodeURIComponent(state));
      assert.strictEqual(callback.status, 302);
      assert.strictEqual(callback.headers.location, '/?auth=ok');
      const setCookie = (callback.headers['set-cookie'] || [])[0] || '';
      assert.ok(setCookie.startsWith('xiom_session='), setCookie);
      assert.ok(/HttpOnly/.test(setCookie) && /SameSite=Lax/.test(setCookie), setCookie);
      aliceCookie = setCookie.split(';')[0];
    });

    await okAsync('callback rejects a tampered state', async () => {
      const res = await requestTo(authPort, 'GET', '/auth/github/callback?code=code-1&state=aa.bb.cc');
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.location, '/?auth=error');
    });

    await okAsync('GET /api/me returns the signed-in user', async () => {
      const res = await requestTo(authPort, 'GET', '/api/me', undefined, { Cookie: aliceCookie });
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.user.login, 'alice');
      assert.strictEqual(payload.user.id, 101);
    });

    const progressDoc = {
      app: 'xiom-playground',
      version: 1,
      progress: { completed: ['L0-01', 'L0-01', 'L2-05'] },
      last: { id: 'L2-05', file: 'L2-data/L2-05.json', title: 'More Methods', t: 5 },
      history: { version: 1, lessons: { 'L2-05': [{ t: 5, ok: true, timeout: false, ms: 1200, out: 'ok' }] } },
    };

    await okAsync('PUT /api/progress stores a sanitized document', async () => {
      const res = await requestTo(authPort, 'PUT', '/api/progress',
        { baseRevision: null, document: progressDoc }, { Cookie: aliceCookie });
      assert.strictEqual(res.status, 200, res.body);
      const payload = JSON.parse(res.body);
      assert.ok(payload.revision);
      revision = payload.revision;
      const stored = JSON.parse(fs.readFileSync(path.join(authDataDir, 'accounts', '101.json'), 'utf8'));
      assert.deepStrictEqual(stored.document.progress.completed, ['L0-01', 'L2-05']);
      assert.strictEqual(stored.document.history.lessons['L2-05'].length, 1);
    });

    await okAsync('GET /api/progress round-trips with the revision', async () => {
      const res = await requestTo(authPort, 'GET', '/api/progress', undefined, { Cookie: aliceCookie });
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.revision, revision);
      assert.deepStrictEqual(payload.document.progress.completed, ['L0-01', 'L2-05']);
    });

    await okAsync('stale baseRevision returns 409 with the current document', async () => {
      const res = await requestTo(authPort, 'PUT', '/api/progress',
        { baseRevision: 'stale', document: { progress: { completed: [] } } }, { Cookie: aliceCookie });
      assert.strictEqual(res.status, 409);
      const payload = JSON.parse(res.body);
      assert.strictEqual(payload.error, 'revision_conflict');
      assert.strictEqual(payload.revision, revision);
      assert.ok(payload.document);
    });

    await okAsync('cross-origin PUT is rejected', async () => {
      const res = await requestTo(authPort, 'PUT', '/api/progress',
        { baseRevision: revision, document: progressDoc },
        { Cookie: aliceCookie, Origin: 'https://evil.example' });
      assert.strictEqual(res.status, 403);
    });

    await okAsync('second account cannot see the first account progress', async () => {
      const start = await requestTo(authPort, 'GET', '/auth/github');
      const state = new URL(start.headers.location).searchParams.get('state');
      const callback = await requestTo(authPort, 'GET',
        '/auth/github/callback?code=code-2&state=' + encodeURIComponent(state));
      const bobCookie = ((callback.headers['set-cookie'] || [])[0] || '').split(';')[0];
      assert.ok(bobCookie.startsWith('xiom_session='), 'bob session expected');
      const me = await requestTo(authPort, 'GET', '/api/me', undefined, { Cookie: bobCookie });
      assert.strictEqual(JSON.parse(me.body).user.login, 'bob');
      const progress = await requestTo(authPort, 'GET', '/api/progress', undefined, { Cookie: bobCookie });
      assert.strictEqual(progress.status, 200);
      assert.strictEqual(JSON.parse(progress.body).document, null);
    });

    await okAsync('logout clears the session cookie', async () => {
      const res = await requestTo(authPort, 'POST', '/auth/logout', undefined, { Cookie: aliceCookie });
      assert.strictEqual(res.status, 200);
      const setCookie = (res.headers['set-cookie'] || [])[0] || '';
      assert.ok(/xiom_session=;/.test(setCookie) && /Max-Age=0/.test(setCookie), setCookie);
    });

    await okAsync('DELETE /api/me removes stored progress', async () => {
      const start = await requestTo(authPort, 'GET', '/auth/github');
      const state = new URL(start.headers.location).searchParams.get('state');
      const callback = await requestTo(authPort, 'GET',
        '/auth/github/callback?code=code-3&state=' + encodeURIComponent(state));
      const cookie = ((callback.headers['set-cookie'] || [])[0] || '').split(';')[0];
      const del = await requestTo(authPort, 'DELETE', '/api/me', undefined, { Cookie: cookie });
      assert.strictEqual(del.status, 200);
      const progress = await requestTo(authPort, 'GET', '/api/progress', undefined, { Cookie: cookie });
      assert.strictEqual(JSON.parse(progress.body).document, null);
      assert.ok(!fs.existsSync(path.join(authDataDir, 'accounts', '101.json')));
    });

    await okAsync('PUT /api/progress rejects a missing document', async () => {
      const res = await requestTo(authPort, 'PUT', '/api/progress', { baseRevision: null }, { Cookie: aliceCookie });
      assert.strictEqual(res.status, 400);
    });
  } finally {
    stopServer(child);
    stopServer(authChild);
    if (helper) helper.server.close();
    fs.rmSync(authDataDir, { recursive: true, force: true });
  }

  console.log('');
  console.log('passed=' + passed + ' failed=' + failed + (skipped.length ? ' skipped=' + skipped.length : ''));
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('smoke tests failed: ' + ((err && err.stack) || err));
  process.exit(1);
});
