// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Cold-compile benchmark for the XIOM toolchain.
 *
 * Every measurement clears the compiler caches first, so each sample pays a
 * full compile (script cache in $TMPDIR/xiom_run, JIT cache in ~/.xiom).
 * This is the harness for verifying perf changes such as the xiom.fmt
 * reachable-only peek: run it before a change, run it after, and compare the
 * medians with --compare. Use the same machine for both runs.
 *
 * Usage:
 *   node tools/bench-cold-compile.js                       # default programs
 *   node tools/bench-cold-compile.js --lesson L0-01 --lesson L5-21
 *   node tools/bench-cold-compile.js --program my.xi --runs 5
 *   node tools/bench-cold-compile.js --json bench-before.json
 *   node tools/bench-cold-compile.js --compare bench-before.json
 *
 * Options:
 *   --bin <path>       compiler binary (default XIOM_BIN or .toolchain/bin/xiom)
 *   --stdlib <path>    stdlib directory (default XIOM_STDLIB or .toolchain/lib)
 *   --program <file>   add a program file (repeatable)
 *   --lesson <id>      add a lesson solution from lessons/index.json (repeatable)
 *   --runs <N>         measured runs per program (default 3)
 *   --no-emit-ir       skip the front-end-only (--emit-ir) measurement
 *   --timeout <ms>     per-run timeout (default 60000)
 *   --label <name>     label for the report (default: compiler version line)
 *   --json <file>      write the results as JSON
 *   --compare <file>   compare against a previous JSON report
 *   --quiet            only print the summary
 *
 * Run it on Linux (CI/WSL): Windows clang hangs at -O2, so cold measurements
 * are only meaningful where programs can be compiled and executed.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { REPO, XIOM_BIN } = require('./lib/toolchain');

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}
function argValues(name) {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1] && !args[i + 1].startsWith('--')) values.push(args[i + 1]);
  }
  return values;
}

const BIN = argValue('--bin', process.env.XIOM_BIN || XIOM_BIN);
const STDLIB = argValue('--stdlib', process.env.XIOM_STDLIB || path.join(REPO, '.toolchain', 'lib'));
const RUNS = Math.max(1, Number(argValue('--runs', '3')));
const TIMEOUT = Math.max(1000, Number(argValue('--timeout', '60000')));
const MEASURE_IR = !args.includes('--no-emit-ir');
const QUIET = args.includes('--quiet');
const JSON_OUT = argValue('--json', null);
const COMPARE = argValue('--compare', null);

const DEFAULT_PROGRAMS = [
  {
    name: 'hello',
    source: 'use xiom.io;\n\nfn main() {\n  io.println("bench hello");\n}\n',
  },
  {
    name: 'to_str',
    source: 'use xiom.io;\n\nfn main() {\n  let n: Int = 42;\n  let f: Float64 = 1.5;\n  io.println(n.to_str());\n  io.println(f.to_str());\n}\n',
  },
  {
    name: 'loop_200',
    source: 'use xiom.io;\nuse xiom.iter;\n\nfn main() {\n  var total: Int = 0;\n  for i in range(0, 200) {\n    total = total + i;\n  }\n  io.println(total.to_str());\n}\n',
  },
];

function median(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function clearCaches() {
  fs.rmSync(path.join(os.tmpdir(), 'xiom_run'), { recursive: true, force: true });
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) fs.rmSync(path.join(home, '.xiom'), { recursive: true, force: true });
}

function runOnce(argv) {
  const started = Date.now();
  const result = spawnSync(BIN, argv, {
    encoding: 'utf8',
    timeout: TIMEOUT,
    env: Object.assign({}, process.env, { XIOM_STDLIB: STDLIB }),
  });
  return {
    ms: Date.now() - started,
    ok: result.status === 0 && !result.error,
    status: result.status,
    timedOut: Boolean(result.error && result.error.code === 'ETIMEDOUT'),
  };
}

function toolchainVersion() {
  const result = spawnSync(BIN, ['--version'], { encoding: 'utf8', timeout: TIMEOUT });
  return (result.stdout || '').split('\n')[0].trim() || 'unknown';
}

function loadLessonSource(id) {
  const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'lessons', 'index.json'), 'utf8'));
  for (const level of catalog.levels) {
    for (const lesson of level.lessons) {
      if (lesson.id === id) {
        const data = JSON.parse(fs.readFileSync(path.join(REPO, 'lessons', lesson.file), 'utf8'));
        return { name: 'lesson-' + id, source: data.solution };
      }
    }
  }
  throw new Error('lesson not found: ' + id);
}

function buildPrograms() {
  const programs = DEFAULT_PROGRAMS.map((p) => ({ name: p.name, source: p.source }));
  for (const file of argValues('--program')) {
    programs.push({ name: path.basename(file), source: fs.readFileSync(file, 'utf8') });
  }
  for (const id of argValues('--lesson')) programs.push(loadLessonSource(id));
  return programs;
}

