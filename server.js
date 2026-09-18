// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * XIOM Playground Server
 *
 * Executes user-submitted XIOM programs through the installed toolchain.
 * Invariants that matter for production:
 *   - every request gets its own work directory under a dedicated root, so
 *     the compiler's source-dir catalog scan never walks os.tmpdir();
 *   - compiles and checks run through a bounded queue (async spawn), so a
 *     slow submission cannot block static files or /api/health;
 *   - all child processes are killed as a process tree on timeout;
 *   - static files are confined to this directory (no traversal);
 *   - request bodies are capped.
 *
 * Endpoints:
 *   POST /api/compile   run a program (diagnostics + output + contracts)
 *   POST /api/check     type-check only (fast)
 *   POST /api/ir        LLVM IR
 *   POST /api/tokens    token stream
 *   POST /api/format    source formatter (when the toolchain supports it)
 *   GET  /api/lessons   lesson catalog
 *   GET  /api/version   app + toolchain + stdlib + wasm versions
 *   GET  /api/health    liveness + queue state (not queued)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { runProcess } = require('./lib/run-xiom');

const SERVER_VERSION = readRepoFile('package.json', (raw) => JSON.parse(raw).version) || '0.0.0';
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const SCRIPT_DIR = __dirname;
const XIOM_BIN = process.env.XIOM_BIN || path.join(SCRIPT_DIR, '..', 'target', 'debug', 'xiom' + (os.platform() === 'win32' ? '.exe' : ''));

// The playground directory is xiom-playground/, project root is one level up.
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
if (!process.env.XIOM_STDLIB) {
  const stdlibDir = path.join(PROJECT_ROOT, 'stdlib');
  if (fs.existsSync(stdlibDir)) process.env.XIOM_STDLIB = stdlibDir;
}

// Dedicated workspace root. The compiler indexes the source file's parent
// directory as a module catalog root, so submissions must never live
// directly in os.tmpdir(). Work root holds only per-request subdirectories.
const WORK_ROOT = path.join(os.tmpdir(), 'xiom_pg_work');
const MAX_BODY_BYTES = 512 * 1024;
const MAX_SOURCE_CHARS = 200 * 1024;
const CHECK_TIMEOUT_MS = Number(process.env.XIOM_CHECK_TIMEOUT_MS) || 15000;
const COMPILE_TIMEOUT_MS = Number(process.env.XIOM_COMPILE_TIMEOUT_MS) || 30000;
const MAX_CHECKS = Math.max(1, Number(process.env.MAX_CHECKS) || 2);
const MAX_COMPILES = Math.max(1, Number(process.env.MAX_COMPILES) || 1);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------------------
// Bounded async process execution
// ---------------------------------------------------------------------------

function createSemaphore(limit) {
  let active = 0;
  const waiting = [];
  const pump = () => {
    while (active < limit && waiting.length > 0) {
      const start = waiting.shift();
      active++;
      start(() => {
        active--;
        pump();
      });
    }
  };
  return function schedule(task) {
    return new Promise((resolve, reject) => {
      waiting.push((release) => {
        Promise.resolve()
          .then(task)
          .then((value) => { release(); resolve(value); }, (err) => { release(); reject(err); });
      });
      pump();
    });
  };
}

const scheduleCheck = createSemaphore(MAX_CHECKS);
const scheduleCompile = createSemaphore(MAX_COMPILES);
const queueState = { checksPending: 0, compilesPending: 0 };

function runCheckJob(task) {
  queueState.checksPending++;
  return scheduleCheck(task).finally(() => { queueState.checksPending--; });
}

function runCompileJob(task) {
  queueState.compilesPending++;
  return scheduleCompile(task).finally(() => { queueState.compilesPending--; });
}

function runXiom(args, options) {
  return runProcess(XIOM_BIN, args, options);
}

// ---------------------------------------------------------------------------
// Request workspaces
// ---------------------------------------------------------------------------

