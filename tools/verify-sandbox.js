#!/usr/bin/env node
// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Denial suite for the Landlock wrapper (P1). Runs submitted-style programs
// through sandbox/xiom-sandbox and asserts that the confinement holds:
//
//   - a control program still compiles and runs;
//   - /tmp stays readable/writable and the toolchain stays readable;
//   - writes and reads outside the allowlist (/var/tmp or /data) are denied;
//   - /proc, /etc/passwd and the rest of /etc are denied;
//   - a spawned shell cannot read /proc either;
//   - TCP connect fails (kernel rule; requires Landlock ABI >= 4);
//   - a warm repeat run stays in the millisecond range.
//
// The toolchain must be readable under the policy. Production uses
// /toolchain; local runs and CI copy it under /tmp (allowed). The tool fails
// with instructions when the compiler is outside the allowed paths.
//
// Usage:
//   node tools/verify-sandbox.js [--sandbox sandbox/xiom-sandbox]
//     [--toolchain /tmp/xiom-toolchain] [--bin .toolchain/bin/xiom]
//     [--stdlib .toolchain/lib] [--escape-dir /var/tmp] [--require-net]
//     [--json report.json] [--quiet]
//
// Exit codes: 0 pass (or skipped on non-Linux), 1 any probe escaped or a
// setup failure.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const WORK = path.join(os.tmpdir(), 'xiom-sandbox-verify');
const HOME = path.join(os.tmpdir(), 'xiom-home');

function parseArgs(argv) {
  const opts = { quiet: false, requireNet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i];
    if (arg === '--sandbox') opts.sandbox = value();
    else if (arg === '--toolchain') opts.toolchain = value();
    else if (arg === '--bin') opts.bin = value();
    else if (arg === '--stdlib') opts.stdlib = value();
    else if (arg === '--escape-dir') opts.escapeDir = value();
    else if (arg === '--json') opts.json = value();
    else if (arg === '--require-net') opts.requireNet = true;
    else if (arg === '--quiet') opts.quiet = true;
  }
  return opts;
}

function fail(message) {
  console.error('verify-sandbox: ' + message);
  process.exit(1);
}

function xiomString(value) {
  return JSON.stringify(String(value));
}

function resolveSetup(opts) {
  const sandbox = path.resolve(opts.sandbox || path.join(REPO, 'sandbox', 'xiom-sandbox'));
  let bin = opts.bin;
  let stdlib = opts.stdlib;
  if (opts.toolchain) {
    bin = path.join(opts.toolchain, 'bin', 'xiom');
    stdlib = path.join(opts.toolchain, 'lib');
  }
  if (!bin) bin = path.join(REPO, '.toolchain', 'bin', 'xiom');
  if (!stdlib) stdlib = path.join(REPO, '.toolchain', 'lib');

  const allowed = ['/tmp/', '/app/', '/toolchain/', '/usr/'];
  if (!allowed.some((prefix) => bin.startsWith(prefix))) {
    fail('the compiler at ' + bin + ' is outside the sandbox allowlist; copy the ' +
      'toolchain under /tmp (for example: cp -a .toolchain /tmp/xiom-toolchain) ' +
      'and pass --toolchain /tmp/xiom-toolchain');
  }
  if (!fs.existsSync(sandbox)) fail('sandbox binary not found: ' + sandbox);
  if (!fs.existsSync(bin)) fail('compiler not found: ' + bin);
  return { sandbox, bin, stdlib };
}

function runProgram(ctx, name, source, timeoutMs) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(HOME, { recursive: true });
  const file = path.join(WORK, name + '.xi');
  fs.writeFileSync(file, source, 'utf8');
  const started = Date.now();
  const proc = spawnSync(ctx.sandbox, ['--', ctx.bin, 'run', file], {
    encoding: 'utf8',
    timeout: timeoutMs || 60000,
    env: {
      PATH: process.env.PATH || '/usr/bin:/bin',
      HOME: HOME,
      TMPDIR: os.tmpdir(),
      XIOM_STDLIB: ctx.stdlib,
      LANG: process.env.LANG || 'C.UTF-8',
    },
  });
  return {
    status: proc.status,
    stdout: String(proc.stdout || ''),
    stderr: String(proc.stderr || ''),
    ms: Date.now() - started,
  };
}

