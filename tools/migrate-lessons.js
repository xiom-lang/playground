// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * One-time lesson migration to the v0.60 language and stdlib API.
 *
 * Mechanical, scanner-based transforms applied to `solution` and
 * `code_template` only. Run dry first (default), then with --apply.
 *
 *   node tools/migrate-lessons.js                 # dry run, summary
 *   node tools/migrate-lessons.js --show L7-01    # transformed source for review
 *   node tools/migrate-lessons.js --apply         # write changes
 *
 * Transforms:
 *   let-mut      let mut x -> var x
 *   type-eq      type X { -> type X = {
 *   enum-comma   enum variant separators ; -> ,
 *   match-arrow  match arms -> become =>
 *   module-kw    mod X { -> module X {, local `use X;` removed
 *   receiver     self: &mut Self -> &mut self, self: &Self -> self
 *   conversions  int_to_str -> to_string, float/bool/char variants,
 *                str_length -> str_len (+ use xiom.convert when needed)
 *   encoding     Windows-1252 lesson files are decoded and rewritten as UTF-8
 */
'use strict';

const fs = require('fs');
const path = require('path');
const CONTENT = require('./lesson-patches');

const REPO = path.resolve(__dirname, '..');
const LESSONS = path.join(REPO, 'lessons');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIST = args.includes('--list');
const SHOW = args.includes('--show') ? args[args.indexOf('--show') + 1] : null;
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const QUIET = args.includes('--quiet');

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

const CP1252 = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026',
  0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160',
  0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019',
  0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153',
  0x9E: '\u017E', 0x9F: '\u0178',
};

function decodeLessonFile(file) {
  const buffer = fs.readFileSync(file);
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), fixedEncoding: false };
  } catch {
    let out = '';
    for (const byte of buffer) out += CP1252[byte] !== undefined ? CP1252[byte] : String.fromCharCode(byte);
    return { text: out, fixedEncoding: true };
  }
}

// ---------------------------------------------------------------------------
// Scanner-based transforms
// ---------------------------------------------------------------------------

function replaceOutsideCode(src) {
  // Scanner: rewrites match-arm arrows and enum separators outside strings
  // and comments.
  let out = '';
  let braceDepth = 0;
  const matchStack = [];
  const enumStack = [];
  let pendingMatch = false;
  let pendingEnum = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '"') {
      const end = scanString(src, i, '"');
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "'") {
      const end = scanString(src, i, "'");
      out += src.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      out += src.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop);
      i = stop;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'match') pendingMatch = true;
      if (word === 'enum') pendingEnum = true;
      out += word;
      i = j;
      continue;
    }
    if (ch === '{') {
      braceDepth++;
      if (pendingMatch) { matchStack.push(braceDepth); pendingMatch = false; }
      if (pendingEnum) { enumStack.push(braceDepth); pendingEnum = false; }
      out += ch;
      i++;
      continue;
    }
    if (ch === '}') {
      while (matchStack.length && matchStack[matchStack.length - 1] >= braceDepth) matchStack.pop();
      while (enumStack.length && enumStack[enumStack.length - 1] >= braceDepth) enumStack.pop();
      braceDepth--;
      out += ch;
      i++;
      continue;
    }
    if (ch === '-' && next === '>') {
      if (matchStack.length > 0) {
        out += '=>';
        i += 2;
        continue;
      }
      out += ch;
      i++;
      continue;
    }
    if (ch === ';') {
      if (enumStack.length > 0 && enumStack[enumStack.length - 1] === braceDepth) {
        out += ',';
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }
    if (ch === '\n' && braceDepth === 0) { pendingMatch = false; pendingEnum = false; }
    out += ch;
    i++;
  }
  return out;
}

function scanString(src, start, quote) {
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i + 1;
    i++;
  }
  return src.length;
}