async function withWorkDir(task) {
  await fsp.mkdir(WORK_ROOT, { recursive: true });
  const dir = await fsp.mkdtemp(path.join(WORK_ROOT, 'job-'));
  try {
    return await task(dir);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function writeSource(dir, source) {
  const file = path.join(dir, 'main.xi');
  fs.writeFileSync(file, source, 'utf8');
  return file;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

function parseDiagnostics(stderr) {
  const diagnostics = [];
  const seen = new Set();
  for (const rawLine of String(stderr || '').split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const structured = line.match(/^(error|warning)\[([A-Za-z]\d+)\]:\s*(\d+):(\d+):\s*(.*)$/);
    if (structured) {
      const key = structured[0];
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push({
        code: structured[2],
        kind: structured[1] === 'warning' ? 'warning' : 'error',
        line: Number(structured[3]),
        col: Number(structured[4]),
        message: structured[5].trim(),
      });
      continue;
    }
    const plain = line.match(/^(error|warning):\s*(.+)$/);
    if (plain && !/^error: compilation failed/.test(line)) {
      const key = line;
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push({
        code: plain[1] === 'warning' ? 'W000' : 'E000',
        kind: plain[1] === 'warning' ? 'warning' : 'error',
        line: 0,
        col: 0,
        message: plain[2].trim(),
      });
    }
  }
  return diagnostics;
}

function failureOutput(diagnostics, proc) {
  const errors = diagnostics.filter((d) => d.kind === 'error');
  if (proc && proc.timedOut) {
    return 'Compilation timed out. Try a smaller program.';
  }
  if (errors.length > 0) {
    return 'Compilation failed: ' + errors.length + ' error(s).\nCheck the Diagnostics tab for details.';
  }
  const firstLine = String(proc && proc.stderr || '').split(/\r?\n/).find((l) => l.trim() && !/^(compiled|exit code):/.test(l.trim()));
  return firstLine ? firstLine.trim() : 'Compilation failed.';
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

async function checkProgram(source) {
  return withWorkDir(async (dir) => {
    const file = writeSource(dir, source);
    const started = Date.now();
    const proc = await runXiom(['--check', file], { cwd: dir, timeoutMs: CHECK_TIMEOUT_MS });
    return {
      success: proc.success,
      diagnostics: parseDiagnostics(proc.stderr),
      output: proc.stderr.trim() || (proc.success ? 'OK' : 'Failed'),
      timedOut: proc.timedOut,
      elapsedMs: Date.now() - started,
    };
  });
}

async function runProgram(source) {
  return withWorkDir(async (dir) => {
    const file = writeSource(dir, source);
    const started = Date.now();
    const proc = await runXiom(['run', file], { cwd: dir, timeoutMs: COMPILE_TIMEOUT_MS });
    const result = {
      success: proc.success,
      stages: {},
      ir: null,
      diagnostics: parseDiagnostics(proc.stderr),
      tokens: null,
      contracts: null,
      output: proc.stdout ? proc.stdout.trim() : '',
      runOutput: null,
      runError: null,
      timedOut: proc.timedOut,
      elapsedMs: Date.now() - started,
    };

    if (!proc.success) {
      result.output = failureOutput(result.diagnostics, proc);
      result.runError = result.output;
    } else if (!result.output) {
      result.output = 'Program ran with no output.';
    }
    if (proc.success) result.runOutput = result.output;

    if (source.includes('requires:') || source.includes('ensures:') || source.includes('invariant:')) {
      const verify = await runXiom(['--verify', file], { cwd: dir, timeoutMs: CHECK_TIMEOUT_MS });
      result.contracts = verify.stdout.trim() || verify.stderr.trim() || 'Contract verification returned no output.';
      result.stages.verify = { success: verify.success, output: result.contracts };
    }
    return result;
  });
}

async function emitStage(source, flag) {
  return withWorkDir(async (dir) => {
    const file = writeSource(dir, source);
    const started = Date.now();
    const proc = await runXiom([flag, file], { cwd: dir, timeoutMs: CHECK_TIMEOUT_MS });
    return {
      success: proc.success,
      output: proc.stdout ? proc.stdout.replace(/\x1b\[[0-9;]*m/g, '') : null,
      error: proc.stderr ? proc.stderr.trim() : null,
      timedOut: proc.timedOut,
      elapsedMs: Date.now() - started,
    };
  });
}

// The v0.60.x CLI does not implement `fmt`; probe once and cache the result so
// the endpoint degrades with a clear message instead of a toolchain stderr.
let formatProbe = null;
function formatAvailable() {
  if (!formatProbe) {
    formatProbe = withWorkDir(async (dir) => {
      const file = writeSource(dir, 'fn main() { }\n');
      const proc = await runXiom(['fmt', file], { cwd: dir, timeoutMs: 5000 });
      if (proc.success && proc.stdout.trim()) return { ok: true };
      const reason = (proc.stderr.trim() || 'formatter unavailable').split(/\r?\n/)[0];
      return { ok: false, reason };
    }).catch((err) => ({ ok: false, reason: String(err && err.message || err) }));
  }
  return formatProbe;
}

async function formatSource(source) {
  const capability = await formatAvailable();
  if (!capability.ok) {
    return { formatted: null, error: 'Source formatting is not available in this toolchain (' + capability.reason + ').' };
  }
  return withWorkDir(async (dir) => {
    const file = writeSource(dir, source);
    const proc = await runXiom(['fmt', file], { cwd: dir, timeoutMs: CHECK_TIMEOUT_MS });
    if (proc.success && proc.stdout.trim()) return { formatted: proc.stdout };
    return { formatted: null, error: proc.stderr.trim() || 'Format failed.' };
  });
}

// ---------------------------------------------------------------------------
// Version metadata
// ---------------------------------------------------------------------------

function readRepoFile(relativePath, transform) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
    return transform ? transform(raw) : raw.trim();
  } catch {
    return null;
  }
}

function readToolchainVersion() {
  const candidates = [
    process.env.XIOM_TOOLCHAIN_VERSION,
    path.join(path.dirname(XIOM_BIN), '..', '.mirror-tag'),
    path.join(SCRIPT_DIR, 'TOOLCHAIN_VERSION'),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const value = fs.readFileSync(candidate, 'utf8').trim().split(/\r?\n/)[0].trim();
      if (value) return value;
    } catch { /* next candidate */ }
  }
  return 'unknown';
}

function readStdlibVersion() {
  const stdlib = process.env.XIOM_STDLIB;
  if (!stdlib) return 'unknown';
  try {
    const manifest = fs.readFileSync(path.join(stdlib, 'package.xi'), 'utf8');
    const match = manifest.match(/version:\s*"([^"]+)"/);
    const name = manifest.match(/package\s+([A-Za-z0-9_]+)/);
    // The v0.60.1 archive shipped the benchmark manifest in lib/package.xi;
    // only trust the version when the root package is actually the stdlib.
    if (name && !/std/i.test(name[1])) return 'unknown';
    if (match) return match[1];
    if (name) return name[1];
  } catch { /* package.xi moved or missing */ }
  return 'unknown';
}

let stdlibModuleCount = null;
function countStdlibModules() {
  if (stdlibModuleCount !== null) return stdlibModuleCount;
  stdlibModuleCount = 0;
  const root = process.env.XIOM_STDLIB;
  if (!root) return stdlibModuleCount;
  const seen = new Set();
  const stack = [path.join(root, 'xiom')];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.name.endsWith('.xi')) {
        try {
          const head = fs.readFileSync(entryPath, 'utf8').slice(0, 2048);
          const declared = head.match(/module\s+(xiom[\w.]*)/);
          if (declared) stdlibModuleCount = seen.add(declared[1]).size;
        } catch { /* unreadable module */ }
      }
    }
  }
  return stdlibModuleCount;
}

