/**
 * XIOM Playground Server v0.49.9
 * Node.js dev server — serves static files + compile API via xiom binary.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const os = require('os');

const PORT = 3000;
const HOST = 'localhost';
const SCRIPT_DIR = __dirname;
const XIOM_BIN = process.env.XIOM_BIN || path.join(SCRIPT_DIR, '..', 'target', 'debug', 'xiom' + (os.platform() === 'win32' ? '.exe' : ''));

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.wasm': 'application/wasm', '.json': 'application/json', '.txt': 'text/plain',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

function serveFile(res, filepath) {
  const ext = path.extname(filepath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filepath);
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function parseDiagnostics(stderr) {
  const diags = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/\[(\w+)\]\s*(\d+):(\d+):\s*(.+)/);
    if (m) diags.push({ code: m[1], kind: 'error', line: +m[2], col: +m[3], message: m[4] });
    else if (line.match(/^(error|warning)/i)) diags.push({ code: 'E001', kind: 'error', line: 0, col: 0, message: line.trim() });
  }
  return diags;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/api/compile') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { source } = JSON.parse(body);
      const tmp = path.join(os.tmpdir(), `xiom_playground_${Date.now()}.xi`);
      fs.writeFileSync(tmp, source);

      const result = { success: false, ir: null, diagnostics: [] };
      try {
        const proc = spawnSync(XIOM_BIN, ['--emit-ir', tmp], { timeout: 15000, encoding: 'utf-8' });
        result.success = proc.status === 0;
        result.ir = proc.stdout?.trim() || null;
        result.diagnostics = parseDiagnostics(proc.stderr || '');
      } catch (e) {
        result.diagnostics = [{ code: 'S001', kind: 'server_error', line: 0, col: 0, message: e.message }];
      }
      try { fs.unlinkSync(tmp); } catch {}

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    });
    return;
  }

  // Serve static files
  let filepath = path.join(SCRIPT_DIR, req.url === '/' ? 'index.html' : req.url);
  serveFile(res, filepath);
});

server.listen(PORT, HOST, () => {
  console.log(`XIOM Playground v0.49.9`);
  console.log(`Server: http://${HOST}:${PORT}`);
  console.log(`Compiler: ${XIOM_BIN} (${fs.existsSync(XIOM_BIN) ? 'found' : 'not found'})`);
  console.log(`Press Ctrl+C to stop`);
});
