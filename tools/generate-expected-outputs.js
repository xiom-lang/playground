// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Generate `expected_output` for every runnable lesson from a Linux execution
 * sweep, and gate the lesson data in CI.
 *
 * A lesson gets `expected_output` only when every execution of its solution
 * succeeds and produces byte-identical output; lessons whose output varies
 * between runs (random values, addresses, timing) are recorded in
 * `tools/expected-output-skips.json` and left without the field so CI cannot
 * become flaky. Lessons listed in `js/limitations.json` (compiler codegen
 * defects) are skipped entirely.
 *
 * Usage:
 *   node tools/generate-expected-outputs.js               # sweep + write
 *   node tools/generate-expected-outputs.js --dry-run     # sweep, report only
 *   node tools/generate-expected-outputs.js --check       # data-level gate, no execution
 *   node tools/generate-expected-outputs.js --level L0
 *   node tools/generate-expected-outputs.js --runs 3 --concurrency 4
 *   node tools/generate-expected-outputs.js --wsl         # Windows dev box: run in WSL Ubuntu
 *
 * Options:
 *   --check             assert every runnable lesson has expected_output (or a
 *                       skip entry) and every blocked lesson has none; exit 1
 *                       otherwise (CI gate)
 *   --dry-run           execute and report but do not touch lesson files
 *   --runs <N>          executions per solution (default 2; determinism check)
 *   --level <L3>        restrict to one level
 *   --id <L3-03,L4-01>  restrict to a comma-separated list of lesson ids
 *   --concurrency <N>   parallel executions (default 4)
 *   --timeout <ms>      per-execution timeout (default 30000)
 *   --wsl               execute through the WSL Ubuntu Linux toolchain
 *   --wsl-distro <name> WSL distribution (default Ubuntu)
 *   --wsl-toolchain <p> Linux toolchain root (default /home/lefteris/xiom_audit/tc)
 *   --quiet             summary only
 *
 * The pinned toolchain is used in native mode (XIOM_BIN -> .toolchain/bin/xiom
 * -> ../target/debug/xiom -> PATH). Windows cannot execute programs (clang
 * hangs at -O2), so native mode is Linux/macOS only; use --wsl on Windows.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { runProcess, killTree } = require('../lib/run-xiom');
const { REPO, XIOM_BIN, TOOLCHAIN_VERSION, childEnv } = require('./lib/toolchain');
const { normalizeOutput } = require('./lib/output');

const LESSONS = path.join(REPO, 'lessons');
const LIMITATIONS = path.join(REPO, 'js', 'limitations.json');
const SKIPS = path.join(REPO, 'tools', 'expected-output-skips.json');
const MAX_EXPECTED_CHARS = 20000;

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}
const CHECK = args.includes('--check');
const DRY_RUN = args.includes('--dry-run');
const WSL = args.includes('--wsl');
const WSL_DISTRO = argValue('--wsl-distro', 'Ubuntu');
const WSL_TOOLCHAIN = argValue('--wsl-toolchain', '/home/lefteris/xiom_audit/tc');
const LEVEL = argValue('--level', null);
const IDS = argValue('--id', null);
const ONLY_IDS = IDS ? new Set(IDS.split(',').map((id) => id.trim()).filter(Boolean)) : null;
const RUNS = Math.max(1, Number(argValue('--runs', '2')));
const CONCURRENCY = Math.max(1, Number(argValue('--concurrency', '4')));
const TIMEOUT = Math.max(1000, Number(argValue('--timeout', '30000')));
const QUIET = args.includes('--quiet');

// ---------------------------------------------------------------------------
// Lesson file surgery
// ---------------------------------------------------------------------------

/** JSON string literal that stays pure ASCII (repo rule). */
function jsonAscii(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (ch) =>
    '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
}

/**
 * Insert, replace, or remove the top-level `expected_output` field in a lesson
 * JSON file while leaving every other byte untouched. Lesson files use both
 * LF and CRLF line endings; both are preserved.
 * @param {string} raw file text
 * @param {string|null} value new value, or null to remove the field
 * @returns {string|null} new text, or null when nothing changed
 */
