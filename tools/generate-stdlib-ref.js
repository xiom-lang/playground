// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Generate js/stdlib-ref.json from the installed XIOM toolchain.
 *
 * Every public export (fn / type / enum / interface) is extracted from the
 * toolchain's stdlib sources. Descriptions and WASM flags from a previous
 * generation are preserved by signature match, so curated text survives.
 *
 * Usage:
 *   node tools/generate-stdlib-ref.js            # write js/stdlib-ref.json
 *   node tools/generate-stdlib-ref.js --check    # exit 1 when stale (CI)
 *
 * The stdlib is resolved from XIOM_STDLIB, .toolchain/lib, then ../stdlib.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { REPO, childEnv, TOOLCHAIN_VERSION } = require('./lib/toolchain');

const CHECK = process.argv.includes('--check');
const CURATED = process.argv.includes('--curated') ? process.argv[process.argv.indexOf('--curated') + 1] : null;
const OUT = path.join(REPO, 'js', 'stdlib-ref.json');
const LEGACY = path.join(REPO, 'js', 'stdlib-ref.js');

function resolveStdlib() {
  const candidates = [
    childEnv.XIOM_STDLIB,
    path.join(REPO, '.toolchain', 'lib'),
    path.join(REPO, '..', 'stdlib'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'xiom'))) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Source scanning
// ---------------------------------------------------------------------------

function walkXiFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkXiFiles(entryPath, out);
    else if (entry.name.endsWith('.xi')) out.push(entryPath);
  }
  return out;
}

function parenBalance(text) {
  let depth = 0;
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
  }
  return depth;
}

function normalizeSignature(sig) {
  return sig.toLowerCase().replace(/\s+/g, ' ').trim();
}

function baseName(sig) {
  const name = sig.split('(')[0].replace(/\[[^\]]*\]/g, '').trim().toLowerCase();
  return name;
}

function paramCount(sig) {
  const open = sig.indexOf('(');
  if (open < 0) return 0;
  let depth = 0;
  let count = 0;
  let hasContent = false;
  for (let i = open; i < sig.length; i++) {
    const ch = sig[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1) {
      if (ch === ',') count++;
      else if (!/\s/.test(ch)) hasContent = true;
    }
  }
  return hasContent ? count + 1 : 0;
}

function arityKey(sig) {
  return baseName(sig) + '/' + paramCount(sig);
}

function addArity(map, sig, entry) {
  const key = arityKey(sig);
  if (!key) return;
  if (map.has(key)) map.set(key, null); // ambiguous, never use
  else map.set(key, entry);
}

function lookupSign(signMap, arityMap, sig) {
  const exact = signMap.get(normalizeSignature(sig));
  if (exact && exact.desc) return exact;
  const byArity = arityMap.get(arityKey(sig));
  if (byArity && byArity.desc) return byArity;
  return exact || byArity || null;
}

function extractItems(source) {
  const lines = source.split('\n');
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('//')) continue;

    let kind = null;
    let signature = null;
    if (trimmed.startsWith('pub fn ')) {
      kind = 'fn';
      signature = trimmed.slice(7);
    } else if (trimmed.startsWith('pub type ')) {
      kind = 'type';
      signature = trimmed.slice(9).replace(/\s*=\s*\{?.*$/, '').replace(/\s*\{.*$/, '').trim();
    } else if (trimmed.startsWith('pub enum ')) {
      kind = 'enum';
      signature = trimmed.slice(9).replace(/\s*\{.*$/, '').trim();
    } else if (trimmed.startsWith('pub interface ')) {
      kind = 'interface';
      signature = trimmed.slice(14).replace(/\s*\{.*$/, '').trim();
    }
    if (!kind) continue;

    if (kind === 'fn') {
      let balance = parenBalance(signature);
      let j = i + 1;
      while (j < lines.length && balance > 0) {
        const next = lines[j].trim();
        if (/^(requires|ensures)\b/.test(next)) break;
        signature += ' ' + next;
        balance = parenBalance(signature);
        j++;
      }
      signature = signature.replace(/\s*\{.*$/, '').replace(/\s+/g, ' ').trim();
    }
    if (!signature) continue;
    items.push({ kind, sig: signature, desc: '', wasm: '' });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Curated description preservation
// ---------------------------------------------------------------------------

function loadCurated() {
  // An explicit --curated source always wins (used for the one-time merge of
  // the hand-written reference into the generated data).
  if (CURATED) {
    try { return fromLegacyJs(fs.readFileSync(CURATED, 'utf8')); } catch { /* fall through */ }
  }
  // Preferred: previous generated JSON (keeps descriptions across runs).
  try {
    const previous = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    if (previous && Array.isArray(previous.modules)) return fromStructured(previous.modules);
  } catch { /* first generation */ }
  try {
    return fromLegacyJs(fs.readFileSync(LEGACY, 'utf8'));
  } catch {
    return { modules: new Map(), signs: new Map() };
  }
}

function fromStructured(modules) {
  const moduleMap = new Map();
  const signMap = new Map();
  const arityMap = new Map();
  for (const mod of modules) {
    moduleMap.set(mod.name, { desc: mod.desc || '', wasm: mod.wasm || '' });
    for (const fn of mod.functions || []) {
      const key = normalizeSignature(fn.sig || '');
      if (key && fn.desc) {
        const entry = { desc: fn.desc, wasm: fn.wasm || '' };
        signMap.set(key, entry);
        addArity(arityMap, fn.sig, entry);
      }
    }
  }
  return { modules: moduleMap, signs: signMap, arity: arityMap };
}

function fromLegacyJs(text) {
  const moduleMap = new Map();
  const signMap = new Map();
  const arityMap = new Map();
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    let match = line.match(/^name:\s*"([^"]+)",?$/);
    if (match) {
      current = match[1];
      moduleMap.set(current, { desc: '', wasm: '' });
      continue;
    }
    if (current) {
      match = line.match(/^desc:\s*"((?:[^"\\]|\\.)*)",?$/);
      if (match && moduleMap.get(current).desc === '') {
        moduleMap.get(current).desc = unescapeJson(match[1]);
        continue;
      }
      match = line.match(/^wasm:\s*"((?:[^"\\]|\\.)*)",?$/);
      if (match && moduleMap.get(current).wasm === '') {
        moduleMap.get(current).wasm = unescapeJson(match[1]);
        continue;
      }
    }
    match = line.match(/^\{?\s*sig:\s*"((?:[^"\\]|\\.)*)",\s*desc:\s*"((?:[^"\\]|\\.)*)"/);
    if (match && current) {
      const rawSig = unescapeJson(match[1]);
      const entry = { desc: unescapeJson(match[2]), wasm: '' };
      const register = (sig) => {
        const key = normalizeSignature(sig);
        if (!key) return;
        signMap.set(key, entry);
        addArity(arityMap, sig, entry);
      };
      register(rawSig);
      // Curated entries may be module-qualified ("io.println(msg: Str)" for a
      // declaration inside module io); register the unqualified form too.
      if (rawSig.startsWith(current + '.')) register(rawSig.slice(current.length + 1));
    }
  }
  return { modules: moduleMap, signs: signMap, arity: arityMap };
}

