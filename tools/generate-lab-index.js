// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Generate the Algorithm Lab catalog from lessons/lab/manifest.json and the
 * program sources in lessons/lab/programs/.
 *
 * Outputs (never hand-edit):
 *   lessons/lab/index.json            categories + entry metadata
 *   lessons/lab/entries/<id>.json     one entry: metadata + program code
 *
 * Usage:
 *   node tools/generate-lab-index.js           # write
 *   node tools/generate-lab-index.js --check   # assert generated files are current
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { labExtractAnnotations } = require('../js/lab-trace');

const REPO = path.join(__dirname, '..');
const LAB_DIR = path.join(REPO, 'lessons', 'lab');
const MANIFEST_FILE = path.join(LAB_DIR, 'manifest.json');
const INDEX_FILE = path.join(LAB_DIR, 'index.json');
const ENTRIES_DIR = path.join(LAB_DIR, 'entries');
const PROGRAMS_DIR = path.join(LAB_DIR, 'programs');

const CHECK = process.argv.includes('--check');
const VIEW_TYPES = ['bars', 'cells', 'grid', 'graph', 'tree', 'matrix', 'stack', 'timeline'];

function fail(message) {
  console.error('error: ' + message);
  process.exit(1);
}

function readManifest() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  } catch (err) {
    fail('cannot read ' + path.relative(REPO, MANIFEST_FILE) + ': ' + err.message);
  }
  if (!Array.isArray(manifest.categories) || !Array.isArray(manifest.entries)) {
    fail('manifest must have categories[] and entries[]');
  }
  return manifest;
}

function buildCatalog(manifest) {
  const seenIds = new Set();
  const categoryById = new Map(manifest.categories.map((category) => [category.id, category]));
  const programsOnDisk = new Set(
    fs.readdirSync(PROGRAMS_DIR).filter((file) => file.endsWith('.xi'))
  );

  const entries = manifest.entries.map((entry, position) => {
    if (!entry.id || !entry.title || !entry.category || !entry.program) {
      fail('entry #' + position + ' needs id, title, category and program');
    }
    if (seenIds.has(entry.id)) fail('duplicate entry id ' + entry.id);
    seenIds.add(entry.id);
    if (!categoryById.has(entry.category)) fail(entry.id + ': unknown category ' + entry.category);
    if (!entry.view || VIEW_TYPES.indexOf(entry.view.type) === -1) {
      fail(entry.id + ': view.type must be one of ' + VIEW_TYPES.join(', '));
    }
    if (!programsOnDisk.has(entry.program)) fail(entry.id + ': missing program ' + entry.program);

    const programPath = path.join(PROGRAMS_DIR, entry.program);
    const source = fs.readFileSync(programPath, 'utf8').replace(/\r\n/g, '\n');
    const annotations = labExtractAnnotations(source);
    if (annotations.names.length === 0) fail(entry.id + ': program has no // @step annotations');

    return {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      view: entry.view,
      blurb: entry.blurb || '',
      program: entry.program,
      source,
    };
  });

  const usedPrograms = new Set(entries.map((entry) => entry.program));
  for (const program of programsOnDisk) {
    if (!usedPrograms.has(program)) fail('program ' + program + ' is not listed in the manifest');
  }

  const categories = manifest.categories.map((category) => ({
    id: category.id,
    name: category.name,
    icon: category.icon || '',
    blurb: category.blurb || '',
    entries: entries
      .filter((entry) => entry.category === category.id)
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        file: 'entries/' + entry.id + '.json',
        view: entry.view,
        blurb: entry.blurb,
      })),
  }));

  for (const category of categories) {
    if (category.entries.length === 0) fail('category ' + category.id + ' has no entries');
  }

  const packageVersion = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
  const index = {
    version: packageVersion,
    protocol: manifest.protocol || 'v1',
    total_entries: entries.length,
    categories,
  };

  return { index, entries };
}

function entryFile(entry) {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    view: entry.view,
    blurb: entry.blurb,
    code: entry.source,
  };
}

function main() {
  const manifest = readManifest();
  const { index, entries } = buildCatalog(manifest);

  const outputs = [{ file: INDEX_FILE, text: JSON.stringify(index, null, 2) + '\n' }];
  for (const entry of entries) {
    outputs.push({
      file: path.join(ENTRIES_DIR, entry.id + '.json'),
      text: JSON.stringify(entryFile(entry), null, 2) + '\n',
    });
  }

  if (CHECK) {
    const stale = [];
    for (const output of outputs) {
      const current = fs.existsSync(output.file) ? fs.readFileSync(output.file, 'utf8').replace(/\r\n/g, '\n') : null;
      if (current !== output.text) stale.push(path.relative(REPO, output.file).replace(/\\/g, '/'));
    }
    if (stale.length > 0) {
      console.error('Lab catalog is stale: ' + stale.join(', '));
      console.error('Run: node tools/generate-lab-index.js');
      process.exit(1);
    }
    console.log('Lab catalog is up to date (' + entries.length + ' entries, ' + index.categories.length + ' categories).');
    return;
  }

  fs.mkdirSync(ENTRIES_DIR, { recursive: true });
  fs.writeFileSync(INDEX_FILE, outputs[0].text, 'utf8');
  for (const output of outputs.slice(1)) fs.writeFileSync(output.file, output.text, 'utf8');
  console.log('Wrote lessons/lab/index.json and ' + entries.length + ' entry files.');
}

main();