function setExpectedOutputField(raw, value) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const fieldRe = /^([ \t]*)"expected_output":\s*"(?:[^"\\]|\\.)*"/m;
  const solutionRe = /^([ \t]*)"solution":\s*"(?:[^"\\]|\\.)*"/m;

  if (value === null) {
    const removalRe = /^[ \t]*"expected_output":\s*"(?:[^"\\]|\\.)*",\r?\n/m;
    if (removalRe.test(raw)) return raw.replace(removalRe, () => '');
    // Defensive: field present without a trailing comma (never emitted here).
    const bareRe = /,\r?\n[ \t]*"expected_output":\s*"(?:[^"\\]|\\.)*"/m;
    if (bareRe.test(raw)) return raw.replace(bareRe, () => '');
    return null;
  }

  const literal = jsonAscii(value);
  const existing = raw.match(fieldRe);
  if (existing) {
    // Function form keeps `$` sequences in program output literal.
    const next = raw.replace(fieldRe, () => existing[1] + '"expected_output": ' + literal);
    return next === raw ? null : next;
  }

  const match = raw.match(solutionRe);
  if (!match) return null;
  const next = raw.replace(solutionRe, () => match[0] + ',' + eol + match[1] + '"expected_output": ' + literal);
  return next === raw ? null : next;
}

// ---------------------------------------------------------------------------
// Job model
// ---------------------------------------------------------------------------

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadJobs() {
  const catalog = readJson(path.join(LESSONS, 'index.json'));
  const limitations = readJson(LIMITATIONS);
  const blocked = new Set((limitations.lessons || []).map((entry) => entry.id));

  const jobs = [];
  const skipped = [];
  for (const level of catalog.levels) {
    if (LEVEL && level.id !== LEVEL) continue;
    for (const lesson of level.lessons) {
      if (ONLY_IDS && !ONLY_IDS.has(lesson.id)) continue;
      const file = path.join(LESSONS, lesson.file);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (err) {
        skipped.push({ id: lesson.id, reason: 'unreadable JSON: ' + err.message });
        continue;
      }
      if (blocked.has(lesson.id)) {
        skipped.push({ id: lesson.id, reason: 'known compiler limitation' });
        continue;
      }
      if (typeof data.solution !== 'string' || data.solution.length === 0) {
        skipped.push({ id: lesson.id, reason: 'no solution' });
        continue;
      }
      jobs.push({
        id: lesson.id,
        level: level.id,
        title: lesson.title,
        file,
        solution: data.solution,
        existing: typeof data.expected_output === 'string' ? data.expected_output : null,
      });
    }
  }
  return { jobs, skipped };
}

function classifyRuns(result) {
  const runs = result && result.runs ? result.runs : [];
  if (runs.length < RUNS || runs.some((run) => !run.ok)) {
    const bad = runs.find((run) => !run.ok);
    const reason = result && result.error
      ? result.error
      : bad && bad.timedOut
        ? 'execution timed out'
        : bad && bad.stderrTail
          ? String(bad.stderrTail).split(/\r?\n/).filter(Boolean).pop()
          : 'execution failed';
    return { status: 'failed', reason: String(reason).slice(0, 160) };
  }
  const outputs = runs.map((run) => normalizeOutput(run.stdout));
  if (outputs.some((output) => output !== outputs[0])) {
    return { status: 'nondeterministic', samples: outputs.map((output) => output.slice(0, 120)) };
  }
  if (outputs[0].length > MAX_EXPECTED_CHARS) {
    return { status: 'too-long', length: outputs[0].length };
  }
  return { status: 'ok', output: outputs[0] };
}

// ---------------------------------------------------------------------------
// Native execution (Linux/macOS)
// ---------------------------------------------------------------------------

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

async function nativeRun(job, runIndex) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiom_expected_'));
  const file = path.join(dir, 'main.xi');
  fs.writeFileSync(file, job.solution, 'utf8');
  const started = Date.now();
  const proc = await runProcess(XIOM_BIN, ['run', file], { cwd: dir, env: childEnv, timeoutMs: TIMEOUT });
  fs.rmSync(dir, { recursive: true, force: true });
  return {
    ok: proc.success,
    exit: proc.code,
    timedOut: proc.timedOut,
    ms: Date.now() - started,
    stdout: proc.stdout,
    stderrTail: proc.stderr.slice(-400),
  };
}

async function nativeSweep(jobs) {
  return mapPool(jobs, CONCURRENCY, async (job) => {
    const runs = [];
    for (let runIndex = 0; runIndex < RUNS; runIndex++) {
      runs.push(await nativeRun(job, runIndex));
    }
    return { id: job.id, runs };
  });
}

// ---------------------------------------------------------------------------
// WSL execution (Windows dev box): one python3 worker runs the whole sweep
// because Node is not installed inside WSL.
// ---------------------------------------------------------------------------

