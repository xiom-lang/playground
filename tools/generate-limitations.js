// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Generate js/limitations.json from tools/lesson-baseline.json.
 *
 * The baseline's runtime failures are lessons blocked by known compiler
 * codegen defects. The UI uses this file to badge them and disable Run with
 * an explanation instead of showing an opaque failed compile.
 *
 * Usage:
 *   node tools/generate-limitations.js            # write js/limitations.json
 *   node tools/generate-limitations.js --check    # exit 1 when stale (CI)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { REPO, TOOLCHAIN_VERSION } = require('./lib/toolchain');

const CHECK = process.argv.includes('--check');
const BASELINE = path.join(REPO, 'tools', 'lesson-baseline.json');
const CATALOG = path.join(REPO, 'lessons', 'index.json');
const OUT = path.join(REPO, 'js', 'limitations.json');

// Reason groups from AUDIT.md section 10 (C17). Unknown IDs still get a row.
const GROUPS = [
  {
    reason: 'compiler codegen: enum payload zero-initialisation',
    ids: ['L2-12', 'L2-14', 'L2-15', 'L2-16', 'L2-19', 'L3-21', 'L3-22', 'L3-23'],
  },
  {
    reason: 'compiler codegen: Vec by reference',
    ids: ['L4-26', 'L4-29', 'L4-33', 'L4-39'],
  },
  {
    reason: 'compiler codegen: interface dispatch',
    ids: [
      'L6-01', 'L6-02', 'L6-03', 'L6-04', 'L6-05', 'L6-06', 'L6-07', 'L6-13',
      'L6-14', 'L6-16', 'L6-17', 'L6-18', 'L6-28', 'L6-30', 'L6-40',
    ],
  },
  {
    reason: 'compiler codegen: map and closure values',
    ids: ['L5-40', 'L8-15', 'L8-18'],
  },
  {
    reason: 'compiler codegen: nested module types',
    ids: ['L6-31'],
  },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function build() {
  const baseline = readJson(BASELINE);
  const catalog = readJson(CATALOG);
  const runtime = new Set((baseline.known && baseline.known.runtime) || []);

  const meta = new Map();
  for (const level of catalog.levels) {
    for (const lesson of level.lessons) {
      meta.set(lesson.id, { level: level.id, title: lesson.title });
    }
  }

  const reasonById = new Map();
  for (const group of GROUPS) {
    for (const id of group.ids) reasonById.set(id, group.reason);
  }

  const lessons = [...runtime].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((id) => {
    const info = meta.get(id) || { level: '', title: '' };
    return {
      id,
      level: info.level,
      title: info.title,
      reason: reasonById.get(id) || 'compiler codegen failure (see AUDIT.md)',
    };
  });

  return {
    toolchain: TOOLCHAIN_VERSION,
    generated: new Date().toISOString(),
    count: lessons.length,
    lessons,
  };
}

function comparable(text) {
  return text.replace(/"generated": "[^"]*"/, '"generated": ""');
}

function main() {
  const data = build();
  let text = JSON.stringify(data, null, 2) + '\n';
  let existing = null;
  try { existing = fs.readFileSync(OUT, 'utf8'); } catch { /* first generation */ }

  if (existing && comparable(existing) === comparable(text)) {
    const stamp = existing.match(/"generated": "([^"]*)"/);
    if (stamp) text = text.replace(/"generated": "[^"]*"/, '"generated": "' + stamp[1] + '"');
  }

  console.log('blocked lessons: ' + data.count);
  if (CHECK) {
    if (!existing || comparable(existing) !== comparable(text)) {
      console.error('error: js/limitations.json is stale; run node tools/generate-limitations.js');
      process.exit(1);
    }
    console.log('js/limitations.json is up to date.');
    return;
  }
  fs.writeFileSync(OUT, text);
  console.log('wrote ' + path.relative(REPO, OUT));
}

main();
