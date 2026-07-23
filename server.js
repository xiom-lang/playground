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

const PORT = 3000;
const HOST = 'localhost';
const SCRIPT_DIR = __dirname;
const XIOM_BIN = process.env.XIOM_BIN || path.join(SCRIPT_DIR, '..', 'target', 'debug', 'xiom' + (os.platform() === 'win32' ? '.exe' : ''));

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
    const proc = spawnSync(XIOM_BIN, args, { timeout:15000, encoding:'utf-8', input: stdin || undefined });
    return { success: proc.status === 0, stdout: proc.stdout?.trim() || '', stderr: proc.stderr?.trim() || '' };
  } catch(e) {
    return { success: false, stdout: '', stderr: e.message };
  }
}

function compileAllStages(source) {
  const tmp = path.join(os.tmpdir(), `xiom_pg_${Date.now()}.xi`);
  fs.writeFileSync(tmp, source);

  const result = {
    success: false,
    stages: {},
    ir: null,
    diagnostics: [],
    tokens: null,
    contracts: null,
    output: '',
  };

  try {
    // Stage 1: Lex (tokens) — uses --emit-tokens
    const lexProc = runXiom(['--emit-tokens', tmp]);
    result.stages.lex = { success: lexProc.success, output: lexProc.stdout || 'Tokens not available' };
    if (lexProc.stdout) result.tokens = lexProc.stdout.split('\n').filter(l => l.trim());

    // Stage 2: Parse (syntax check)
    const parseProc = runXiom(['--check', '--check-only', tmp]);
    result.stages.parse = { success: parseProc.success, output: parseProc.stdout || 'Parse OK' };

    // Stage 3: Full compile (IR + diagnostics)
    const fullProc = runXiom(['--emit-ir', '--diagnostics-json', tmp]);
    result.success = fullProc.success;
    result.ir = fullProc.stdout || null;
    result.diagnostics = parseDiagnostics(fullProc.stderr);

    // Stage 4: Contracts verification (if contracts present)
    if (source.includes('requires:') || source.includes('ensures:') || source.includes('invariant:')) {
      const verifyProc = runXiom(['--verify', tmp]);
      result.contracts = verifyProc.stdout || verifyProc.stderr || 'Contract verification not available';
      result.stages.verify = { success: verifyProc.success, output: result.contracts };
    }

    // Human-readable output
    if (result.success) {
      result.output = 'Compilation successful.\nLLVM IR generated. Check the IR tab for generated code.';
    } else {
      const errs = result.diagnostics.filter(d => d.kind === 'error');
      result.output = `Compilation failed: ${errs.length} error(s).\nCheck the Diagnostics tab for details.`;
    }

  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }

  return result;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Compile API — multi-stage
  if (req.method === 'POST' && req.url === '/api/compile') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { source } = JSON.parse(body);
        const result = compileAllStages(source);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, output: e.message, diagnostics: [{code:'S001',kind:'error',line:0,col:0,message:e.message}] }));
      }
    });
    return;
  }

  // Lesson catalog API
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

  // Serve static
  let filepath = path.join(SCRIPT_DIR, req.url === '/' ? 'index.html' : req.url);
  serveFile(res, filepath);
});

server.listen(PORT, HOST, () => {
  console.log(`XIOM Playground Server v0.49.9`);
  console.log(`URL: http://${HOST}:${PORT}`);
  console.log(`Compiler: ${XIOM_BIN} (${fs.existsSync(XIOM_BIN) ? 'found' : 'NOT FOUND'})`);
  console.log(`Multi-stage: tokens, parse, IR, diagnostics, contracts`);
});
