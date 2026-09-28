// Apply hand-written snippet replacements to lesson JSON files.
// Usage: node tools/snippet-sweep/patch-lesson.js tools/snippet-sweep/patches/L3.json
// Each patch is { "file": "lessons/Lx-.../Ly.json", "old": "...", "new": "...",
// "why": "..." }; `old` must match one snippet byte-for-byte (modulo \uXXXX
// escapes). Missing matches exit 1 so a stale patch cannot pass silently.
'use strict';
const fs = require('fs');
const path = require('path');
const { replaceOnce } = require('./json-replace');
const REPO = path.resolve(__dirname, '..', '..');
const listFile = process.argv[2];
if (!listFile) { console.error('usage: node patch-lesson.js <patches.json>'); process.exit(2); }
const patches = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const byFile = new Map();
for (const p of patches) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}
let misses = 0;
for (const [file, list] of byFile) {
  const full = path.join(REPO, file);
  let raw = fs.readFileSync(full, 'utf8');
  for (const p of list) {
    const next = replaceOnce(raw, p.old, p.new);
    if (next === null) {
      misses += 1;
      console.log('MISS ' + file + ' (' + (p.why || 'no reason given') + ')');
      continue;
    }
    raw = next;
    console.log('patched ' + file + ' (' + (p.why || '') + ')');
  }
  fs.writeFileSync(full, raw, 'utf8');
}
console.log('patches: ' + patches.length + ', misses: ' + misses);
if (misses) process.exit(1);