const PY_WORKER = [
  '#!/usr/bin/env python3',
  '"""Expected-output sweep worker. Invoked by tools/generate-expected-outputs.js."""',
  'import json, os, shutil, signal, subprocess, sys, time',
  'from concurrent.futures import ThreadPoolExecutor',
  '',
  'def as_text(value):',
  '    if value is None:',
  '        return ""',
  '    return value if isinstance(value, str) else value.decode("utf-8", "replace")',
  '',
  'def run_one(job, run_index, binary, env, timeout_s, work):',
  '    run_dir = os.path.join(work, job["id"] + "-r" + str(run_index))',
  '    shutil.rmtree(run_dir, ignore_errors=True)',
  '    os.makedirs(run_dir, exist_ok=True)',
  '    source = os.path.join(run_dir, "main.xi")',
  '    with open(source, "w", encoding="utf-8") as fh:',
  '        fh.write(job.get("source", ""))',
  '    started = time.time()',
  '    timed_out = False',
  '    code = -1',
  '    out = ""',
  '    err = ""',
  '    proc = None',
  '    try:',
  '        proc = subprocess.Popen([binary, "run", source], cwd=run_dir, env=env,',
  '                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,',
  '                                text=True, start_new_session=True)',
  '        try:',
  '            out, err = proc.communicate(timeout=timeout_s)',
  '            code = proc.returncode',
  '        except subprocess.TimeoutExpired:',
  '            timed_out = True',
  '            try:',
  '                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)',
  '            except Exception:',
  '                proc.kill()',
  '            out, err = proc.communicate()',
  '    except Exception as exc:  # noqa: BLE001',
  '        err = str(exc)',
  '    shutil.rmtree(run_dir, ignore_errors=True)',
  '    return {"ok": code == 0 and not timed_out, "exit": code, "timedOut": timed_out,',
  '            "ms": int((time.time() - started) * 1000), "stdout": as_text(out),',
  '            "stderrTail": as_text(err)[-400:]}',
  '',
  'def main():',
  '    manifest = json.load(open(sys.argv[1], encoding="utf-8"))',
  '    out_path = sys.argv[2]',
  '    binary = manifest["compiler"]',
  '    stdlib = manifest["stdlib"]',
  '    runs = int(manifest.get("runs", 2))',
  '    timeout_s = float(manifest.get("timeoutMs", 30000)) / 1000.0',
  '    work = manifest.get("workRoot", "/tmp/xiom_expected")',
  '    conc = int(manifest.get("concurrency", 4))',
  '    jobs = manifest["jobs"]',
  '    env = dict(os.environ, XIOM_STDLIB=stdlib)',
  '    shutil.rmtree(work, ignore_errors=True)',
  '    os.makedirs(work, exist_ok=True)',
  '    lock = __import__("threading").Lock()',
  '    done = [0]',
  '    with open(out_path, "w", encoding="utf-8") as handle:',
  '        def work_one(job):',
  '            try:',
  '                record = {"id": job["id"], "runs": [run_one(job, i + 1, binary, env, timeout_s, work) for i in range(runs)]}',
  '            except Exception as exc:  # noqa: BLE001',
  '                record = {"id": job.get("id"), "runs": [], "error": str(exc)}',
  '            with lock:',
  '                handle.write(json.dumps(record, ensure_ascii=False) + "\\n")',
  '                handle.flush()',
  '                done[0] += 1',
  '                if done[0] % 25 == 0:',
  '                    print("... %d/%d" % (done[0], len(jobs)), file=sys.stderr, flush=True)',
  '        with ThreadPoolExecutor(max_workers=conc) as pool:',
  '            list(pool.map(work_one, jobs))',
  '',
  'if __name__ == "__main__":',
  '    main()',
  '',
].join('\n');

function toWslPath(winPath) {
  const match = /^([A-Za-z]):\\(.*)$/.exec(winPath);
  if (!match) return winPath.replace(/\\/g, '/');
  return '/mnt/' + match[1].toLowerCase() + '/' + match[2].replace(/\\/g, '/');
}

/** Spawn wsl.exe and relay the worker's progress lines while it runs. */
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
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-4000);
      if (!QUIET) process.stderr.write(text);
    });
    child.stdout.on('data', () => { /* the worker writes results to a file */ });
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: typeof code === 'number' ? code : -1, stderr: stderrTail, timedOut });
    };
    child.on('error', (err) => {
      stderrTail += String((err && err.message) || err);
      finish(-1);
    });
    child.on('close', (code) => finish(code));
  });
}