function unescapeJson(text) {
  try { return JSON.parse('"' + text + '"'); } catch { return text; }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build(stdlibDir) {
  const curated = loadCurated();
  const files = walkXiFiles(path.join(stdlibDir, 'xiom'), []);
  const modules = new Map();
  let functionCount = 0;

  for (const file of files) {
    const head = fs.readFileSync(file, 'utf8');
    const declared = head.slice(0, 2048).match(/^\s*module\s+(xiom[\w.]*)/m);
    if (!declared) continue;
    const name = declared[1].replace(/^xiom\./, '');
    if (!modules.has(name)) modules.set(name, []);
    const items = extractItems(head);
    for (const item of items) {
      const curatedEntry = lookupSign(curated.signs, curated.arity, item.sig);
      if (curatedEntry) {
        if (curatedEntry.desc) item.desc = curatedEntry.desc;
        if (curatedEntry.wasm) item.wasm = curatedEntry.wasm;
      }
      modules.get(name).push(item);
      if (item.kind === 'fn') functionCount++;
    }
  }

  const ordered = [...modules.keys()].sort((a, b) => {
    if (a === 'core') return -1;
    if (b === 'core') return 1;
    return a.localeCompare(b);
  });

  return {
    version: TOOLCHAIN_VERSION,
    generated: new Date().toISOString(),
    counts: { modules: ordered.length, functions: functionCount },
    modules: ordered.map((name) => {
      const meta = curated.modules.get(name) || { desc: '', wasm: '' };
      const functions = modules.get(name).map((item) => {
        const out = { sig: item.sig, desc: item.desc || '' };
        if (item.wasm) out.wasm = item.wasm;
        return out;
      });
      const mod = { name, desc: meta.desc || '', wasm: meta.wasm || '*', functions };
      return mod;
    }),
  };
}

function serialize(data) {
  const lines = data.modules.map((mod) => '    ' + JSON.stringify(mod));
  return '{\n' +
    '  "version": ' + JSON.stringify(data.version) + ',\n' +
    '  "generated": ' + JSON.stringify(data.generated) + ',\n' +
    '  "counts": ' + JSON.stringify(data.counts) + ',\n' +
    '  "modules": [\n' + lines.join(',\n') + '\n  ]\n}\n';
}

function comparable(text) {
  return text.replace(/"generated": "[^"]*"/, '"generated": ""');
}

function main() {
  const stdlibDir = resolveStdlib();
  if (!stdlibDir) {
    console.error('error: stdlib not found (set XIOM_STDLIB or run tools/fetch-toolchain.*)');
    process.exit(1);
  }
  const data = build(stdlibDir);
  let text = serialize(data);
  let existing = null;
  try { existing = fs.readFileSync(OUT, 'utf8'); } catch { /* first generation */ }

  // Keep the file byte-stable when only the timestamp would change.
  if (existing && comparable(existing) === comparable(text)) {
    const stamp = existing.match(/"generated": "([^"]*)"/);
    if (stamp) text = text.replace(/"generated": "[^"]*"/, '"generated": "' + stamp[1] + '"');
  }

  console.log('stdlib: ' + stdlibDir);
  console.log('modules: ' + data.counts.modules + ', public functions: ' + data.counts.functions);

  if (CHECK) {
    if (!existing || comparable(existing) !== comparable(text)) {
      console.error('error: js/stdlib-ref.json is stale; run node tools/generate-stdlib-ref.js');
      process.exit(1);
    }
    console.log('js/stdlib-ref.json is up to date.');
    return;
  }
  fs.writeFileSync(OUT, text);
  console.log('wrote ' + path.relative(REPO, OUT) + ' (' + text.length + ' bytes)');
}

main();