function versionPayload() {
  return {
    server: SERVER_VERSION,
    toolchain: readToolchainVersion(),
    stdlib: readStdlibVersion(),
    stdlibModules: countStdlibModules(),
    wasm: readRepoFile('WASM_VERSION') || 'unknown',
    node: process.version,
  };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return; // drain the rest without buffering
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
  if (!parsed || typeof parsed !== 'object') {
    throw Object.assign(new Error('JSON body must be an object'), { statusCode: 400 });
  }
  return parsed;
}

function sourceOf(body) {
  const source = body.source;
  if (typeof source !== 'string') {
    throw Object.assign(new Error('Field "source" must be a string'), { statusCode: 400 });
  }
  if (source.length > MAX_SOURCE_CHARS) {
    throw Object.assign(new Error('Source exceeds ' + MAX_SOURCE_CHARS + ' characters'), { statusCode: 413 });
  }
  return source;
}

function sendJson(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
}

function sendError(res, err) {
  const status = err && err.statusCode ? err.statusCode : 500;
  sendJson(res, status, { success: false, error: String(err && err.message || err) });
}

function serveFile(res, method, filePath) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    const immutable = extension === '.wasm' || extension === '.png' || extension === '.ico' || extension === '.svg';
    const headers = {
      'Content-Type': MIME[extension] || 'application/octet-stream',
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': immutable ? 'public, max-age=86400' : 'no-cache',
    };
    if (method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Read error');
    });
    res.writeHead(200, headers);
    stream.pipe(res);
  });
}