async function wslSweep(jobs) {
  const dir = path.join(os.tmpdir(), 'xiom_expected_sweep');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const workerPath = path.join(dir, 'sweep_worker.py');
  const manifestPath = path.join(dir, 'manifest.json');
  const outPath = path.join(dir, 'results.ndjson');
  fs.writeFileSync(workerPath, PY_WORKER, 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify({
    compiler: path.posix.join(WSL_TOOLCHAIN, 'bin', 'xiom'),
    stdlib: path.posix.join(WSL_TOOLCHAIN, 'lib'),
    runs: RUNS,
    timeoutMs: TIMEOUT,
    concurrency: CONCURRENCY,
    workRoot: '/tmp/xiom_expected',
    jobs: jobs.map((job) => ({ id: job.id, source: job.solution })),
  }), 'utf8');

  console.log('Running ' + jobs.length + ' solutions x ' + RUNS + ' in WSL ' + WSL_DISTRO +
    ' (concurrency ' + CONCURRENCY + ')...');
  const proc = await runWslStreaming([
    '-d', WSL_DISTRO, '--', 'python3', toWslPath(workerPath), toWslPath(manifestPath), toWslPath(outPath),
  ], Math.max(30 * 60 * 1000, jobs.length * RUNS * TIMEOUT));

  if (!fs.existsSync(outPath)) {
    const reason = proc.stderr.trim().split(/\r?\n/).slice(-3).join(' ') || 'no results file';
    throw new Error('WSL sweep produced no results: ' + reason);
  }
  const results = new Map();
  for (const line of fs.readFileSync(outPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      results.set(record.id, record);
    } catch {
      // A truncated trailing line means the worker died; classify below.
    }
  }
  if (!QUIET && proc.stderr.trim()) {
    const tail = proc.stderr.trim().split(/\r?\n/).slice(-2).join(' | ');
    console.log('worker: ' + tail);
  }
  return jobs.map((job) => results.get(job.id) || { id: job.id, runs: [], error: 'worker returned no result' });
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function loadSkips() {
  try {
    const data = readJson(SKIPS);
    return Array.isArray(data.lessons) ? data : { lessons: [] };
  } catch {
    return { lessons: [] };
  }
}

function writeSkips(entries) {
  const sorted = entries.slice().sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const payload = {
    toolchain: TOOLCHAIN_VERSION,
    generated: new Date().toISOString(),
    count: sorted.length,
    lessons: sorted,
  };
  let text = JSON.stringify(payload, null, 2) + '\n';
  let existing = null;
  try { existing = fs.readFileSync(SKIPS, 'utf8'); } catch { /* first generation */ }
  const comparable = (value) => value.replace(/"generated": "[^"]*"/, '"generated": ""');
  if (existing && comparable(existing) === comparable(text)) {
    const stamp = existing.match(/"generated": "([^"]*)"/);
    if (stamp) text = text.replace(/"generated": "[^"]*"/, '"generated": "' + stamp[1] + '"');
  }
  fs.writeFileSync(SKIPS, text);
}

function skipReason(verdict) {
  if (verdict.status === 'nondeterministic') return 'nondeterministic output';
  if (verdict.status === 'too-long') return 'output too long to store';
  return 'execution failed';
}

function checkMode(jobs, skippedLessons) {
  if (LEVEL || ONLY_IDS) {
    console.error('error: --check validates the whole catalog and cannot be combined with --level or --id.');
    process.exit(1);
  }
  const skipData = loadSkips();
  const skipIds = new Set(skipData.lessons.map((entry) => entry.id));
  const runnableIds = new Set(jobs.map((job) => job.id));
  const violations = [];

  for (const job of jobs) {
    const hasExpected = typeof job.existing === 'string';
    const isSkipped = skipIds.has(job.id);
    if (hasExpected && isSkipped) {
      violations.push(job.id + ': has expected_output and is also listed as skipped');
    } else if (!hasExpected && !isSkipped) {
      violations.push(job.id + ': missing expected_output and not listed in tools/expected-output-skips.json');
    }
  }
  for (const entry of skipData.lessons) {
    if (!runnableIds.has(entry.id)) {
      violations.push(entry.id + ': skip entry for a lesson that is not runnable (regenerate or remove)');
    }
  }
  for (const entry of skippedLessons) {
    if (entry.reason !== 'known compiler limitation') continue;
    const raw = fs.readFileSync(path.join(LESSONS, lessonFileFor(entry.id)), 'utf8');
    if (/"expected_output"/.test(raw)) violations.push(entry.id + ': blocked lesson must not have expected_output');
    if (skipIds.has(entry.id)) violations.push(entry.id + ': blocked lesson must not be in the skip list');
  }

  const withField = jobs.filter((job) => typeof job.existing === 'string').length;
  console.log('expected outputs: ' + withField + '/' + jobs.length + ' runnable lessons' +
    ', ' + skipIds.size + ' skipped (nondeterministic/too long), ' + skippedLessons.length + ' blocked');
  if (violations.length > 0) {
    console.error('error: expected outputs are incomplete or inconsistent:');
    for (const violation of violations.slice(0, 20)) console.error('  ' + violation);
    if (violations.length > 20) console.error('  ... and ' + (violations.length - 20) + ' more');
    process.exit(1);
  }
  console.log('expected outputs are up to date (run the tool on Linux to refresh them).');
}

