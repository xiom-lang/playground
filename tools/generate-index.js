// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
'use strict';

const fs = require('fs');
const path = require('path');

const LESSONS_DIR = path.join(__dirname, '..', 'lessons');
const INDEX_FILE = path.join(LESSONS_DIR, 'index.json');

const LEVEL_NAMES = {
  'L0': { name: 'First Steps', icon: '\uD83C\uDF31', description: 'Printing, numbers, variables -- your first steps into programming.' },
  'L1': { name: 'Functions', icon: '\uD83C\uDF7D\uFE0F', description: 'Functions as named recipes. Parameters, return values, composition.' },
  'L2': { name: 'Data', icon: '\uD83D\uDCE6', description: 'Structs, enums, methods, Option and Result patterns.' },
  'L3': { name: 'Pattern Power', icon: '\uD83D\uDD0D', description: 'Pattern matching, Option, Result, the ? operator, error handling.' },
  'L4': { name: 'XIOM Magic', icon: '\uD83D\uDEE1\uFE0F', description: 'Contracts, ownership, borrowing -- what makes XIOM unique.' },
  'L5': { name: 'Collections', icon: '\uD83D\uDCCB', description: 'Vec, Map, Set, generics -- working with many things at once.' },
  'L6': { name: 'Engineering', icon: '\uD83D\uDD27', description: 'Interfaces, modules, libraries -- writing professional code.' },
  'L7': { name: 'Practice', icon: '\uD83C\uDFAE', description: 'Coding katas -- games, calculators, tools, and simulators.' },
  'L8': { name: 'Showcase', icon: '\uD83C\uDF1F', description: 'Grand finale -- build impressive single-file programs.' },
};

function collectLessons() {
  const lessons = [];
  for (const entry of fs.readdirSync(LESSONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const levelDir = path.join(LESSONS_DIR, entry.name);
    for (const file of fs.readdirSync(levelDir)) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(levelDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!data.id || !data.title || !data.level) continue;
        lessons.push({
          id: data.id, title: data.title, level: data.level,
          file: path.relative(LESSONS_DIR, filePath).replace(/\\/g, '/'),
          duration: data.duration || '8 min',
          concepts: Array.isArray(data.concepts) ? data.concepts : [],
        });
      } catch (e) { /* skip unparseable */ }
    }
  }
  return lessons;
}

function buildIndex(lessons) {
  const levelMap = {};
  for (const l of lessons) { if (!levelMap[l.level]) levelMap[l.level] = []; levelMap[l.level].push(l); }
  for (const lvl of Object.keys(levelMap)) { levelMap[lvl].sort((a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1])); }

  const levels = [];
  for (const lvl of ['L0','L1','L2','L3','L4','L5','L6','L7','L8']) {
    if (!levelMap[lvl] || levelMap[lvl].length === 0) continue;
    const info = LEVEL_NAMES[lvl] || { name: lvl, icon: '', description: '' };
    levels.push({ id: lvl, name: info.name, icon: info.icon, description: info.description,
      lessons: levelMap[lvl].map(l => ({ id: l.id, title: l.title, file: l.file, duration: l.duration, concepts: l.concepts })) });
  }
  return { version: require('../package.json').version, total_lessons: lessons.length, levels };
}

// -- Main --
console.log('\x1b[36m\x1b[1mXIOM Index Generator v' + require('../package.json').version + '\x1b[0m');
const lessons = collectLessons();
console.log(`Found \x1b[32m${lessons.length}\x1b[0m lessons across \x1b[32m${new Set(lessons.map(l => l.level)).size}\x1b[0m levels.`);
const index = buildIndex(lessons);
fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
console.log(`Wrote \x1b[32mindex.json\x1b[0m with \x1b[32m${index.total_lessons}\x1b[0m lessons.\n`);
for (const level of index.levels) {
  console.log(`  \x1b[36m${level.id}\x1b[0m ${level.icon} ${level.name}: \x1b[32m${level.lessons.length}\x1b[0m`);
}
