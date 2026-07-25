/**
 * XIOM Playground Server v0.49.9
 * Multi-stage compilation: tokens, AST, IR, diagnostics, contracts.
 * Each stage is independently accessible so output tabs show real data.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const CACHE_DIR = path.join(os.tmpdir(), 'xiom_pg_cache');

const PORT = 3000;
const HOST = 'localhost';
const SCRIPT_DIR = __dirname;
const XIOM_BIN = process.env.XIOM_BIN || path.join(SCRIPT_DIR, '..', 'target', 'debug', 'xiom' + (os.platform() === 'win32' ? '.exe' : ''));

// Ensure xiom can find the stdlib and runtime when called from the playground server.
// The playground directory is xiom-playground/, project root is one level up.
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
if (!process.env.XIOM_STDLIB) {
  const stdlibDir = path.join(PROJECT_ROOT, 'stdlib');
  if (fs.existsSync(stdlibDir)) {
    process.env.XIOM_STDLIB = stdlibDir;
  }
}

const MIME = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.ico':'image/x-icon' };

function serveFile(res, filepath) {
  const ext = path.extname(filepath); const mime = MIME[ext] || 'application/octet-stream';
  try { const data = fs.readFileSync(filepath); res.writeHead(200,{'Content-Type':mime,'Content-Length':data.length}); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
}

function parseDiagnostics(stderr) {
  const diags = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/\[(\w+)\]\s*(\d+):(\d+):\s*(.+)/);
    if (m) diags.push({ code:m[1], kind:m[1].startsWith('W')?'warning':'error', line:+m[2], col:+m[3], message:m[4] });
    else if (line.match(/^(error|warning)/i)) diags.push({ code:'E001', kind:'error', line:0, col:0, message:line.trim() });
  }
  return diags;
}

function runXiom(args, stdin) {
  try {
    const proc = spawnSync(XIOM_BIN, args, { timeout:15000, encoding:'utf-8', env: process.env, input: stdin || undefined });
    return { success: proc.status === 0, stdout: proc.stdout?.trim() || '', stderr: proc.stderr?.trim() || '' };
  } catch(e) {
    return { success: false, stdout: '', stderr: e.message };
  }
}

function compileAllStages(source) {
  const tmp = path.join(os.tmpdir(), `xiom_pg_${Date.now()}.xi`);
  const exe = tmp.replace(/\.xi$/, os.platform() === 'win32' ? '.exe' : '');
  fs.writeFileSync(tmp, source);

  const result = {
    success: false,
    stages: {},
    ir: null,
    diagnostics: [],
    tokens: null,
    contracts: null,
    output: '',
    runOutput: null,
    runError: null,
  };

  try {
    // Check cache first — re-runs of unchanged code are instant
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const hash = crypto.createHash('sha256').update(source).digest('hex');
    const cachedExe = path.join(CACHE_DIR, hash + (os.platform() === 'win32' ? '.exe' : ''));

    if (fs.existsSync(cachedExe)) {
      const runProc = spawnSync(cachedExe, [], { timeout: 5000, encoding: 'utf-8' });
      result.success = true;
      result.output = (runProc.stdout || '').trim() || 'Program ran with no output.';
      result.runOutput = result.output;
      return result;
    }

    // No cache — compile + cache + run
    const proc = runXiom(['run', tmp]);
    result.success = proc.success;
    result.diagnostics = parseDiagnostics(proc.stderr);
    result.output = proc.stdout ? proc.stdout.trim() : '';

    if (!result.success) {
      const errs = result.diagnostics.filter(d => d.kind === 'error');
      result.output = errs.length > 0
        ? 'Compilation failed: ' + errs.length + ' error(s).\nCheck the Diagnostics tab for details.'
        : (proc.stderr ? proc.stderr.trim() : 'Compilation failed.');
    } else if (!result.output) {
      result.output = 'Program ran with no output.';
    }

    if (result.output) result.runOutput = result.output;

    // Cache binary for instant re-runs of same code
    if (result.success) {
      try {
        const buildBin = runXiom(['build', tmp, '-o', cachedExe]);
        if (!buildBin.success) { try { fs.unlinkSync(cachedExe); } catch {} }
      } catch {}
    }

    // Contracts: only if source uses them
    if (source.includes('requires:') || source.includes('ensures:') || source.includes('invariant:')) {
      const verifyProc = runXiom(['--verify', tmp]);
      result.contracts = verifyProc.stdout || verifyProc.stderr || 'Contract verification not available';
      result.stages = result.stages || {};
      result.stages.verify = { success: verifyProc.success, output: result.contracts };
    }

  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }

  return result;
}

function formatSource(source) {
  const tmp = path.join(os.tmpdir(), `xiom_pg_${Date.now()}.xi`);
  fs.writeFileSync(tmp, source);

  try {
    const proc = runXiom(['fmt', tmp]);
    if (proc.success && proc.stdout) {
      return { formatted: proc.stdout };
    }
    return { formatted: null, error: proc.stderr || 'Format failed' };
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/api/check') {
    try {
      const body = await parseBody(req);
      const { source } = JSON.parse(body);
      const tmp = path.join(os.tmpdir(), `xiom_chk_${Date.now()}.xi`);
      fs.writeFileSync(tmp, source);
      const proc = runXiom(['--check', '--check-only', tmp]);
      try { fs.unlinkSync(tmp); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: proc.success,
        diagnostics: parseDiagnostics(proc.stderr),
        output: proc.stderr || (proc.success ? 'OK' : 'Failed')
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, output: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/compile') {
    try {
      const body = await parseBody(req);
      const { source } = JSON.parse(body);
      const result = compileAllStages(source);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, output: e.message, diagnostics: [{code:'S001',kind:'error',line:0,col:0,message:e.message}] }));
    }
    return;
  }

  // Lazy-load endpoints — only called when user clicks IR/Tokens tabs
  if (req.method === 'POST' && (req.url === '/api/tokens' || req.url === '/api/ir')) {
    try {
      const body = await parseBody(req);
      const { source } = JSON.parse(body);
      const tmp = path.join(os.tmpdir(), `xiom_lazy_${Date.now()}.xi`);
      fs.writeFileSync(tmp, source);
      const flag = req.url === '/api/tokens' ? '--emit-tokens' : '--emit-ir';
      const proc = runXiom([flag, tmp]);
      try { fs.unlinkSync(tmp); } catch {}
      const output = proc.stdout ? proc.stdout.replace(/\x1b\[[0-9;]*m/g, '') : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: proc.success, output: output, error: proc.stderr || null }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/format') {
    try {
      const body = await parseBody(req);
      const { source } = JSON.parse(body);
      const result = formatSource(source);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ formatted: null, error: e.message }));
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/lessons') {
    try {
      const catalog = fs.readFileSync(path.join(SCRIPT_DIR, 'lessons', 'index.json'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(catalog);
    } catch {
      res.writeHead(404); res.end('{}');
    }
    return;
  }

  let filepath = path.join(SCRIPT_DIR, req.url === '/' ? 'index.html' : req.url);
  serveFile(res, filepath);
});

server.listen(PORT, HOST, () => {
  console.log(`XIOM Playground Server v0.49.9`);
  console.log(`URL: http://${HOST}:${PORT}`);
  console.log(`Compiler: ${XIOM_BIN} (${fs.existsSync(XIOM_BIN) ? 'found' : 'NOT FOUND'})`);
  console.log(`Endpoints: /api/compile, /api/format, /api/lessons`);
  console.log(`Multi-stage: tokens, parse, IR, diagnostics, contracts`);
});