function transformSource(source) {
  let text = source;
  const notes = [];
  const patterns = {
    'let-mut': /\blet\s+mut\s+/g,
    'type-eq': /(\b(?:pub\s+)?type\s+[A-Za-z_]\w*(?:\s*\[[^\]]*\])?)\s*\{/g,
    'module-kw': /\bmod\s+([A-Za-z_]\w*)\s*\{/g,
    'receiver-mut': /self\s*:\s*&mut\s+Self/g,
    'receiver-ref': /self\s*:\s*&Self/g,
    'receiver-val': /self\s*:\s*Self/g,
    'conversion': /\b(?:(?:string|convert|num|format)\.)?(int_to_str|float_to_str|bool_to_str|char_to_str|str_length)\b/g,
  };

  if (ONLY && !ONLY.includes('let-mut')) { /* skip */ } else if (patterns['let-mut'].test(text)) {
    text = text.replace(patterns['let-mut'], 'var ');
    notes.push('let-mut');
  }

  if (!ONLY || ONLY.includes('type-eq')) {
    if (patterns['type-eq'].test(text)) {
      text = text.replace(patterns['type-eq'], '$1 = {');
      notes.push('type-eq');
    }
  }

  if (!ONLY || ONLY.includes('module-kw')) {
    const modules = new Set();
    text = text.replace(patterns['module-kw'], (match, name) => { modules.add(name); return 'module ' + name + ' {'; });
    if (modules.size > 0) {
      text = text.split('\n').filter((line) => !new RegExp('^\\s*use\\s+(?:' + [...modules].join('|') + ')\\s*;\\s*$').test(line)).join('\n');
      notes.push('module-kw');
    }
  }

  if (!ONLY || ONLY.includes('receiver')) {
    let changed = false;
    if (patterns['receiver-mut'].test(text)) { text = text.replace(patterns['receiver-mut'], '&mut self'); changed = true; }
    if (patterns['receiver-ref'].test(text)) { text = text.replace(patterns['receiver-ref'], 'self'); changed = true; }
    if (patterns['receiver-val'].test(text)) { text = text.replace(patterns['receiver-val'], 'self'); changed = true; }
    if (changed) notes.push('receiver');
  }

  if (!ONLY || ONLY.includes('conversions')) {
    const map = {
      int_to_str: 'to_string',
      float_to_str: 'convert.float_to_string',
      bool_to_str: 'convert.bool_to_string',
      char_to_str: 'to_string_char',
      str_length: 'str_len',
    };
    if (patterns['conversion'].test(text)) {
      text = text.replace(patterns['conversion'], (match, name) => map[name]);
      notes.push('conversions');
      if (/convert\.(?:float_to_string|bool_to_string)\(/.test(text) && !/^\s*use\s+xiom\.convert\s*;/m.test(text)) {
        text = addImport(text, 'use xiom.convert;');
        notes.push('import-convert');
      }
      if (/to_string_char\(/.test(text) && !/^\s*use\s+xiom\.convert\.tostring\s*;/m.test(text)) {
        text = addImport(text, 'use xiom.convert.tostring;');
        notes.push('import-tostring');
      }
    }
  }

  if (!ONLY || ONLY.includes('fixups')) {
    const before = text;
    text = text
      // conversions introduced by the first migration pass, now dotted
      .replace(/\bto_string_float\(/g, 'convert.float_to_string(')
      .replace(/\bto_string_bool\(/g, 'convert.bool_to_string(')
      .replace(/\bstring\.from_char\(/g, 'to_string_char(')
      // Option qualified constructors
      .replace(/\bOption\.None\b/g, 'None')
      .replace(/\bOption\.Some\(/g, 'Some(')
      // module declarations never take pub
      .replace(/\bpub\s+module\b/g, 'module')
      // generic receivers: self: &mut Box[T] -> &mut self
      .replace(/self\s*:\s*&mut\s+[A-Za-z_]\w*(?:\s*\[[^\]]*\])?/g, '&mut self')
      .replace(/self\s*:\s*&[A-Za-z_]\w*(?:\s*\[[^\]]*\])?/g, 'self')
      .replace(/self\s*:\s*[A-Za-z_]\w*(?:\s*\[[^\]]*\])?/g, 'self');
    if (/convert\.(?:float_to_string|bool_to_string)\(/.test(text) && !/^\s*use\s+xiom\.convert\s*;/m.test(text)) {
      text = addImport(text, 'use xiom.convert;');
    }
    if (/to_string_char\(/.test(text) && !/^\s*use\s+xiom\.convert\.tostring\s*;/m.test(text)) {
      text = addImport(text, 'use xiom.convert.tostring;');
    }
    if (text !== before) notes.push('fixups');
  }

  const doMatchArrow = !ONLY || ONLY.includes('match-arrow');
  const doEnumComma = !ONLY || ONLY.includes('enum-comma');
  if (doMatchArrow || doEnumComma) {
    const before = text;
    text = replaceOutsideCode(text);
    if (text !== before) {
      if (doMatchArrow) notes.push('match-arrow');
      if (doEnumComma) notes.push('enum-comma');
    }
  }

  if (!ONLY || ONLY.includes('forin')) {
    const lines = text.split('\n');
    const outLines = [];
    let forChanged = false;
    for (const line of lines) {
      const match = /^(\s*)for\s+([A-Za-z_]\w*)\s+in\s+([A-Za-z_][\w.]*)\s*\{\s*(.*)$/.exec(line);
      if (match && !/^\s*\/\//.test(line)) {
        const indent = match[1];
        const name = match[2];
        const collection = match[3];
        const rest = match[4];
        forChanged = true;
        outLines.push(indent + 'for __i in range(0, ' + collection + '.len()) {');
        outLines.push(indent + '  let ' + name + ' = ' + collection + '[__i];');
        if (rest.trim()) outLines.push(indent + '  ' + rest);
        continue;
      }
      outLines.push(line);
    }
    if (forChanged) {
      text = outLines.join('\n');
      if (!/^\s*use\s+xiom\.iter\s*;/m.test(text)) text = addImport(text, 'use xiom.iter;');
      notes.push('forin');
    }
  }

  return { text, notes: [...new Set(notes)] };
}

function addImport(source, line) {
  const lines = source.split('\n');
  let lastUse = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*use\s+xiom\.[\w.]+;\s*$/.test(lines[i])) lastUse = i;
  }
  if (lastUse >= 0) lines.splice(lastUse + 1, 0, line);
  else lines.unshift(line);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function lessonFiles() {
  const index = JSON.parse(fs.readFileSync(path.join(LESSONS, 'index.json'), 'utf8'));
  const files = [];
  for (const level of index.levels) for (const lesson of level.lessons) files.push({ id: lesson.id, file: path.join(LESSONS, lesson.file) });
  return files;
}

function main() {
  const files = lessonFiles();
  const stats = { lessonsChanged: 0, encodingFixed: [], solutions: 0, templates: 0 };
  const transformCounts = {};
  for (const entry of files) {
    const decoded = decodeLessonFile(entry.file);
    if (decoded.fixedEncoding) stats.encodingFixed.push(entry.id);
    let data;
    try {
      data = JSON.parse(decoded.text);
    } catch (err) {
      console.error('SKIP ' + entry.id + ': JSON parse failed: ' + err.message);
      continue;
    }
    let changed = decoded.fixedEncoding;
    const lessonPatches = CONTENT.patches[entry.id] || [];
    for (const key of ['solution', 'code_template']) {
      if (typeof data[key] !== 'string' || data[key].length === 0) continue;
      const result = transformSource(data[key]);
      let next = result.text;
      for (const patch of lessonPatches) {
        const [find, replace, guard] = patch;
        if (guard && next.includes(guard)) continue;
        if (next.includes(find)) next = next.split(find).join(replace);
      }
      if (key === 'solution' && CONTENT.solutions[entry.id] && next !== CONTENT.solutions[entry.id]) {
        next = CONTENT.solutions[entry.id];
        data[key] = next;
        changed = true;
        stats.solutions++;
        transformCounts['content'] = (transformCounts['content'] || 0) + 1;
        continue;
      }
      if (next !== data[key]) {
        changed = true;
        stats[key === 'solution' ? 'solutions' : 'templates']++;
        if (next !== result.text) transformCounts['patch'] = (transformCounts['patch'] || 0) + 1;
        for (const note of result.notes) transformCounts[note] = (transformCounts[note] || 0) + 1;
        data[key] = next;
      }
    }
    if (changed) {
      stats.lessonsChanged++;
      if (LIST) console.log((APPLY ? 'applied ' : 'would change ') + entry.id);
      if (SHOW && entry.id === SHOW) {
        console.log('=== ' + entry.id + ' solution after transform ===');
        console.log(data.solution);
      }
      if (APPLY) {
        fs.writeFileSync(entry.file, JSON.stringify(data, null, 2) + '\n', 'utf8');
      }
    }
  }
  if (!QUIET) {
    console.log((APPLY ? 'applied' : 'dry run') + ': lessons=' + stats.lessonsChanged +
      ' solutions=' + stats.solutions + ' templates=' + stats.templates +
      ' encoding=' + stats.encodingFixed.length + (stats.encodingFixed.length ? ' [' + stats.encodingFixed.join(' ') + ']' : ''));
    console.log('transform counts: ' + JSON.stringify(transformCounts));
  }
}

main();