let catalogIndex = null;
function lessonFileFor(id) {
  if (!catalogIndex) {
    catalogIndex = new Map();
    const catalog = readJson(path.join(LESSONS, 'index.json'));
    for (const level of catalog.levels) {
      for (const lesson of level.lessons) catalogIndex.set(lesson.id, lesson.file);
    }
  }
  return catalogIndex.get(id);
}

async function main() {
  const { jobs, skipped } = loadJobs();
  if (jobs.length === 0) {
    console.error('error: no runnable lessons found (level filter: ' + LEVEL + ')');
    process.exit(1);
  }

  if (CHECK) {
    checkMode(jobs, skipped);
    return;
  }

  if (WSL && process.platform !== 'win32') {
    console.error('error: --wsl is only meaningful on Windows; run natively on Linux.');
    process.exit(1);
  }
  if (!WSL && process.platform === 'win32') {
    console.error('error: program execution hangs on Windows clang; use --wsl (Linux sweep).');
    process.exit(1);
  }
  if (!WSL && !fs.existsSync(XIOM_BIN) && !/^xiom/.test(path.basename(XIOM_BIN))) {
    console.error('error: XIOM compiler not found at ' + XIOM_BIN);
    console.error('hint: run tools/fetch-toolchain.sh, or set XIOM_BIN.');
    process.exit(1);
  }

  console.log('Sweep: ' + jobs.length + ' runnable lessons, ' + skipped.length + ' skipped, toolchain ' + TOOLCHAIN_VERSION);
  const results = WSL ? await wslSweep(jobs) : await nativeSweep(jobs);

  const failures = [];
  const nondeterministic = [];
  const tooLong = [];
  const skipById = new Map(loadSkips().lessons.map((entry) => [entry.id, entry]));
  let unchanged = 0;
  let written = 0;
  let okCount = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const verdict = classifyRuns(results[i]);

    if (verdict.status === 'failed') {
      // Leave lesson data and any previous skip entry untouched; the audit and
      // a re-run are the right places to resolve an execution failure.
      failures.push({ id: job.id, reason: verdict.reason });
      continue;
    }

    if (verdict.status === 'nondeterministic' || verdict.status === 'too-long') {
      if (verdict.status === 'nondeterministic') nondeterministic.push(job.id);
      else tooLong.push(job.id + ' (' + verdict.length + ' chars)');
      skipById.set(job.id, {
        id: job.id,
        level: job.level,
        title: job.title,
        reason: skipReason(verdict),
      });
      const raw = fs.readFileSync(job.file, 'utf8');
      const next = setExpectedOutputField(raw, null);
      if (next !== null && !DRY_RUN) fs.writeFileSync(job.file, next, 'utf8');
      continue;
    }

    skipById.delete(job.id);
    okCount++;
    const raw = fs.readFileSync(job.file, 'utf8');
    const next = setExpectedOutputField(raw, verdict.output);
    if (next === null) {
      unchanged++;
      continue;
    }
    written++;
    if (!DRY_RUN) fs.writeFileSync(job.file, next, 'utf8');
  }

  if (!DRY_RUN) writeSkips([...skipById.values()]);

  if (!QUIET) {
    console.log('');
    console.log('expected outputs: ' + okCount + ' deterministic, ' + unchanged + ' already current, ' +
      written + ' file(s) ' + (DRY_RUN ? 'would change' : 'changed'));
    if (nondeterministic.length > 0) {
      console.log('nondeterministic (no expected_output stored): ' + nondeterministic.join(', '));
    }
    if (tooLong.length > 0) {
      console.log('output too long (no expected_output stored): ' + tooLong.join(', '));
    }
    if (failures.length > 0) {
      console.log('');
      console.error('failed executions (' + failures.length + '):');
      for (const entry of failures) console.error('  ' + entry.id + ': ' + entry.reason);
    }
  }

  if (failures.length > 0) process.exit(2);
  console.log(DRY_RUN ? 'dry run complete; no files written.' : 'expected outputs updated.');
}

main().catch((err) => {
  console.error('expected-output sweep failed: ' + ((err && err.stack) || err));
  process.exit(1);
});