function resolveStaticPath(requestUrl) {
  const rawPath = String(requestUrl || '/').split('?')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment.startsWith('.'))) return null;
  const relative = segments.length === 0 ? 'index.html' : segments.join('/');
  const resolved = path.resolve(SCRIPT_DIR, relative);
  if (resolved !== SCRIPT_DIR && !resolved.startsWith(SCRIPT_DIR + path.sep)) return null;
  return resolved;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || 'GET';
    const url = String(req.url || '/');

    if (method === 'OPTIONS') {
      res.writeHead(204, { 'Allow': 'GET, HEAD, POST, OPTIONS' });
      res.end();
      return;
    }

    if (url === '/api/health' && (method === 'GET' || method === 'HEAD')) {
      sendJson(res, 200, {
        status: 'ok',
        server: SERVER_VERSION,
        uptimeSeconds: Math.round(process.uptime()),
        queue: { checksPending: queueState.checksPending, compilesPending: queueState.compilesPending },
      });
      return;
    }

    if (url === '/api/version' && method === 'GET') {
      const format = await formatAvailable();
      const payload = Object.assign(versionPayload(), {
        capabilities: { format: format.ok },
      });
      sendJson(res, 200, payload);
      return;
    }

    if (url === '/api/lessons' && method === 'GET') {
      try {
        const catalog = await fsp.readFile(path.join(SCRIPT_DIR, 'lessons', 'index.json'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(catalog) });
        res.end(catalog);
      } catch {
        sendJson(res, 404, { error: 'Lesson catalog not found' });
      }
      return;
    }

    if (method === 'POST' && (url === '/api/compile' || url === '/api/check' || url === '/api/ir' || url === '/api/tokens' || url === '/api/format')) {
      const body = await readJson(req);
      const source = sourceOf(body);

      if (url === '/api/check') {
        const result = await runCheckJob(() => checkProgram(source));
        sendJson(res, 200, result);
        return;
      }
      if (url === '/api/compile') {
        const result = await runCompileJob(() => runProgram(source));
        sendJson(res, 200, result);
        return;
      }
      if (url === '/api/ir' || url === '/api/tokens') {
        const flag = url === '/api/tokens' ? '--emit-tokens' : '--emit-ir';
        const result = await runCompileJob(() => emitStage(source, flag));
        sendJson(res, 200, result);
        return;
      }
      const result = await runCheckJob(() => formatSource(source));
      sendJson(res, 200, result);
      return;
    }

    if (method === 'GET' || method === 'HEAD') {
      const filePath = resolveStaticPath(url);
      if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      serveFile(res, method, filePath);
      return;
    }

    if (url.startsWith('/api/')) {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    if (!res.headersSent) sendError(res, err);
    else res.end();
  }
});

// Defensive: a stray .xi file directly in WORK_ROOT would make the compiler
// treat WORK_ROOT as a module catalog root for every submission.
function prepareWorkRoot() {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  for (const entry of fs.readdirSync(WORK_ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.xi')) {
      try { fs.unlinkSync(path.join(WORK_ROOT, entry.name)); } catch { /* best effort */ }
    }
  }
}

prepareWorkRoot();

server.listen(PORT, HOST, () => {
  console.log('XIOM Playground Server v' + SERVER_VERSION);
  console.log('URL: http://' + HOST + ':' + PORT);
  console.log('Compiler: ' + XIOM_BIN + ' (' + (fs.existsSync(XIOM_BIN) ? 'found' : 'NOT FOUND') + ')');
  console.log('Stdlib: ' + (process.env.XIOM_STDLIB || '(toolchain default)'));
  console.log('Work root: ' + WORK_ROOT + ' (jobs: ' + MAX_COMPILES + ', checks: ' + MAX_CHECKS + ')');
  console.log('Endpoints: /api/compile, /api/check, /api/ir, /api/tokens, /api/format, /api/lessons, /api/version, /api/health');
});

function shutdown(signal) {
  console.log('Received ' + signal + ', shutting down.');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
