// Prepare a work directory the way the server does for a submission: copy
// the source to <dest>/main.xi and the offline sources of every package it
// imports to <dest>/packages/<name>/.
// Usage: node tools/prepare-packages.js <source.xi> <dest-dir>
'use strict';
const fs = require('fs');
const path = require('path');
const packages = require('../lib/packages');

const [, , sourcePath, destDir] = process.argv;
if (!sourcePath || !destDir) {
  console.error('usage: node tools/prepare-packages.js <source.xi> <dest-dir>');
  process.exit(2);
}
const source = fs.readFileSync(sourcePath, 'utf8');
fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(path.join(destDir, 'main.xi'), source, 'utf8');
const result = packages.prepareForSource(source, destDir);
console.log('source: ' + path.resolve(sourcePath));
console.log('dest: ' + path.resolve(destDir));
console.log('copied packages: ' + (result.packages.join(', ') || '(none)'));
console.log('resolver: ' + packages.describe());
