// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Algorithm Lab audit: run every Lab program on the pinned toolchain and
 * validate what it prints.
 *
 * For each program (twice, determinism):
 *   - it compiles and runs (exit 0, no timeout);
 *   - every non-empty output line is a valid v1 trace event;
 *   - the trace starts with `init` and ends with `done`;
 *   - no event is missing its `step` name;
 *   - every traced step has a matching "// @step" annotation in the source,
 *     and no annotation is dead;
 *   - the two runs produce identical output.
 *
 * Usage:
 *   node tools/lab-audit.js                    # native execution (Linux/macOS/CI)
 *   node tools/lab-audit.js --wsl              # Windows dev box: run in WSL Ubuntu
 *   node tools/lab-audit.js --wsl-toolchain /home/lefteris/xiom_v0623/tc
 *   node tools/lab-audit.js --id lab-bfs,lab-dfs
 *   node tools/lab-audit.js --runs 2 --timeout 60000 --quiet
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { REPO, XIOM_BIN, childEnv, TOOLCHAIN_VERSION } = require('./lib/toolchain');
const { runProcess } = require('../lib/run-xiom');
const { labParseTrace, labExtractAnnotations } = require('../js/lab-trace');
const { normalizeOutput } = require('./lib/output');

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}

const WSL = args.includes('--wsl');
const WSL_DISTRO = argValue('--wsl-distro', 'Ubuntu');
const WSL_TOOLCHAIN = argValue('--wsl-toolchain', '/home/lefteris/xiom_audit/tc');
const ONLY_IDS = argValue('--id', null);
const RUNS = Math.max(1, Number(argValue('--runs', '2')));
const TIMEOUT = Math.max(1000, Number(argValue('--timeout', '60000')));
const QUIET = args.includes('--quiet');

const MANIFEST_FILE = path.join(REPO, 'lessons', 'lab', 'manifest.json');
const PROGRAMS_DIR = path.join(REPO, 'lessons', 'lab', 'programs');

function loadEntries() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const wanted = ONLY_IDS ? new Set(ONLY_IDS.split(',').map((id) => id.trim()).filter(Boolean)) : null;
  return manifest.entries
    .filter((entry) => !wanted || wanted.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      program: entry.program,
      file: path.join(PROGRAMS_DIR, entry.program),
      source: fs.readFileSync(path.join(PROGRAMS_DIR, entry.program), 'utf8').replace(/\r\n/g, '\n'),
    }));
}

// ---------------------------------------------------------------------------
// Native execution (Linux/macOS)
// ---------------------------------------------------------------------------

async function nativeRuns(entries) {
  const results = new Map();
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xiom_lab_audit_'));
  for (const entry of entries) {
    const dir = path.join(workRoot, entry.id);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, entry.program);
    fs.writeFileSync(file, entry.source, 'utf8');
    const runs = [];
    for (let runIndex = 0; runIndex < RUNS; runIndex++) {
      const proc = await runProcess(XIOM_BIN, ['run', '-O0', file], {
        cwd: dir,
        env: childEnv,
        timeoutMs: TIMEOUT,
      });
      runs.push({ code: proc.success ? 0 : (proc.timedOut ? -2 : (proc.code || -1)), stdout: proc.stdout, stderr: proc.stderr });
    }
    results.set(entry.id, runs);
    if (!QUIET) console.log('  ran ' + entry.id);
  }
  fs.rmSync(workRoot, { recursive: true, force: true });
  return results;
}

// ---------------------------------------------------------------------------
// WSL execution (Windows dev box): one bash worker runs the whole audit
// ---------------------------------------------------------------------------

function toWslPath(winPath) {
  const match = /^([A-Za-z]):\\(.*)$/.exec(winPath);
  if (!match) return winPath.replace(/\\/g, '/');
  return '/mnt/' + match[1].toLowerCase() + '/' + match[2].replace(/\\/g, '/');
}

function runWslStreaming(argv, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('wsl.exe', argv, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ code: -1, stderr: String((err && err.message) || err), timedOut: false });
      return;
    }
    let stderrTail = '';
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-4000);
      if (!QUIET) process.stderr.write(text);
    });
    child.stdout.on('data', (chunk) => {
      if (!QUIET) process.stdout.write(chunk);
    });
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: typeof code === 'number' ? code : -1, stderr: stderrTail, timedOut });
    };
    child.on('error', () => finish(-1));
    child.on('close', (code) => finish(code));
  });
}

