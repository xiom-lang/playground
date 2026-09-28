// Fix failing prose snippets for one level (wraps, arrows, imports) and
// rewrite direct `for x in y` loops to range+index.
// Usage: node fix-level.js L1
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = 'E:/xiom-lang/playground';
const LEVEL = process.argv[2];
const WORK = path.join(process.env.TEMP, 'kilo', 'lvlfix', LEVEL);
const OUTDIR = fs.readdirSync(WORK).find((d) => d.startsWith('out'));
if (!OUTDIR) { console.error('no out dir'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'manifest.json'), 'utf8'));
const statusOf = {}; const errOf = {};
for (const f of fs.readdirSync(path.join(WORK, OUTDIR))) {
  const full = path.join(WORK, OUTDIR, f);
  if (f.endsWith('.status')) statusOf[f.replace('.status', '')] = fs.readFileSync(full, 'utf8').trim();
  if (f.endsWith('.err')) errOf[f.replace('.err', '')] = fs.readFileSync(full, 'utf8');
}
const ARG_RE = /argument 1 type mismatch: expected Str, found/;
const ARROW_RE = /expected '=>', found ->/;

function parseErrors(text) {
  const out = []; const re = /error\[([A-Z0-9]+)\]: (\d+):(\d+): ([^\n]*)/g; let m;
  while ((m = re.exec(text)) !== null) out.push({ code: m[1], line: +m[2], col: +m[3], message: m[4] });
  return out;
}
function findCall(line, col) {
  let best = -1; let name = null;
  for (const n of ['io.println(', 'io.print(']) {
    let i = line.indexOf(n);
    while (i >= 0) { if (i <= col - 1 + 2 && i > best) { best = i; name = n; } i = line.indexOf(n, i + 1); }
  }
  return best >= 0 ? { index: best, name } : null;
}
function wrapArg(line, call) {
  const open = call.index + call.name.length - 1;
  let depth = 0; let end = -1;
  for (let i = open; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { i++; while (i < line.length && !(line[i] === '"' && line[i - 1] !== '\\')) i++; continue; }
    if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const inner = line.slice(open + 1, end).trim();
  if (!inner || inner.startsWith('"') || inner.endsWith('.to_str()')) return null;
  return line.slice(0, open + 1) + '(' + inner + ').to_str()' + line.slice(end);
}
function loops(code) {
  const lines = code.split('\n'); const out = []; let changed = false;
  for (const line of lines) {
    const m = /^(\s*)for\s+([A-Za-z_]\w*)\s+in\s+([A-Za-z_]\w*)\s*\{\s*$/.exec(line);
    if (m && m[3] !== 'range') {
      out.push(m[1] + 'for __i in range(0, ' + m[3] + '.len()) {');
      out.push(m[1] + '  let ' + m[2] + ' = ' + m[3] + '[__i];');
      changed = true; continue;
    }
    out.push(line);
  }
  if (!changed) return null;
  let text = out.join('\n');
  if (!/use xiom\.iter;/.test(text)) {
    text = /use xiom\.io;/.test(text) ? text.replace('use xiom.io;', 'use xiom.io;\nuse xiom.iter;') : 'use xiom.iter;\n' + text;
  }
  return text;
}

const repl = new Map(); const manual = [];
for (const item of manifest) {
  const status = statusOf[item.tag] || 'fail';
  if (status.startsWith('ok')) continue;
  const mods = /prepended=([a-z,]+)/.exec(status);
  const modules = mods ? mods[1].split(',') : [];
  const offset = modules.length ? modules.length + 1 : 0;
  const errors = parseErrors(errOf[item.tag] || '');
  const lines = item.code.split('\n');
  let changed = false; const remaining = [];
  for (const e of errors.slice().sort((a, b) => (b.line - a.line) || (b.col - a.col))) {
    const li = e.line - offset - 1;
    if (li < 0 || li >= lines.length) { remaining.push(e); continue; }
    if (ARG_RE.test(e.message)) {
      const c = findCall(lines[li], e.col);
      const w = c ? wrapArg(lines[li], c) : null;
      if (w) { lines[li] = w; changed = true; } else remaining.push(e);
      continue;
    }
    if (ARROW_RE.test(e.message)) {
      const pos = e.col - 1;
      if (lines[li].slice(pos, pos + 2) === '->') { lines[li] = lines[li].slice(0, pos) + '=>' + lines[li].slice(pos + 2); changed = true; } else remaining.push(e);
      continue;
    }
    remaining.push(e);
  }
  let code = lines.join('\n');
  if (modules.length) code = modules.map((m) => 'use xiom.' + m + ';').join('\n') + '\n\n' + code;
  const looped = loops(code);
  if (looped) code = looped;
  if (changed || modules.length || looped) {
    if (!repl.has(item.lessonFile)) repl.set(item.lessonFile, new Map());
    repl.get(item.lessonFile).set(item.code, code);
    if (remaining.length) manual.push(item.tag + ': ' + remaining.map((r) => r.line + ':' + r.col + ' ' + r.message.slice(0, 60)).join(' | '));
  } else if (remaining.length) {
    manual.push(item.tag + ': ' + remaining.map((r) => r.line + ':' + r.col + ' ' + r.message.slice(0, 60)).join(' | '));
  }
}
for (const [file, map] of repl) {
  const full = path.join(REPO, 'lessons', file);
  let raw = fs.readFileSync(full, 'utf8');
  for (const [oldC, newC] of map) {
    const o = JSON.stringify(oldC).slice(1, -1); const n = JSON.stringify(newC).slice(1, -1);
    if (raw.indexOf(o) < 0) { console.log('MISS ' + file); continue; }
    raw = raw.replace(o, n);
  }
  fs.writeFileSync(full, raw, 'utf8');
  console.log('patched ' + file + ' (' + map.size + ')');
}
console.log('manual: ' + manual.length);
for (const m of manual) console.log('  ' + m);
