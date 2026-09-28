// Extract prose fences for one level to per-tag files + manifest.
// Usage: node extract-level.js L1
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = 'E:/xiom-lang/playground';
const LEVEL = process.argv[2];
const OUT = path.join(process.env.TEMP, 'kilo', 'lvlfix', LEVEL);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'snippets'), { recursive: true });
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'lessons', 'index.json'), 'utf8'));
const level = catalog.levels.find((l) => l.id === LEVEL);
const PROSE = ['narrative', 'story', 'why', 'analogy'];
const LISTS = ['tips', 'common_mistakes', 'try_it'];
const manifest = [];
for (const lesson of level.lessons) {
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'lessons', lesson.file), 'utf8'));
  const fields = [];
  for (const k of PROSE) if (typeof data[k] === 'string') fields.push([k, data[k]]);
  for (const k of LISTS) if (Array.isArray(data[k])) fields.push([k, data[k].join('\n')]);
  for (const [field, text] of fields) {
    const re = /```xiom\n([\s\S]*?)```/g;
    let m; let index = 0;
    while ((m = re.exec(text)) !== null) {
      index += 1;
      const code = m[1];
      if (!/fn\s+main\s*\(/.test(code)) continue;
      const tag = (lesson.id + '-' + field + '-' + index).replace(/[^A-Za-z0-9-]/g, '_');
      fs.writeFileSync(path.join(OUT, 'snippets', tag + '.xi'), code, 'utf8');
      manifest.push({ lessonFile: lesson.file, field, index, tag, code });
    }
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(LEVEL + ' snippets: ' + manifest.length);
