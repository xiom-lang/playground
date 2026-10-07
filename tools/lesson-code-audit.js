// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
'use strict';

// Code-adjacent lesson audit: catches content bugs that make a beginner's
// copy-paste or understanding fail even though the lesson passes the style
// and compiler audits.
//
// Checks per lesson:
//   - solutions that print hard-coded literals ("87") instead of the
//     variables they just computed;
//   - narrative/code blocks that call `module.function` without importing
//     `use xiom.module;` (copy-paste would not compile);
//   - stray "?" characters where an arrow/word was lost in editing.
//
// Usage: node tools/lesson-code-audit.js [--json out.json] [--strict]

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LESSONS_DIR = path.join(ROOT, 'lessons');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const MODULES = ['io', 'string', 'math', 'iter', 'collections', 'core'];

function collect(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'lab') continue;
      collect(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
      acc.push(full);
    }
  }
  return acc;
}

function codeBlocks(text) {
  const blocks = [];
  const re = /```[a-z]*\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(String(text || '')))) blocks.push(match[1]);
  return blocks;
}

function checkImports(code) {
  const missing = [];
  const imported = new Set();
  let hasUseLine = false;
  for (const line of code.split('\n')) {
    const m = /^\s*use\s+xiom\.([a-z_]+)\s*;/.exec(line);
    if (m) {
      hasUseLine = true;
      imported.add(m[1]);
      if (m[1] === 'io') imported.add('io');
      continue;
    }
    // `use local_module.item;` references a module defined in the project.
    const local = /^\s*use\s+([a-z_][a-z0-9_]*)\s*(\.|;)/i.exec(line);
    if (local && local[1] !== 'xiom') {
      hasUseLine = true;
      imported.add(local[1]);
    }
  }
  // Modules defined inside the block (e.g. `module math { ... }`) are local
  // and need no `use`.
  for (const m of code.matchAll(/\bmodule\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g)) imported.add(m[1]);
  for (const mod of MODULES) {
    if (imported.has(mod)) continue;
    const used = new RegExp('(^|[^.\\w])' + mod + '\\.').test(code);
    if (used) missing.push({ module: mod, hasAnyUse: hasUseLine });
  }
  return missing;
}

function checkHardcodedOutput(lesson) {
  const solution = String(lesson.solution || '');
  const expected = new Set(String(lesson.expected_output || '').split('\n').map((line) => line.trim()).filter(Boolean));
  const assigned = [...solution.matchAll(/\b(?:let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  if (!assigned.length) return [];
  const findings = [];
  // (a) a pure numeric/boolean literal printed where the answer is computed.
  for (const m of solution.matchAll(/io\.print(?:ln)?\(\s*"([^"]*)"\s*\)/g)) {
    const literal = m[1];
    const numeric = /^-?\d+(\.\d+)?$/.test(literal) || literal === 'true' || literal === 'false';
    if (numeric && expected.has(literal)) findings.push(literal);
  }
  // (b) a computed variable is never used while a matching expected line is
  // printed as a fixed sentence (e.g. `io.println("Double 5 is 10")`).
  const unused = assigned.filter((name) => {
    const rest = solution.replace(new RegExp('\\b(?:let|var)\\s+' + name + '\\b'), '');
    return !new RegExp('\\b' + name + '\\b').test(rest);
  });
  if (unused.length) {
    for (const m of solution.matchAll(/io\.println\(\s*"([^"]*)"\s*\)/g)) {
      const literal = m[1].trim();
      if (expected.has(literal) && /\d/.test(literal)) {
        findings.push(literal + '" (never uses computed: ' + unused.join(', '));
        break;
      }
    }
  }
  return findings;
}

function checkQuestionArtifacts(text) {
  const findings = [];
  const re = /\S*\s\?\s+(skip|stop|print|gives?|[A-F]\b)/g;
  let match;
  while ((match = re.exec(String(text || '')))) findings.push(match[0].trim().slice(0, 40));
  return findings;
}

function run() {
  const files = collect(LESSONS_DIR, []);
  const reports = [];
  for (const file of files) {
    const lesson = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!lesson.id) continue;
    const issues = { error: [], warn: [], info: [] };
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    const hardcoded = checkHardcodedOutput(lesson);
    for (const literal of hardcoded) {
      issues.error.push('solution prints the hard-coded literal "' + literal + '" instead of the computed variable');
    }

    const narrative = String(lesson.narrative || '');
    for (const block of codeBlocks(narrative)) {
      for (const miss of checkImports(block)) {
        const message = 'narrative code block uses "' + miss.module + '.*" without `use xiom.' + miss.module + ';`';
        if (miss.hasAnyUse) issues.error.push(message);
        else issues.info.push(message + ' (block is an inline fragment)');
      }
    }
    const solutionMissing = checkImports(String(lesson.solution || ''));
    for (const miss of solutionMissing) {
      const message = 'solution uses "' + miss.module + '.*" without `use xiom.' + miss.module + ';`';
      if (miss.hasAnyUse) issues.error.push(message);
      else issues.info.push(message + ' (solution may rely on the template imports)');
    }
    const templateMissing = checkImports(String(lesson.code_template || ''));
    for (const miss of templateMissing) {
      if (miss.hasAnyUse) issues.error.push('code_template uses "' + miss.module + '.*" without `use xiom.' + miss.module + ';`');
    }

    for (const artifact of checkQuestionArtifacts([lesson.story, lesson.why, narrative, lesson.analogy, (lesson.tips || []).join('\n'), (lesson.common_mistakes || []).join('\n')].join('\n'))) {
      issues.warn.push('text artifact: "' + artifact + '" (a lost arrow?)');
    }

    if (issues.error.length || issues.warn.length || issues.info.length) {
      reports.push({ id: lesson.id, title: lesson.title, file: rel, issues });
    }
  }
  return reports;
}

function main() {
  const args = process.argv.slice(2);
  const jsonIndex = args.indexOf('--json');
  const strict = args.includes('--strict');
  const reports = run();
  const errors = reports.reduce((n, r) => n + r.issues.error.length, 0);
  const warns = reports.reduce((n, r) => n + r.issues.warn.length, 0);
  const infos = reports.reduce((n, r) => n + r.issues.info.length, 0);
  console.log(CYAN + 'Lesson code audit' + RESET + ' - ' + reports.length + ' lessons with findings');
  console.log('  errors: ' + errors + '  warnings: ' + warns + '  info: ' + infos);
  const withErrors = reports.filter((r) => r.issues.error.length);
  if (withErrors.length) {
    console.log(RED + '\nErrors:' + RESET);
    for (const r of withErrors) {
      console.log('  ' + r.id + ' ' + r.title);
      for (const issue of r.issues.error) console.log('    - ' + issue);
    }
  }
  const withWarns = reports.filter((r) => r.issues.warn.length);
  if (withWarns.length) {
    console.log(YELLOW + '\nWarnings:' + RESET);
    for (const r of withWarns) {
      console.log('  ' + r.id + ' ' + r.title);
      for (const issue of r.issues.warn) console.log('    - ' + issue);
    }
  }
  const withInfos = reports.filter((r) => r.issues.info.length && !r.issues.error.length && !r.issues.warn.length);
  if (withInfos.length) {
    console.log(YELLOW + '\nInfo (' + withInfos.length + ' lessons, first 20):' + RESET);
    for (const r of withInfos.slice(0, 20)) {
      console.log('  ' + r.id + ' ' + r.title);
      for (const issue of r.issues.info.slice(0, 2)) console.log('    - ' + issue);
    }
  }
  if (jsonIndex >= 0) {
    const out = args[jsonIndex + 1] || path.join(ROOT, 'tools', 'lesson-code-report.json');
    fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), reports }, null, 2) + '\n', 'utf8');
    console.log('json written: ' + path.relative(ROOT, out));
  }
  if (strict && errors > 0) process.exit(1);
}

main();
