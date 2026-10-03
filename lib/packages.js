// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Offline package resolution for submissions (C3).
//
// The compiler resolves `use xiom.<pkg>;` by discovering `.xi` files under
// the submitted source's parent directory (single-file mode). To make
// packages usable offline, this module copies the sources a submission
// imports into its work directory under `packages/<name>/`, where that
// discovery finds them.
//
// Two offline sources are supported, in order:
//   1. XIOM_PACKAGE_BUNDLE: a registry export directory
//      (`index.json` + `artifacts/<name>/<version>/package.tar.gz` +
//      `bundle.json`). Artifacts are sha256-verified against bundle.json
//      before they are extracted, and extraction is cached per process.
//   2. <repo>/packages/xiom-<name>/: sources vendored in this repository
//      (the registry's two pinned packages; see packages/README.md).
//
// Only packages the source imports are copied, package names never shadow
// the pinned stdlib, and every copy is size-capped. Failures are reported
// to the caller but never break compilation: unresolved imports fail the
// same way they did before.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const REPO = path.resolve(__dirname, '..');
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;   // per request, all packages
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024; // one bundle artifact

const state = {
  repo: REPO,
  bundleDir: (process.env.XIOM_PACKAGE_BUNDLE || '').trim(),
  cacheDir: path.join(os.tmpdir(), 'xiom_pg_work', 'pkg-cache'),
  bundle: null,
  repoPackages: null,
  stdlib: null,
};

function configure(opts) {
  if (opts && typeof opts.repo === 'string') state.repo = opts.repo;
  if (opts && typeof opts.bundleDir === 'string') state.bundleDir = opts.bundleDir.trim();
  if (opts && typeof opts.cacheDir === 'string') state.cacheDir = opts.cacheDir;
  state.bundle = null;
  state.repoPackages = null;
  state.stdlib = null;
}

function sha256hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// --- import parsing ---------------------------------------------------------

// `use xiom.a.b;` lines only; comments containing the text copy nothing or
// an unused package at worst, which is harmless.
function importedPackages(source) {
  const out = new Set();
  const re = /^[ \t]*use[ \t]+(xiom(?:\.[A-Za-z0-9_]+)+)[ \t]*;/gm;
  let match;
  while ((match = re.exec(String(source || ''))) !== null) out.add(match[1]);
  return Array.from(out);
}

// --- stdlib shadowing guard -------------------------------------------------

function stdlibModules() {
  if (state.stdlib) return state.stdlib;
  const set = new Set();
  try {
    const ref = JSON.parse(fs.readFileSync(path.join(state.repo, 'js', 'stdlib-ref.json'), 'utf8'));
    for (const mod of ref.modules || []) {
      if (mod && typeof mod.name === 'string') set.add(mod.name);
    }
  } catch {
    // Without the reference we fall back to "no stdlib" and the compiler
    // still resolves stdlib imports first in practice.
  }
  state.stdlib = set;
  return set;
}

function stdlibCovers(dotted) {
  const name = dotted.replace(/^xiom\./, '');
  if (!name) return true;
  const modules = stdlibModules();
  if (modules.has(name)) return true;
  const prefix = name + '.';
  for (const mod of modules) {
    if (mod.startsWith(prefix)) return true;
  }
  return false;
}

// --- package registries -----------------------------------------------------

function repoPackages() {
  if (state.repoPackages) return state.repoPackages;
  const map = new Map();
  const root = path.join(state.repo, 'packages');
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    state.repoPackages = map;
    return map;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(root, entry.name);
    let name = 'xiom.' + entry.name.replace(/^xiom-/, '');
    try {
      const manifest = fs.readFileSync(path.join(dir, 'package.xi'), 'utf8');
      const match = /name:\s*"([^"]+)"/.exec(manifest);
      if (match) name = match[1];
    } catch { /* fall back to the directory name */ }
    if (!map.has(name)) map.set(name, { name, kind: 'repo', dir });
  }
  state.repoPackages = map;
  return map;
}

function bundlePackages() {
  if (state.bundle) return state.bundle;
  const map = new Map();
  const root = state.bundleDir;
  if (root) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'bundle.json'), 'utf8'));
      for (const [name, pkg] of Object.entries(manifest.packages || {})) {
        const versions = pkg.versions || {};
        const version = pkg.latest && versions[pkg.latest] ? pkg.latest : Object.keys(versions)[0];
        const meta = version ? versions[version] : null;
        if (meta && meta.path && meta.sha256) {
          map.set(name, { name, kind: 'bundle', version, meta });
        }
      }
    } catch {
      // Missing or unreadable bundle: vendored packages still work.
    }
  }
  state.bundle = map;
  return map;
}

function resolvePackageName(dotted) {
  // Longest package-name prefix wins: `xiom.misc.glob.glob_match` can come
  // from package `xiom.misc.glob`, `xiom.misc`, or a stdlib module.
  const parts = dotted.split('.');
  for (let end = parts.length; end >= 2; end--) {
    const candidate = parts.slice(0, end).join('.');
    if (bundlePackages().has(candidate)) return candidate;
    if (repoPackages().has(candidate)) return candidate;
  }
  return null;
}

// --- extraction -------------------------------------------------------------

function readField(header, start, end) {
  return header.toString('latin1', start, end).replace(/\0.*$/, '').trim();
}

function safeParts(name) {
  const parts = [];
  for (const part of String(name).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' || part.indexOf('\\') >= 0 || part.indexOf(':') >= 0) return null;
    parts.push(part);
  }
  return parts.length ? parts : null;
}

