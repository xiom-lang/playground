#!/usr/bin/env node
// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Compile every complete `fn main` code fence in lesson prose (narrative,
// story, why, analogy, tips, common_mistakes, try_it) so lesson examples
// cannot drift away from the real language. Solutions and templates are
// already covered by tools/lesson-audit.js; this tool covers the prose.
//
// Notes:
// - Snippets are compiled one per directory: the compiler indexes the
//   source file's parent directory, so a single flat directory with
//   hundreds of files is very slow (and hangs across 9p mounts).
// - Prose fences are often excerpts: calls to functions/types defined
//   elsewhere in the lesson, or `io.println` without the `use xiom.io;`
//   line. `--imports` retries an undefined-module failure with the matching
//   `use` prepended and reports the snippet as `missing-import` when that
//   makes it compile, separating the excerpt convention from real errors.
// - A full run is slow (about 8 s per check on Linux, 15 s on Windows);
//   scope it with `--level` while sweeping a level. Example:
//     node tools/audit-snippets.js --level L0 --imports
//
// Usage:
//   node tools/audit-snippets.js [--level Lx ...] [--imports]
//     [--json report.json] [--quiet]
//
// Exit code 1 when any snippet fails to compile (after the --imports retry
// when enabled), so it can gate a content sweep.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const XIOM = process.env.XIOM_BIN || path.join(REPO, '.toolchain', 'bin',
  process.platform === 'win32' ? 'xiom.exe' : 'xiom');
const PROSE = ['narrative', 'story', 'why', 'analogy'];
const LISTS = ['tips', 'common_mistakes', 'try_it'];
const MODULES = { io: 'use xiom.io;', string: 'use xiom.string;', math: 'use xiom.math;' };

function parseArgs(argv) {
  const opts = { levels: [], imports: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--level') opts.levels.push(argv[++i]);
    else if (argv[i] === '--imports') opts.imports = true;
    else if (argv[i] === '--json') opts.json = argv[++i];
    else if (argv[i] === '--quiet') opts.quiet = true;
  }
  return opts;
}

function check(source, tag) {
  const dir = path.join(os.tmpdir(), 'xiom-snippet-audit', tag);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'main.xi');
  fs.writeFileSync(file, source, 'utf8');
  const proc = spawnSync(XIOM, ['--check', file], { encoding: 'utf8', timeout: 60000 });
  const output = String(proc.stderr || '') + String(proc.stdout || '');
  return { ok: proc.status === 0, output };
}

function firstError(output) {
  const line = output.split('\n').find((l) => /error\[/.test(l));
  return (line || output.split('\n')[0] || 'unknown error').trim();
}

function undefinedModule(output) {
  const m = /undefined variable '(io|string|math)'/.exec(output);
  return m ? m[1] : null;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(XIOM)) {
    console.error('audit-snippets: compiler not found at ' + XIOM);
    process.exit(2);
  }
  const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'lessons', 'index.json'), 'utf8'));
  const report = { generated: new Date().toISOString(), compiler: XIOM, snippets: 0, compiled: 0, ok: 0, missingImport: 0, excerpts: [], failures: [] };

  for (const level of catalog.levels) {
    if (opts.levels.length > 0 && !opts.levels.includes(level.id)) continue;
    for (const lesson of level.lessons) {
      const data = JSON.parse(fs.readFileSync(path.join(REPO, 'lessons', lesson.file), 'utf8'));
      const fields = [];
      for (const key of PROSE) if (typeof data[key] === 'string') fields.push([key, data[key]]);
      for (const key of LISTS) if (Array.isArray(data[key])) fields.push([key, data[key].join('\n')]);
      for (const [field, text] of fields) {
        const re = /```xiom\n([\s\S]*?)```/g;
        let m;
        let index = 0;
        while ((m = re.exec(text)) !== null) {
          index += 1;
          report.snippets += 1;
          const code = m[1];
          if (!/fn\s+main\s*\(/.test(code)) continue; // fragment, cannot stand alone
          report.compiled += 1;
          const tag = (lesson.id + '-' + field + '-' + index).replace(/[^A-Za-z0-9-]/g, '_');
          const first = check(code, tag);
          if (first.ok) { report.ok += 1; continue; }
          if (opts.imports) {
            const mod = undefinedModule(first.output);
            if (mod) {
              const retry = check(MODULES[mod] + '\n\n' + code, tag + '-imp');
              if (retry.ok) { report.missingImport += 1; continue; }
              if (/undefined variable '|unknown type '/.test(retry.output)) {
                report.excerpts.push({ lesson: lesson.id, field, index, error: firstError(retry.output) });
              } else {
                report.failures.push({ lesson: lesson.id, field, index, error: firstError(retry.output) });
              }
              continue;
            }
          }
          if (/undefined variable '|unknown type '/.test(first.output)) {
            report.excerpts.push({ lesson: lesson.id, field, index, error: firstError(first.output) });
          } else {
            report.failures.push({ lesson: lesson.id, field, index, error: firstError(first.output) });
          }
        }
      }
    }
  }

  if (!opts.quiet) {
    console.log('snippets: ' + report.snippets + ', complete programs: ' + report.compiled);
    console.log('  ok: ' + report.ok + ', missing-import: ' + report.missingImport + ', excerpt (undefined local): ' + report.excerpts.length +
      ', failing: ' + report.failures.length);
    for (const f of report.failures) {
      console.log('  ' + f.lesson + ' [' + f.field + ' #' + f.index + '] ' + f.error);
    }
  }
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(report, null, 2) + '\n');
  process.exit(report.failures.length > 0 ? 1 : 0);
}

main();
