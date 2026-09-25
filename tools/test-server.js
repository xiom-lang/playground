// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
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
const crypto = require('crypto');
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

/**
 * Mock of the host-side auth/state helper. `/exchange` keeps the legacy
 * response and (P2) also mints an opaque session token; `/session`,
 * `/session/logout` and `/progress` back the container's helper mode with
 * in-memory sessions and documents.
 */
function startMockHelper(users) {
  let index = 0;
  const sessions = new Map(); // token -> { user, expiresAt }
  const docs = new Map();     // userId -> { revision, updated, document }
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const json = (status, payload) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
      const token = bearer ? bearer[1] : null;
      const session = token ? sessions.get(token) : null;

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
        const minted = 'tok-' + crypto.randomBytes(12).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
        sessions.set(minted, { user, expiresAt });
        json(200, { ok: true, token: minted, expiresAt, user });
        return;
      }

      if (req.method === 'GET' && req.url === '/session') {
        if (!session) {
          json(401, { ok: false, error: 'invalid session' });
          return;
        }
        json(200, { ok: true, user: session.user, expiresAt: session.expiresAt });
        return;
      }

      if (req.method === 'POST' && req.url === '/session/logout') {
        if (token) sessions.delete(token);
        json(200, { ok: true });
        return;
      }

      if (req.url === '/progress') {
        if (!session) {
          json(401, { ok: false, error: 'invalid session' });
          return;
        }
        const id = session.user.id;
        const stored = docs.get(id) || null;
        if (req.method === 'GET') {
          if (!stored) {
            json(200, { ok: true, found: false });
            return;
          }
          json(200, {
            ok: true,
            found: true,
            revision: stored.revision,
            updated: stored.updated,
            document: stored.document,
          });
          return;
        }
        if (req.method === 'PUT') {
          let parsed = null;
          try { parsed = JSON.parse(body); } catch { parsed = null; }
          if (!parsed || !parsed.document || typeof parsed.document !== 'object') {
            json(400, { ok: false, error: 'bad body' });
            return;
          }
          const expected = parsed.baseRevision === undefined || parsed.baseRevision === null
            ? null
            : String(parsed.baseRevision);
          if (stored && String(stored.revision) !== expected) {
            json(409, {
              ok: false,
              error: 'revision mismatch',
              revision: stored.revision,
              updated: stored.updated,
              document: stored.document,
            });
            return;
          }
          const record = {
            revision: 'rev-' + crypto.randomBytes(8).toString('hex'),
            updated: new Date().toISOString(),
            document: parsed.document,
          };
          docs.set(id, record);
          json(200, { ok: true, revision: record.revision, updated: record.updated });
          return;
        }
        if (req.method === 'DELETE') {
          docs.delete(id);
          json(200, { ok: true });
          return;
        }
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

  // P1: on Linux with the wrapper built, start the server in require mode and
  // stage the toolchain under /tmp (the only read-write path the Landlock
  // policy allows). Windows skips execution entirely, so it starts with the
  // sandbox off and the other sandbox assertions are skipped.
  const sandboxBin = process.env.XIOM_SANDBOX_BIN || path.join(REPO, 'sandbox', 'xiom-sandbox');
  const sandboxMode = process.platform === 'linux' &&
    process.env.XIOM_SANDBOX !== 'off' &&
    fs.existsSync(XIOM_BIN) &&
    fs.existsSync(sandboxBin);
  let sandboxToolchain = null;
  const serverEnv = { XIOM_TEST_CANARY: 'canary-do-not-leak' };
  if (sandboxMode) {
    sandboxToolchain = process.env.XIOM_TEST_SANDBOX_TOOLCHAIN || path.join(os.tmpdir(), 'xiom-toolchain');
    if (!fs.existsSync(path.join(sandboxToolchain, 'bin', 'xiom'))) {
      fs.rmSync(sandboxToolchain, { recursive: true, force: true });
      fs.cpSync(path.dirname(path.dirname(XIOM_BIN)), sandboxToolchain, { recursive: true });
    }
    serverEnv.XIOM_SANDBOX = 'require';
    serverEnv.XIOM_SANDBOX_BIN = sandboxBin;
    serverEnv.XIOM_BIN = path.join(sandboxToolchain, 'bin', 'xiom');
    serverEnv.XIOM_STDLIB = path.join(sandboxToolchain, 'lib');
  } else {
    serverEnv.XIOM_SANDBOX = 'off';
  }

  // The canary proves that user programs cannot read the server's own
  // environment (see the env-scrub test in the execution block).
  const child = startServerWithEnv(serverEnv, PORT);
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

    await okAsync('GET /js/limitations.json matches the baseline blocked set', async () => {
      const res = await request('GET', '/js/limitations.json');
      assert.strictEqual(res.status, 200);
      const payload = JSON.parse(res.body);
      assert.ok(Array.isArray(payload.lessons));
      const baseline = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'lesson-baseline.json'), 'utf8'));
      const expected = ((baseline.known && baseline.known.runtime) || []).slice().sort();
      assert.deepStrictEqual(payload.lessons.map((lesson) => lesson.id).sort(), expected);
      assert.ok(payload.lessons.every((lesson) => lesson.id && lesson.reason && lesson.title));
    });

    await okAsync('runtime requires live inside the Docker build context', async () => {
      // The runtime image excludes tools/ and docs/ (see .dockerignore), so a
      // require from server.js that resolves into an ignored path crashes the
      // deployed container at startup with an nginx 500. Walk the require
      // graph and fail when any resolved file would be missing.
      const ignored = fs.readFileSync(path.join(REPO, '.dockerignore'), 'utf8')
        .split(/\r?\n/).map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
      const patternToRegExp = (pattern) => new RegExp(
        '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '(?:/|$)'
      );
      const required = new Set();
      const visit = (file) => {
        const source = fs.readFileSync(file, 'utf8');
        const re = /require\((['"])(\.[^'"]+)\1\)/g;
        let match;
        while ((match = re.exec(source)) !== null) {
          let resolved;
          try { resolved = require.resolve(path.resolve(path.dirname(file), match[2])); } catch { continue; }
          if (required.has(resolved)) continue;
          required.add(resolved);
          if (resolved.endsWith('.js')) visit(resolved);
        }
      };
      visit(path.join(REPO, 'server.js'));
      const violations = [];
      for (const file of required) {
        const relative = path.relative(REPO, file).replace(/\\/g, '/');
        for (const pattern of ignored) {
          if (patternToRegExp(pattern).test(relative)) {
            violations.push(relative + ' (excluded by "' + pattern + '")');
            break;
          }
        }
      }
      assert.deepStrictEqual(violations, [], 'server requires files excluded from the image');
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

        await okAsync('POST /api/compile reports a crashed run, not empty output', async () => {
          // Mutually recursive functions with no base case compile, then die
          // in the runtime fault trap: the Linux driver exits 0 with
          // `exit code: -1` on stderr, Windows reports 0xC000001D on the
          // process. The runner must name the crash.
          const source = 'fn a() { b(); }\nfn b() { a(); }\nfn main() { a(); }\n';
          const res = await request('POST', '/api/compile', { source });
          assert.strictEqual(res.status, 200);
          const payload = JSON.parse(res.body);
          assert.strictEqual(payload.success, false, JSON.stringify(payload));
          assert.ok(/Program crashed \(exit code /.test(payload.output), 'unexpected output: ' + payload.output);
          assert.ok(payload.output.indexOf('ran with no output') === -1, payload.output);
        });

        await okAsync('POST /api/compile scrubs the server env from programs', async () => {
          // The server is started with XIOM_TEST_CANARY in its environment
          // (see startServerWithEnv below); a submitted program must not be
          // able to read it through io.env_var or any getenv-based helper.
          const source = 'use xiom.io;\nfn main() {\n  match io.env_var("XIOM_TEST_CANARY") {\n    Some(v) => io.println("leaked:" + v),\n    None => io.println("env-scrubbed"),\n  }\n}\n';
          const res = await request('POST', '/api/compile', { source });
          assert.strictEqual(res.status, 200);
          const payload = JSON.parse(res.body);
          assert.strictEqual(payload.success, true, JSON.stringify(payload.diagnostics));
          assert.ok(payload.output.indexOf('env-scrubbed') >= 0, 'unexpected output: ' + payload.output);
          assert.ok(payload.output.indexOf('canary-do-not-leak') === -1, 'server env leaked: ' + payload.output);
        });

        if (sandboxMode) {
          await okAsync('GET /api/health reports the Landlock sandbox', async () => {
            const res = await request('GET', '/api/health');
            assert.strictEqual(res.status, 200);
            const payload = JSON.parse(res.body);
            assert.strictEqual(payload.sandbox.mode, 'require', JSON.stringify(payload.sandbox));
            assert.strictEqual(payload.sandbox.active, true, JSON.stringify(payload.sandbox));
            assert.ok(payload.sandbox.landlock >= 3, JSON.stringify(payload.sandbox));
          });

          await okAsync('POST /api/compile confines submissions (files, proc, shell)', async () => {
            // A canary outside the allowlist (with /data preferred when it
            // exists) that a sandboxed submission must not be able to read or
            // write, plus /proc and a spawned shell. TCP is verified at the
            // kernel level by tools/verify-sandbox.js: the stdlib's
            // tcp_connect reports Ok even on failure, so it cannot be used
            // as a probe here.
            const escapeDir = fs.existsSync('/data') ? '/data' : '/var/tmp';
            const escapeRoot = path.join(escapeDir, 'xiom-pg-sandbox-test');
            let canary = null;
            try {
              fs.mkdirSync(escapeRoot, { recursive: true });
              canary = path.join(escapeRoot, 'canary.txt');
              fs.writeFileSync(canary, 'sandbox-canary', 'utf8');
            } catch {
              canary = null;
            }
            const source = [
              'use xiom.io;',
              'use xiom.process;',
              'fn main() {',
              canary
                ? '  match io.read_file(' + JSON.stringify(canary) + ') { Ok(s) => io.println("escape=LEAK"), Err(e) => io.println("escape=denied") }'
                : '  io.println("escape=skipped")',
              '  match io.read_file("/proc/self/status") { Ok(s) => io.println("proc=LEAK"), Err(e) => io.println("proc=denied") }',
              '  match io.write_file("/tmp/xiom-pg-sandbox-control.txt", "ok") { Ok(u) => io.println("tmp=ok"), Err(e) => io.println("tmp=FAIL") }',
              '  let args = Vec[Str].new();',
              '  args.push("-c");',
              '  args.push("cat /proc/self/status > /tmp/xiom-pg-sandbox-spawn.txt 2>/dev/null");',
              '  match process.spawn_command("sh", &args) { Ok(p) => io.println("spawn=ok"), Err(e) => io.println("spawn=err") }',
              '  match io.read_file("/tmp/xiom-pg-sandbox-spawn.txt") { Ok(s) => { if s.len() == 0 { io.println("spawnproc=denied") } else { io.println("spawnproc=LEAK") } }, Err(e) => io.println("spawnproc=denied") }',
              '}',
              '',
            ].join('\n');
            const res = await request('POST', '/api/compile', { source });
            assert.strictEqual(res.status, 200);
            const payload = JSON.parse(res.body);
            assert.strictEqual(payload.success, true, JSON.stringify(payload.diagnostics));
            const out = payload.output;
            assert.ok(out.indexOf('proc=denied') >= 0, 'proc not denied: ' + out);
            assert.ok(out.indexOf('tmp=ok') >= 0, 'tmp write failed: ' + out);
            assert.ok(out.indexOf('spawnproc=denied') >= 0, 'spawned shell leaked /proc: ' + out);
            if (canary) assert.ok(out.indexOf('escape=denied') >= 0, 'escape canary reachable: ' + out);
          });
        } else {
          skipped.push('sandbox execution tests (Linux + sandbox/xiom-sandbox required)');
          console.log('  skip sandbox tests (build sandbox/xiom-sandbox on Linux to enable)');
        }

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

    // --- P2 helper mode: opaque sessions and host-side progress -----------
    const helperStatePort = PORT + 173;
    const helperStateChild = startServerWithEnv({
      PLAYGROUND_STATE: 'helper',
      GITHUB_CLIENT_ID: 'test-client-id',
      OAUTH_CALLBACK_URL: 'http://127.0.0.1:' + helperStatePort + '/auth/github/callback',
      AUTH_HELPER_URL: 'http://127.0.0.1:' + helper.port,
      AUTH_HELPER_KEY: 'test-helper-key',
      COOKIE_SECURE: '0',
      XIOM_SANDBOX: 'off',
    }, helperStatePort);
    try {
      const stateDeadline = Date.now() + 15000;
      for (;;) {
        try {
          const res = await requestTo(helperStatePort, 'GET', '/api/health');
          if (res.status === 200) break;
        } catch { /* still starting */ }
        if (Date.now() > stateDeadline) throw new Error('helper-mode server did not start');
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      let stateCookie = null;

      await okAsync('helper mode signs in with an opaque session token', async () => {
        const start = await requestTo(helperStatePort, 'GET', '/auth/github');
        const state = new URL(start.headers.location).searchParams.get('state');
        const callback = await requestTo(helperStatePort, 'GET',
          '/auth/github/callback?code=code-h1&state=' + encodeURIComponent(state));
        assert.strictEqual(callback.status, 302);
        assert.strictEqual(callback.headers.location, '/?auth=ok');
        const setCookie = (callback.headers['set-cookie'] || [])[0] || '';
        const value = setCookie.split(';')[0].replace('xiom_session=', '');
        assert.ok(value.startsWith('tok-'), setCookie);
        assert.ok(value.indexOf('.') === -1, 'opaque token expected: ' + value);
        stateCookie = setCookie.split(';')[0];
      });

      await okAsync('helper mode resolves /api/me through the helper', async () => {
        const res = await requestTo(helperStatePort, 'GET', '/api/me', undefined, { Cookie: stateCookie });
        assert.strictEqual(res.status, 200);
        const payload = JSON.parse(res.body);
        assert.ok(payload.user && typeof payload.user.login === 'string' && payload.user.login.length > 0, res.body);
      });

      await okAsync('helper mode progress round-trips and conflicts', async () => {
        const put = await requestTo(helperStatePort, 'PUT', '/api/progress',
          { baseRevision: null, document: { progress: { completed: ['L0-01'] } } },
          { Cookie: stateCookie });
        assert.strictEqual(put.status, 200, put.body);
        const revision = JSON.parse(put.body).revision;
        assert.ok(revision);
        const get = await requestTo(helperStatePort, 'GET', '/api/progress', undefined, { Cookie: stateCookie });
        assert.strictEqual(get.status, 200);
        assert.strictEqual(JSON.parse(get.body).revision, revision);
        const stale = await requestTo(helperStatePort, 'PUT', '/api/progress',
          { baseRevision: 'stale', document: { progress: { completed: [] } } },
          { Cookie: stateCookie });
        assert.strictEqual(stale.status, 409, stale.body);
        assert.ok(JSON.parse(stale.body).document, stale.body);
        const del = await requestTo(helperStatePort, 'DELETE', '/api/me', undefined, { Cookie: stateCookie });
        assert.strictEqual(del.status, 200, del.body);
        const after = await requestTo(helperStatePort, 'GET', '/api/progress', undefined, { Cookie: stateCookie });
        assert.strictEqual(after.status, 401, 'session must be revoked after DELETE /api/me');
      });

      await okAsync('helper mode rejects a forged cookie', async () => {
        const res = await requestTo(helperStatePort, 'GET', '/api/me', undefined,
          { Cookie: 'xiom_session=tok-000000000000000000000000' });
        assert.strictEqual(res.status, 401);
      });

      await okAsync('helper mode logout revokes the token host-side', async () => {
        const start = await requestTo(helperStatePort, 'GET', '/auth/github');
        const state = new URL(start.headers.location).searchParams.get('state');
        const callback = await requestTo(helperStatePort, 'GET',
          '/auth/github/callback?code=code-h2&state=' + encodeURIComponent(state));
        const cookie = ((callback.headers['set-cookie'] || [])[0] || '').split(';')[0];
        const logout = await requestTo(helperStatePort, 'POST', '/auth/logout', undefined, { Cookie: cookie });
        assert.strictEqual(logout.status, 200);
        const me = await requestTo(helperStatePort, 'GET', '/api/me', undefined, { Cookie: cookie });
        assert.strictEqual(me.status, 401, 'revoked session must not resolve');
      });
    } finally {
      stopServer(helperStateChild);
    }

    // --- P3: per-IP rate limiting (own server with tight limits) -----------
    const ratePort = PORT + 271;
    const rateChild = startServerWithEnv({
      XIOM_SANDBOX: 'off',
      RATE_LIMIT_BURST: '2',
      RATE_LIMIT_REFILL_MS: '60000',
    }, ratePort);
    try {
      const deadline = Date.now() + 15000;
      for (;;) {
        try {
          const health = await requestTo(ratePort, 'GET', '/api/health');
          if (health.status === 200) break;
        } catch { /* still starting */ }
        if (Date.now() > deadline) throw new Error('rate-limit server did not start');
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      await okAsync('rate limits the compiler endpoints per client IP', async () => {
        const statuses = [];
        let limited = null;
        for (let i = 0; i < 3; i++) {
          const res = await requestTo(ratePort, 'POST', '/api/check', { source: 'fn main( { }\n' });
          statuses.push(res.status);
          if (res.status === 429) {
            limited = JSON.parse(res.body);
            assert.ok(res.headers['retry-after'], 'Retry-After header expected');
          }
        }
        assert.deepStrictEqual(statuses.slice(0, 2), [200, 200], 'first two requests: ' + statuses);
        assert.strictEqual(statuses[2], 429, 'third request should be limited: ' + statuses);
        assert.strictEqual(limited.error, 'rate_limited');
        assert.ok(limited.retryAfterMs > 0 && limited.retryAfterMs <= 60000, JSON.stringify(limited));
        assert.strictEqual(limited.success, false);
        assert.ok(limited.output.indexOf('Too many requests') >= 0, JSON.stringify(limited));
      });

      await okAsync('GET /api/health exposes queue and rate-limit counters', async () => {
        const res = await requestTo(ratePort, 'GET', '/api/health');
        assert.strictEqual(res.status, 200);
        const payload = JSON.parse(res.body);
        assert.strictEqual(payload.counters.check, 2, JSON.stringify(payload.counters));
        assert.strictEqual(payload.counters.rateLimited, 1, JSON.stringify(payload.counters));
        assert.strictEqual(payload.rateLimit.burst, 2);
        assert.ok(payload.queue && payload.queue.checksPending >= 0, JSON.stringify(payload.queue));
      });
    } finally {
      stopServer(rateChild);
    }
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