async function wslRuns(entries) {
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xiom_lab_audit_'));
  const resultsDir = path.join(workRoot, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  for (const entry of entries) {
    fs.copyFileSync(entry.file, path.join(workRoot, entry.id + '.xi'));
  }

  const script = [
    'set -u',
    'TC="' + WSL_TOOLCHAIN + '"',
    'WORK="' + toWslPath(workRoot) + '"',
    'rm -rf /tmp/xiom_lab_audit',
    'mkdir -p /tmp/xiom_lab_audit/home "$WORK/results"',
    'cp "$WORK"/*.xi /tmp/xiom_lab_audit/',
    'cd /tmp/xiom_lab_audit',
    ...entries.flatMap((entry) => Array.from({ length: RUNS }, (_, i) => i + 1).map((runIndex) =>
      'HOME=/tmp/xiom_lab_audit/home XIOM_STDLIB="$TC/lib" "$TC/bin/xiom" run -O0 "' + entry.id + '.xi" ' +
      '> "$WORK/results/' + entry.id + '.r' + runIndex + '.out" 2> "$WORK/results/' + entry.id + '.r' + runIndex + '.err"; ' +
      'printf "%s" "$?" > "$WORK/results/' + entry.id + '.r' + runIndex + '.code"'
    )),
    'echo LAB_AUDIT_DONE',
    '',
  ].join('\n');

  const scriptPath = path.join(workRoot, 'lab_audit.sh');
  fs.writeFileSync(scriptPath, script.replace(/\r\n/g, '\n'), 'utf8');

  console.log('Running ' + entries.length + ' Lab programs x ' + RUNS + ' in WSL ' + WSL_DISTRO + '...');
  const proc = await runWslStreaming(
    ['-d', WSL_DISTRO, '--', 'bash', toWslPath(scriptPath)],
    Math.max(120000, entries.length * RUNS * TIMEOUT)
  );
  if (proc.timedOut) throw new Error('WSL audit timed out');

  const results = new Map();
  for (const entry of entries) {
    const runs = [];
    for (let runIndex = 1; runIndex <= RUNS; runIndex++) {
      const base = path.join(resultsDir, entry.id + '.r' + runIndex);
      if (!fs.existsSync(base + '.code')) {
        runs.push({ code: -1, stdout: '', stderr: 'worker produced no result (WSL failure?)' });
        continue;
      }
      runs.push({
        code: Number(fs.readFileSync(base + '.code', 'utf8').trim()) || 0,
        stdout: fs.readFileSync(base + '.out', 'utf8'),
        stderr: fs.readFileSync(base + '.err', 'utf8'),
      });
    }
    results.set(entry.id, runs);
  }
  fs.rmSync(workRoot, { recursive: true, force: true });
  return results;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEntry(entry, runs) {
  const problems = [];
  const annotations = labExtractAnnotations(entry.source);
  const usedSteps = new Set();
  const firstLines = [];

  runs.forEach((run, index) => {
    const label = 'run ' + (index + 1) + ': ';
    if (run.code !== 0) {
      const stderrLine = String(run.stderr || '').trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || '';
      problems.push(label + 'exit code ' + run.code + (stderrLine ? ' (' + stderrLine.slice(0, 160) + ')' : ''));
      return;
    }
    const parsed = labParseTrace(run.stdout);
    firstLines.push(parsed);
    if (!parsed.ok) {
      const detail = parsed.errors.map((error) => 'line ' + error.line + ' ' + error.reason).join(', ');
      problems.push(label + 'invalid trace (' + detail + ')');
    }
    if (parsed.ignored.length > 0) {
      problems.push(label + 'non-trace output: "' + parsed.ignored[0].text.slice(0, 80) + '"');
    }
    if (parsed.truncated) problems.push(label + 'trace exceeds the event limit');
    if (parsed.events.length === 0) {
      problems.push(label + 'empty trace');
      return;
    }
    if (parsed.events[0].event !== 'init') problems.push(label + 'first event is "' + parsed.events[0].event + '", expected init');
    let sawDone = false;
    for (const event of parsed.events) {
      if (event.step) usedSteps.add(event.step);
      if (event.event === 'done') sawDone = true;
      if (event.event !== 'done' && !event.step) problems.push(label + 'event "' + event.event + '" has no step');
    }
    if (!sawDone) problems.push(label + 'no done event');
  });

  if (runs.length >= 2) {
    const a = normalizeOutput(runs[0].stdout);
    const b = normalizeOutput(runs[1].stdout);
    if (a !== b) problems.push('not deterministic across runs');
  }

  for (const step of usedSteps) {
    if (!annotations.map[step]) problems.push('step "' + step + '" has no // @step annotation');
  }
  for (const name of annotations.names) {
    if (!usedSteps.has(name)) problems.push('annotation "' + name + '" is never emitted');
  }

  const first = firstLines[0];
  return {
    problems,
    events: first ? first.events.length : 0,
    steps: usedSteps.size,
    annotations: annotations.names.length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const entries = loadEntries();
  if (entries.length === 0) {
    console.error('error: no Lab entries selected');
    process.exit(1);
  }

  if (WSL && process.platform !== 'win32') {
    console.error('error: --wsl is only meaningful on Windows; run natively on Linux.');
    process.exit(1);
  }
  if (!WSL && process.platform === 'win32') {
    console.error('error: program execution hangs on Windows clang; use --wsl (Linux audit).');
    process.exit(1);
  }

  console.log('Algorithm Lab audit - toolchain ' + TOOLCHAIN_VERSION +
    ' (' + (WSL ? 'WSL ' + WSL_DISTRO + ' ' + WSL_TOOLCHAIN : XIOM_BIN) + ')');

  const results = WSL ? await wslRuns(entries) : await nativeRuns(entries);

  const failures = [];
  console.log('');
  console.log('  entry                          events  steps  annotations  status');
  for (const entry of entries) {
    const report = validateEntry(entry, results.get(entry.id) || []);
    const status = report.problems.length === 0 ? 'ok' : 'FAIL';
    console.log('  ' + entry.id.padEnd(30) + ' ' + String(report.events).padStart(6) + '  ' +
      String(report.steps).padStart(5) + '  ' + String(report.annotations).padStart(11) + '  ' + status);
    if (report.problems.length > 0) {
      failures.push({ entry: entry.id, problems: report.problems });
      for (const problem of report.problems) console.log('      - ' + problem);
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.error('Lab audit FAILED: ' + failures.length + ' of ' + entries.length + ' programs have problems.');
    process.exit(1);
  }
  console.log('Lab audit passed: ' + entries.length + ' programs, ' + RUNS + ' run(s) each.');
}

main().catch((err) => {
  console.error('error: ' + ((err && err.message) || err));
  process.exit(1);
});
