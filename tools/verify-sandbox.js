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

// Raw connect(2) probe: proves the Landlock network rule at the kernel level
// (the XIOM stdlib's tcp_connect reports Ok even on failure, so it cannot be
// used here). connect() must fail with EACCES; a timeout is not a denial.
const TCP_PROBE_C = [
  '#include <arpa/inet.h>',
  '#include <errno.h>',
  '#include <fcntl.h>',
  '#include <netinet/in.h>',
  '#include <poll.h>',
  '#include <stdio.h>',
  '#include <string.h>',
  '#include <sys/socket.h>',
  '#include <unistd.h>',
  'int main(void) {',
  '  int fd = socket(AF_INET, SOCK_STREAM, 0);',
  '  if (fd < 0) { printf("tcp=socket:%s\\n", strerror(errno)); return 0; }',
  '  struct sockaddr_in addr;',
  '  memset(&addr, 0, sizeof(addr));',
  '  addr.sin_family = AF_INET;',
  '  addr.sin_port = htons(443);',
  '  inet_pton(AF_INET, "1.1.1.1", &addr.sin_addr);',
  '  fcntl(fd, F_SETFL, fcntl(fd, F_GETFL, 0) | O_NONBLOCK);',
  '  int rc = connect(fd, (struct sockaddr *)&addr, sizeof(addr));',
  '  if (rc == 0) { printf("tcp=reachable\\n"); return 0; }',
  '  if (errno == EACCES || errno == EPERM) { printf("tcp=denied\\n"); return 0; }',
  '  if (errno == EINPROGRESS) {',
  '    struct pollfd p = { fd, POLLOUT, 0 };',
  '    if (poll(&p, 1, 5000) > 0) {',
  '      int err = 0; socklen_t len = sizeof(err);',
  '      getsockopt(fd, SOL_SOCKET, SO_ERROR, &err, &len);',
  '      if (err == 0) printf("tcp=reachable\\n");',
  '      else if (err == EACCES || err == EPERM) printf("tcp=denied\\n");',
  '      else printf("tcp=error:%s\\n", strerror(err));',
  '      return 0;',
  '    }',
  '    printf("tcp=timeout\\n"); return 0;',
  '  }',
  '  printf("tcp=error:%s\\n", strerror(errno));',
  '  return 0;',
  '}',
  '',
].join('\n');

function compileTcpProbe(ctx) {
  const src = path.join(WORK, 'tcp_probe.c');
  const bin = path.join(WORK, 'tcp_probe');
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(src, TCP_PROBE_C, 'utf8');
  for (const cc of ['cc', 'clang', 'gcc']) {
    const out = spawnSync(cc, ['-O2', '-o', bin, src], { encoding: 'utf8', timeout: 60000 });
    if (out.status === 0 && fs.existsSync(bin)) return bin;
  }
  return null;
}

function runTcpProbe(ctx, probe) {
  const started = Date.now();
  const proc = spawnSync(ctx.sandbox, ['--', probe], {
    encoding: 'utf8',
    timeout: 30000,
    env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: HOME, TMPDIR: os.tmpdir() },
  });
  return {
    status: proc.status,
    stdout: String(proc.stdout || ''),
    stderr: String(proc.stderr || ''),
    ms: Date.now() - started,
  };
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

  // 6. TCP connect (kernel rule on ABI >= 4). The XIOM stdlib's
  // tcp_connect is not a trustworthy probe -- it returns Ok even for a
  // closed port in v0.61.3 -- so this compiles a raw connect(2) probe and
  // runs it through the wrapper instead.
  if (abi >= 4) {
    const tcpProbe = compileTcpProbe(ctx);
    if (tcpProbe) {
      const tcp = runTcpProbe(ctx, tcpProbe);
      const denied = tcp.stdout.indexOf('tcp=denied') >= 0;
      results.push({
        probe: 'tcp-connect',
        pass: denied,
        detail: denied ? 'tcp=denied (EACCES from connect(2))' :
          'expected kernel denial, got: ' + JSON.stringify((tcp.stdout || tcp.stderr).trim()).slice(0, 200),
        ms: tcp.ms,
      });
    } else {
      results.push({
        probe: 'tcp-connect',
        pass: !opts.requireNet,
        detail: 'skipped: no C compiler available to build the raw connect probe',
        ms: 0,
      });
    }
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
