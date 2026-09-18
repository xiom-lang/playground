// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Lesson audit: compile every lesson solution + template against the installed
 * XIOM toolchain, execute the solutions that type-check, and report failures.
 *
 * Usage:
 *   node tools/lesson-audit.js [options]
 *
 * Options:
 *   --check-only          compile/type-check only (default: also run)
 *   --level <L3>          restrict to one level
 *   --json <path>         write the full JSON report
 *   --baseline <path>     compare against a baseline; exit 2 on regressions
 *   --update-baseline <p> write the current failures as a baseline
 *   --concurrency <N>     parallel checks (default 4)
 *   --timeout-check <ms>  per-check timeout (default 30000)
 *   --timeout-run <ms>    per-run timeout (default 30000)
 *   --quiet               summary only
 *
 * Toolchain resolution: XIOM_BIN (env) -> .toolchain/bin/xiom[.exe] ->
 * ../target/debug/xiom[.exe] -> xiom on PATH. XIOM_STDLIB defaults to
 * .toolchain/lib when present.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runProcess } = require('../lib/run-xiom');
const { REPO, XIOM_BIN, TOOLCHAIN_VERSION, childEnv } = require('./lib/toolchain');

const LESSONS = path.join(REPO, 'lessons');
const WORK_ROOT = path.join(os.tmpdir(), 'xiom_lesson_audit');

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const CHECK_ONLY = args.includes('--check-only');
const LEVEL = argValue('--level', null);
const JSON_OUT = argValue('--json', path.join(WORK_ROOT, 'report.json'));
const BASELINE = argValue('--baseline', null);
const UPDATE_BASELINE = argValue('--update-baseline', null);
const CONCURRENCY = Math.max(1, Number(argValue('--concurrency', '4')));
const TIMEOUT_CHECK = Number(argValue('--timeout-check', '30000'));
const TIMEOUT_RUN = Number(argValue('--timeout-run', '30000'));
const QUIET = args.includes('--quiet');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readUtf8Strict(file) {
  const bytes = fs.readFileSync(file);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function parseErrors(stderr) {
  const found = [];
  for (const line of String(stderr || '').split(/\r?\n/)) {
    const structured = line.match(/error\[([A-Za-z]\d+)\]:\s*(\d+):(\d+):\s*(.*)/);
    if (structured) {
      found.push({ code: structured[1], line: Number(structured[2]), col: Number(structured[3]), message: structured[4].trim() });
    } else if (/^error:\s*/.test(line) && !/compilation failed/.test(line)) {
      found.push({ code: 'E000', line: 0, col: 0, message: line.replace(/^error:\s*/, '').trim() });
    }
  }
  return found;
}

function firstSignature(errors) {
  if (!errors || errors.length === 0) return 'unknown';
  return errors[0].code + ': ' + errors[0].message.slice(0, 90);
}

function removeWorkRoot() {
  fs.rmSync(WORK_ROOT, { recursive: true, force: true });
  fs.mkdirSync(WORK_ROOT, { recursive: true });
}

function makeJobDir(id, kind) {
  const dir = path.join(WORK_ROOT, id + '-' + kind);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function checkSource(source, id, kind) {
  const dir = makeJobDir(id, kind);
  const file = path.join(dir, 'main.xi');
  fs.writeFileSync(file, source, 'utf8');
  const started = Date.now();
  const proc = await runProcess(XIOM_BIN, ['--check', file], { cwd: dir, env: childEnv, timeoutMs: TIMEOUT_CHECK });
  fs.rmSync(dir, { recursive: true, force: true });
  return {
    ok: proc.success,
    exit: proc.code,
    timedOut: proc.timedOut,
    ms: Date.now() - started,
    errors: parseErrors(proc.stderr),
    stderrTail: proc.stderr.slice(-400),
  };
}

async function runSource(source, id) {
  const dir = makeJobDir(id, 'r');
  const file = path.join(dir, 'main.xi');
  fs.writeFileSync(file, source, 'utf8');
  const started = Date.now();
  const proc = await runProcess(XIOM_BIN, ['run', file], { cwd: dir, env: childEnv, timeoutMs: TIMEOUT_RUN });
  fs.rmSync(dir, { recursive: true, force: true });
  return {
    ok: proc.success,
    exit: proc.code,
    timedOut: proc.timedOut,
    ms: Date.now() - started,
    stdout: proc.stdout.slice(0, 300),
    errors: parseErrors(proc.stderr),
    stderrTail: proc.stderr.slice(-400),
  };
}

async function mapPool(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function loadLessons() {
  const catalog = JSON.parse(fs.readFileSync(path.join(LESSONS, 'index.json'), 'utf8'));
  const entries = [];
  for (const level of catalog.levels) {
    if (LEVEL && level.id !== LEVEL) continue;
    for (const lesson of level.lessons) entries.push({ level: level.id, ...lesson });
  }
  return entries;
}

async function auditLesson(lesson) {
  const record = { id: lesson.id, level: lesson.level, title: lesson.title, file: lesson.file, check: null, template: null, run: null, encodingError: null };
  let data;
  try {
    data = JSON.parse(readUtf8Strict(path.join(LESSONS, lesson.file)));
  } catch (err) {
    record.encodingError = String((err && err.message) || err).slice(0, 160);
    return record;
  }
  if (data.solution) record.check = await checkSource(data.solution, lesson.id, 's');
  if (data.code_template) record.template = await checkSource(data.code_template, lesson.id, 't');
  if (!CHECK_ONLY && record.check && record.check.ok && data.solution) {
    record.run = await runSource(data.solution, lesson.id);
  }
  return record;
}

function summarize(records) {
  const byLevel = {};
  for (const record of records) {
    const bucket = byLevel[record.level] || (byLevel[record.level] = { total: 0, solutionOk: 0, solutionFail: 0, templateFail: 0, runFail: 0, encodingFail: 0 });
    bucket.total++;
    if (record.encodingError) bucket.encodingFail++;
    if (record.check && record.check.ok) bucket.solutionOk++;
    if (record.check && !record.check.ok) bucket.solutionFail++;
    if (record.template && !record.template.ok) bucket.templateFail++;
    if (record.run && !record.run.ok) bucket.runFail++;
  }
  return byLevel;
}

function failureSets(records) {
  return {
    encoding: records.filter((r) => r.encodingError).map((r) => r.id),
    template: records.filter((r) => r.template && !r.template.ok).map((r) => r.id),
    solution: records.filter((r) => r.check && !r.check.ok).map((r) => r.id),
    runtime: records.filter((r) => r.run && !r.run.ok).map((r) => r.id),
  };
}

function printSummary(records, byLevel, failures) {
  console.log('');
  console.log('Lesson audit - toolchain ' + TOOLCHAIN_VERSION + ' (' + XIOM_BIN + ')');
  console.log('level   total  sol_ok  sol_fail  tpl_fail  run_fail  enc_fail');
  for (const level of Object.keys(byLevel).sort()) {
    const b = byLevel[level];
    console.log(
      level.padEnd(7) + String(b.total).padStart(5) + String(b.solutionOk).padStart(8) + String(b.solutionFail).padStart(10) +
      String(b.templateFail).padStart(10) + String(b.runFail).padStart(10) + String(b.encodingFail).padStart(10)
    );
  }
  const total = records.length;
  console.log(
    'TOTAL  ' + String(total).padStart(5) + String(failures.solution.length ? total - failures.solution.length : total).padStart(8) +
    String(failures.solution.length).padStart(10) + String(failures.template.length).padStart(10) +
    String(failures.runtime.length).padStart(10) + String(failures.encoding.length).padStart(10)
  );
  const signatures = {};
  for (const record of records) {
    if (record.check && !record.check.ok) {
      const sig = firstSignature(record.check.errors);
      signatures[sig] = (signatures[sig] || 0) + 1;
    }
  }
  const top = Object.entries(signatures).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length > 0) {
    console.log('');
    console.log('Top solution failures:');
    for (const [sig, count] of top) console.log('  ' + String(count).padStart(4) + 'x  ' + sig);
  }
}

function loadBaseline(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function compareBaseline(baseline, failures, ranSolutions) {
  const regressions = [];
  const fixed = [];
  for (const kind of ['encoding', 'template', 'solution', 'runtime']) {
    if (kind === 'runtime' && !ranSolutions) continue;
    const known = new Set((baseline.known && baseline.known[kind]) || []);
    const current = new Set(failures[kind]);
    for (const id of current) if (!known.has(id)) regressions.push(kind + ':' + id);
    for (const id of known) if (!current.has(id)) fixed.push(kind + ':' + id);
  }
  return { regressions, fixed };
}

function writeBaseline(file, baseline, failures, ranSolutions) {
  const known = {
    encoding: failures.encoding,
    template: failures.template,
    solution: failures.solution,
    runtime: ranSolutions ? failures.runtime : ((baseline && baseline.known && baseline.known.runtime) || []),
  };
  const payload = {
    toolchain: TOOLCHAIN_VERSION,
    generated: new Date().toISOString(),
    known,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  console.log('Baseline written: ' + file);
}

async function main() {
  if (!fs.existsSync(XIOM_BIN) && !/^xiom/.test(path.basename(XIOM_BIN))) {
    console.error('error: XIOM compiler not found at ' + XIOM_BIN);
    console.error('hint: run tools/fetch-toolchain.sh (or .ps1), or set XIOM_BIN.');
    process.exit(1);
  }
  const lessons = loadLessons();
  if (lessons.length === 0) {
    console.error('error: no lessons found (level filter: ' + LEVEL + ')');
    process.exit(1);
  }
  removeWorkRoot();
  const records = await mapPool(lessons, CONCURRENCY, (lesson) => auditLesson(lesson));
  const byLevel = summarize(records);
  const failures = failureSets(records);
  if (!QUIET) printSummary(records, byLevel, failures);

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify({ generated: new Date().toISOString(), toolchain: TOOLCHAIN_VERSION, compiler: XIOM_BIN, checkOnly: CHECK_ONLY, byLevel, failures, results: records }, null, 1));
  console.log('');
  console.log('report: ' + JSON_OUT);

  const baseline = BASELINE ? loadBaseline(BASELINE) : null;
  if (UPDATE_BASELINE) writeBaseline(UPDATE_BASELINE, baseline, failures, !CHECK_ONLY);
  if (BASELINE) {
    if (!baseline) {
      console.error('error: baseline not found: ' + BASELINE);
      process.exit(1);
    }
    const { regressions, fixed } = compareBaseline(baseline, failures, !CHECK_ONLY);
    if (fixed.length > 0) {
      console.log('');
      console.log('Fixed since baseline (' + fixed.length + '): ' + fixed.slice(0, 30).join(', ') + (fixed.length > 30 ? ', ...' : ''));
    }
    if (regressions.length > 0) {
      console.log('');
      console.error('REGRESSIONS (' + regressions.length + '):');
      for (const item of regressions) console.error('  ' + item);
      process.exit(2);
    }
    console.log('');
    console.log('No regressions against baseline' + (baseline.toolchain && baseline.toolchain !== TOOLCHAIN_VERSION ? ' (baseline toolchain ' + baseline.toolchain + ')' : '') + '.');
  }
}

main().catch((err) => {
  console.error('lesson audit failed: ' + ((err && err.stack) || err));
  process.exit(1);
});
