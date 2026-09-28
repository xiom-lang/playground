// Collapse repeated `use xiom.<module>;` blocks inside lesson prose fences.
// Earlier sweep rounds could prepend an import that a later round added
// again; this is idempotent and safe to rerun.
// Usage: node tools/snippet-sweep/dedupe-imports.js [--write]
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const write = process.argv.includes('--write');
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'lessons', 'index.json'), 'utf8'));

// In the raw JSON the newlines are the two characters \ and n.
const DUP = /use xiom\.([a-z_]+);(?:\\n)+use xiom\.\1;/g;
let files = 0; let removed = 0;
for (const level of catalog.levels) {
  for (const lesson of level.lessons) {
    const full = path.join(REPO, 'lessons', lesson.file);
    const raw = fs.readFileSync(full, 'utf8');
    let next = raw; let hits = 0;
    for (;;) {
      const candidate = next.replace(DUP, 'use xiom.$1;');
      if (candidate === next) break;
      next = candidate; hits += 1;
    }
    if (hits > 0) {
      files += 1; removed += hits;
      if (write) fs.writeFileSync(full, next, 'utf8');
      console.log((write ? 'deduped ' : 'would dedupe ') + lesson.file + ' (' + hits + ')');
    }
  }
}
console.log((write ? 'deduped ' : 'would dedupe ') + removed + ' block(s) in ' + files + ' file(s)');