function benchmark(programs) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiom_bench_'));
  const report = {
    label: argValue('--label', null),
    toolchain: toolchainVersion(),
    bin: BIN,
    stdlib: STDLIB,
    runs: RUNS,
    date: new Date().toISOString(),
    host: os.hostname(),
    programs: [],
  };

  for (const program of programs) {
    const file = path.join(workDir, program.name + '.xi');
    fs.writeFileSync(file, program.source, 'utf8');
    const entry = { name: program.name, run: { samples: [] }, emitIr: null };
    if (!QUIET) process.stdout.write('measuring ' + program.name + ' (run x' + RUNS + ')');

    for (let i = 0; i < RUNS; i++) {
      clearCaches();
      entry.run.samples.push(runOnce(['run', file]));
      if (!QUIET) process.stdout.write('.');
    }
    entry.run.min = Math.min(...entry.run.samples.map((s) => s.ms));
    entry.run.median = median(entry.run.samples.map((s) => s.ms));
    entry.run.max = Math.max(...entry.run.samples.map((s) => s.ms));
    entry.run.failures = entry.run.samples.filter((s) => !s.ok).length;

    if (MEASURE_IR) {
      const irSamples = [];
      for (let i = 0; i < RUNS; i++) {
        clearCaches();
        irSamples.push(runOnce(['--emit-ir', file]));
        if (!QUIET) process.stdout.write('.');
      }
      entry.emitIr = {
        samples: irSamples,
        min: Math.min(...irSamples.map((s) => s.ms)),
        median: median(irSamples.map((s) => s.ms)),
        failures: irSamples.filter((s) => !s.ok).length,
      };
    }
    if (!QUIET) console.log(' done');
    report.programs.push(entry);
  }

  const runMedians = report.programs.map((p) => p.run.median);
  report.totals = {
    runMedianMs: median(runMedians),
    runTotalMedianMs: runMedians.reduce((a, b) => a + b, 0),
  };
  if (MEASURE_IR && report.programs.every((p) => p.emitIr)) {
    const irMedians = report.programs.map((p) => p.emitIr.median);
    report.totals.emitIrMedianMs = median(irMedians);
    report.totals.emitIrTotalMedianMs = irMedians.reduce((a, b) => a + b, 0);
  }

  fs.rmSync(workDir, { recursive: true, force: true });
  return report;
}

function printReport(report) {
  console.log('');
  console.log('Cold-compile benchmark - ' + (report.label || report.toolchain));
  console.log('  binary: ' + report.bin);
  console.log('  runs per program: ' + report.runs + ' (caches cleared before each sample)');
  console.log('');
  console.log('  program        run median  run min  run max' + (MEASURE_IR ? '  emit-ir median' : ''));
  for (const program of report.programs) {
    let line = '  ' + program.name.padEnd(14) +
      String(program.run.median).padStart(7) + ' ms' +
      String(program.run.min).padStart(8) + ' ms' +
      String(program.run.max).padStart(8) + ' ms';
    if (MEASURE_IR && program.emitIr) line += String(program.emitIr.median).padStart(14) + ' ms';
    if (program.run.failures > 0) line += '  (' + program.run.failures + ' failed)';
    console.log(line);
  }
  console.log('');
  console.log('  totals: run median/total ' + report.totals.runMedianMs + ' ms / ' +
    report.totals.runTotalMedianMs + ' ms' +
    (report.totals.emitIrTotalMedianMs !== undefined
      ? ', emit-ir total ' + report.totals.emitIrTotalMedianMs + ' ms'
      : ''));
}

function compare(baselinePath, current) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  console.log('');
  console.log('Comparison against ' + baselinePath + ' (' + (baseline.label || baseline.toolchain) + ')');
  console.log('  program        run before  run after   delta      emit-ir before  emit-ir after   delta');
  const byName = new Map(baseline.programs.map((p) => [p.name, p]));
  for (const program of current.programs) {
    const before = byName.get(program.name);
    if (!before) continue;
    const runDelta = program.run.median - before.run.median;
    const runPct = before.run.median ? Math.round((runDelta / before.run.median) * 100) : 0;
    let line = '  ' + program.name.padEnd(14) +
      String(before.run.median).padStart(9) + ' ms' +
      String(program.run.median).padStart(9) + ' ms' +
      (runDelta >= 0 ? '+' : '') + String(runDelta).padStart(6) + ' ms (' + (runPct >= 0 ? '+' : '') + runPct + '%)';
    if (MEASURE_IR && before.emitIr && program.emitIr) {
      const irDelta = program.emitIr.median - before.emitIr.median;
      const irPct = before.emitIr.median ? Math.round((irDelta / before.emitIr.median) * 100) : 0;
      line += String(before.emitIr.median).padStart(14) + ' ms' +
        String(program.emitIr.median).padStart(13) + ' ms' +
        (irDelta >= 0 ? '+' : '') + String(irDelta).padStart(6) + ' ms (' + (irPct >= 0 ? '+' : '') + irPct + '%)';
    }
    console.log(line);
  }
  console.log('');
  console.log('  Note: only same-machine comparisons are meaningful.');
}

function main() {
  if (COMPARE && !fs.existsSync(COMPARE)) {
    console.error('error: baseline report not found: ' + COMPARE);
    process.exit(1);
  }
  if (!fs.existsSync(BIN)) {
    console.error('error: compiler not found at ' + BIN);
    console.error('hint: pass --bin, or run from a checkout with .toolchain/, or set XIOM_BIN.');
    process.exit(1);
  }
  const programs = buildPrograms();
  const report = benchmark(programs);
  printReport(report);
  if (COMPARE) compare(COMPARE, report);
  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log('  report written to ' + JSON_OUT);
  }
}

main();