function checkPatch(tag, result, expected, results) {
  const pass = result.stdout.indexOf(expected) >= 0;
  results.push({
    probe: tag,
    pass: pass,
    detail: pass ? expected : 'expected "' + expected + '" in output: ' +
      JSON.stringify(result.stdout.trim() || result.stderr.trim()).slice(0, 300),
    ms: result.ms,
  });
  return pass;
}

function main() {
  if (process.platform !== 'linux') {
    console.log('verify-sandbox: skipped (Landlock is Linux-only; platform=' + process.platform + ')');
    return;
  }
  const opts = parseArgs(process.argv.slice(2));
  const ctx = resolveSetup(opts);
  const results = [];

  const probe = spawnSync(ctx.sandbox, ['--probe'], { encoding: 'utf8', timeout: 10000 });
  if (probe.status !== 0) fail('sandbox probe failed: ' + String(probe.stderr || probe.stdout).trim());
  let abi = 0;
  try {
    abi = Number(JSON.parse(probe.stdout).landlock_abi) || 0;
  } catch {
    fail('sandbox probe returned invalid JSON: ' + probe.stdout);
  }
  if (abi < 1) fail('Landlock is not available (ABI ' + abi + ')');

  // Escape area outside the allowlist: prefer /data when it exists (the
  // production shape), then /var/tmp. Create a canary the sandboxed program
  // must not be able to read.
  const escapeDir = path.resolve(opts.escapeDir || (fs.existsSync('/data') ? '/data' : '/var/tmp'));
  const escapeRoot = path.join(escapeDir, 'xiom-sandbox-verify');
  const canary = path.join(escapeRoot, 'canary.txt');
  const escapeWrite = path.join(escapeRoot, 'escape.txt');
  let canaryCreated = false;
  try {
    fs.mkdirSync(escapeRoot, { recursive: true });
    fs.writeFileSync(canary, 'sandbox-canary', 'utf8');
    canaryCreated = true;
  } catch (err) {
    console.warn('verify-sandbox: cannot create the escape canary in ' + escapeRoot +
      ' (' + err.message + '); the denial probes below still apply');
  }

  // 1. Control: the sandboxed toolchain still works.
  const control = runProgram(ctx, 'control',
    'use xiom.io;\nfn main() { io.println("sandbox-control"); }\n');
  const controlOk = checkPatch('control', control, 'sandbox-control', results);

  // 2. /tmp stays usable and the toolchain stays readable.
  const tmpFile = path.join(WORK, 'tmp-write.txt');
  checkPatch('tmp-rw', runProgram(ctx, 'tmp-rw',
    'use xiom.io;\nfn main() {\n' +
    '  match io.write_file(' + xiomString(tmpFile) + ', "ok") {\n' +
    '    Ok(u) => io.println("tmpwrite=ok"),\n    Err(e) => io.println("tmpwrite=FAIL"),\n  }\n' +
    '  match io.read_file(' + xiomString(tmpFile) + ') {\n' +
    '    Ok(s) => io.println("tmpread=ok"),\n    Err(e) => io.println("tmpread=FAIL"),\n  }\n' +
    '}\n'), 'tmpread=ok', results);

  // 3. Escape read/write outside the allowlist must fail.
  checkPatch('escape-read', runProgram(ctx, 'escape-read',
    'use xiom.io;\nfn main() {\n' +
    '  match io.read_file(' + xiomString(canary) + ') {\n' +
    '    Ok(s) => io.println("escaperead=LEAK"),\n    Err(e) => io.println("escaperead=denied"),\n  }\n}\n'),
    'escaperead=denied', results);
  checkPatch('escape-write', runProgram(ctx, 'escape-write',
    'use xiom.io;\nfn main() {\n' +
    '  match io.write_file(' + xiomString(escapeWrite) + ', "x") {\n' +
    '    Ok(u) => io.println("escapewrite=LEAK"),\n    Err(e) => io.println("escapewrite=denied"),\n  }\n}\n'),
    'escapewrite=denied', results);

  // 4. /proc and /etc are denied.
  checkPatch('proc-read', runProgram(ctx, 'proc-read',
    'use xiom.io;\nfn main() {\n' +
    '  match io.read_file("/proc/self/status") {\n' +
    '    Ok(s) => io.println("proc=LEAK"),\n    Err(e) => io.println("proc=denied"),\n  }\n}\n'),
    'proc=denied', results);
  checkPatch('etc-read', runProgram(ctx, 'etc-read',
    'use xiom.io;\nfn main() {\n' +
    '  match io.read_file("/etc/passwd") {\n' +
    '    Ok(s) => io.println("etc=LEAK"),\n    Err(e) => io.println("etc=denied"),\n  }\n}\n'),
    'etc=denied', results);

  // 5. A spawned shell inherits the policy and cannot read /proc either.
  const spawnOut = path.join(WORK, 'spawn.out');
  checkPatch('spawn-proc', runProgram(ctx, 'spawn-proc',
    'use xiom.io;\nuse xiom.process;\nfn main() {\n' +
    '  let args = Vec[Str].new();\n  args.push("-c");\n' +
    '  args.push("cat /proc/self/status > ' + spawnOut + ' 2>/dev/null");\n' +
    '  match process.spawn_command("sh", &args) { Ok(p) => io.println("spawn=ok"), Err(e) => io.println("spawn=err") }\n' +
    '  match io.read_file(' + xiomString(spawnOut) + ') {\n' +
    '    Ok(s) => { if s.len() == 0 { io.println("spawnproc=denied") } else { io.println("spawnproc=LEAK") } },\n' +
    '    Err(e) => io.println("spawnproc=denied"),\n  }\n}\n'),
    'spawnproc=denied', results);

  // 6. TCP connect (kernel rule on ABI >= 4).
  if (abi >= 4) {
    checkPatch('tcp-connect', runProgram(ctx, 'tcp-connect',
      'use xiom.io;\nuse xiom.net;\nfn main() {\n' +
      '  match net.tcp_connect("1.1.1.1", 443) {\n' +
      '    Ok(s) => io.println("tcp=REACHABLE"),\n    Err(e) => io.println("tcp=denied"),\n  }\n}\n'),
      'tcp=denied', results);
  } else {
    results.push({
      probe: 'tcp-connect',
      pass: !opts.requireNet,
      detail: 'skipped: landlock ABI ' + abi + ' (< 4, no net rules)' +
        (opts.requireNet ? ' but --require-net was set' : ''),
      ms: 0,
    });
  }

  // 7. Warm repeat stays in the millisecond range.
  if (controlOk) {
    const warm = runProgram(ctx, 'control',
      'use xiom.io;\nfn main() { io.println("sandbox-control"); }\n');
    const pass = warm.status === 0 && warm.stdout.indexOf('sandbox-control') >= 0 && warm.ms < 3000;
    results.push({
      probe: 'warm-run',
      pass: pass,
      detail: 'second run ' + warm.ms + 'ms (limit 3000ms)',
      ms: warm.ms,
    });
  }

  const escaped = results.some((r) => !r.pass);
  if (!opts.quiet) {
    console.log('sandbox:   ' + ctx.sandbox);
    console.log('toolchain: ' + ctx.bin + ' (landlock ABI ' + abi + ')');
    console.log('escape:    ' + escapeRoot + (canaryCreated ? '' : ' (no canary)'));
    for (const r of results) {
      console.log((r.pass ? '  ok   ' : '  FAIL ') + r.probe.padEnd(13) + ' ' + r.detail);
    }
  }
  const report = { sandbox: ctx.sandbox, toolchain: ctx.bin, landlock_abi: abi, results };
  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(report, null, 2) + '\n');
  process.exit(escaped ? 1 : 0);
}

main();