// Minimal ustar reader: files and directories only; links, pax and other
// special entries are skipped.
function untarInto(tar, destDir) {
  let offset = 0;
  let files = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    const name = readField(header, 0, 100);
    if (!name) break;
    const size = parseInt(readField(header, 124, 136) || '0', 8) || 0;
    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    const prefix = readField(header, 345, 500);
    const dataStart = offset + 512;
    if (type === '0' || type === '7') {
      const parts = safeParts(prefix ? prefix + '/' + name : name);
      if (parts) {
        const full = path.join(destDir, ...parts);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, tar.subarray(dataStart, dataStart + size));
        files += 1;
      }
    } else if (type === '5') {
      const parts = safeParts(prefix ? prefix + '/' + name : name);
      if (parts) fs.mkdirSync(path.join(destDir, ...parts), { recursive: true });
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

function ensureExtracted(pkg) {
  const dest = path.join(state.cacheDir, pkg.name.replace(/\./g, '-') + '-' + pkg.version);
  const marker = path.join(dest, '.sha256');
  try {
    if (fs.readFileSync(marker, 'utf8').trim() === pkg.meta.sha256) return dest;
  } catch { /* not extracted yet */ }

  const artifact = path.join(state.bundleDir, pkg.meta.path);
  const data = fs.readFileSync(artifact);
  if (data.length > MAX_ARTIFACT_BYTES) {
    throw new Error('package artifact too large: ' + pkg.name);
  }
  const digest = sha256hex(data);
  if (digest !== pkg.meta.sha256) {
    throw new Error('package artifact checksum mismatch: ' + pkg.name);
  }

  const tmp = dest + '.tmp-' + process.pid + '-' + Date.now();
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  untarInto(zlib.gunzipSync(data), tmp);
  fs.writeFileSync(path.join(tmp, '.sha256'), pkg.meta.sha256);
  fs.rmSync(dest, { recursive: true, force: true });
  try {
    fs.renameSync(tmp, dest);
  } catch (err) {
    // Another request may have finished the same extraction first.
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!fs.existsSync(marker)) throw err;
  }
  return dest;
}

// --- copying -----------------------------------------------------------------

function findPackageRoot(dir, depth) {
  if (fs.existsSync(path.join(dir, 'package.xi'))) return dir;
  if ((depth || 0) >= 2) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const found = findPackageRoot(path.join(dir, entry.name), (depth || 0) + 1);
      if (found) return found;
    }
  }
  return null;
}

function copyFileCapped(src, dest, budget) {
  const size = fs.statSync(src).size;
  if (size > budget) return 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return size;
}

// Copy the package manifest and its `.xi` sources. Tests, build output and
// hidden directories stay out of the work directory so discovery sees only
// the library modules; the walk is layout-agnostic (`src/` is common but
// not required).
function copyPackageSources(root, dest, budget) {
  let used = 0;
  const manifest = path.join(root, 'package.xi');
  if (fs.existsSync(manifest) && budget > 0) {
    used += copyFileCapped(manifest, path.join(dest, 'package.xi'), budget - used);
  }
  const stack = [[root, dest]];
  const skip = ['tests', 'target', 'build'];
  while (stack.length) {
    const [dir, out] = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const src = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && skip.indexOf(entry.name) < 0) {
          stack.push([src, path.join(out, entry.name)]);
        }
      } else if (entry.name.endsWith('.xi') && entry.name !== 'package.xi' && budget - used > 0) {
        used += copyFileCapped(src, path.join(out, entry.name), budget - used);
      }
    }
  }
  return used;
}

// --- public entry points -----------------------------------------------------

// Copy the sources of every package the submission imports into
// `<workDir>/packages/<name>/`. Returns the package names that were copied.
function prepareForSource(source, workDir) {
  const imports = importedPackages(source);
  if (imports.length === 0) return { packages: [] };
  const wanted = new Map();
  for (const dotted of imports) {
    if (stdlibCovers(dotted)) continue;
    const name = resolvePackageName(dotted);
    if (name && !wanted.has(name)) wanted.set(name, dotted);
  }
  if (wanted.size === 0) return { packages: [] };

  const copied = [];
  let budget = MAX_PACKAGE_BYTES;
  for (const [name] of wanted) {
    const bundle = bundlePackages().get(name);
    const repo = repoPackages().get(name);
    const chosen = bundle || repo;
    if (!chosen) continue;
    let root;
    if (chosen.kind === 'bundle') {
      root = findPackageRoot(ensureExtracted(chosen), 0);
    } else {
      root = chosen.dir;
    }
    if (!root) continue;
    const dest = path.join(workDir, 'packages', name.replace(/\./g, '-'));
    const used = copyPackageSources(root, dest, budget);
    if (used > 0 || fs.existsSync(path.join(root, 'package.xi'))) {
      budget -= used;
      copied.push(name);
    }
  }
  return { packages: copied };
}

// C22 bridge removed at the v0.62.3 absorption: `xiom run` now adds the
// script's directory to the catalog (compiler main 563aaff2), so the
// work-dir copies below are found without staging anything under
// <tmp>/xiom_run. The runDir configuration went with it.

function describe() {
  const repoCount = repoPackages().size;
  const bundleCount = bundlePackages().size;
  return 'bundle=' + (state.bundleDir || '(unset)') + ' (' + bundleCount + ' packages)' +
    ', vendored=' + repoCount + ' (' + Array.from(repoPackages().keys()).join(', ') + ')';
}

// Machine-readable subsystem status for /api/health, so ops monitoring can
// catch a broken or missing bundle mount (bundlePackages drops to 0 while
// the vendored baseline stays available).
function status() {
  return {
    bundle: state.bundleDir || null,
    bundlePackages: bundlePackages().size,
    vendored: repoPackages().size,
  };
}

module.exports = {
  configure,
  describe,
  importedPackages,
  prepareForSource,
  status,
};
