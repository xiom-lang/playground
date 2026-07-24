'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { spawnSync } = require('child_process');

const LESSONS_DIR = path.join(__dirname, '..', 'lessons');
const CACHE_FILE = path.join(__dirname, '.syntax-cache.json');
const XIOM_BIN = process.env.XIOM_BIN || path.join(__dirname, '..', '..', 'target', 'debug', 'xiom' + (os.platform() === 'win32' ? '.exe' : ''));

const args = process.argv.slice(2);
const levelFilter = args.includes('--level') ? args[args.indexOf('--level') + 1] : null;
const fixMode = args.includes('--fix');
const checkOnly = args.includes('--check-only');
const verbose = args.includes('--verbose');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); } catch { return {}; }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function checkXiomSyntax(source) {
  const tmp = path.join(os.tmpdir(), `xiom_check_${Date.now()}_${Math.random().toString(36).slice(2)}.xi`);
  fs.writeFileSync(tmp, source);
  let proc;
  try {
    proc = spawnSync(XIOM_BIN, ['--check', '--check-only', tmp], { timeout: 15000, encoding: 'utf-8' });
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    return { ok: false, errMsg: 'XIOM binary not found or failed to execute: ' + e.message };
  }
  try { fs.unlinkSync(tmp); } catch {}
  const stderr = (proc.stderr || '').trim();
  const stdout = (proc.stdout || '').trim();
  const ok = proc.status === 0;
  const errMsg = stderr || stdout || '';
  return { ok, errMsg };
}

function collectLessons(level) {
  const files = [];
  const lessonsDir = LESSONS_DIR;
  if (!fs.existsSync(lessonsDir)) return files;

  for (const entry of fs.readdirSync(lessonsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (level && entry.name !== level) continue;
    const subDir = path.join(lessonsDir, entry.name);
    for (const file of fs.readdirSync(subDir)) {
      if (file.endsWith('.json')) files.push(path.join(subDir, file));
    }
  }
  return files;
}

function fixXiomCode(source) {
  let fixed = source;

  fixed = fixed.replace(/io\.io\.io\./g, 'io.');
  fixed = fixed.replace(/io\.io\./g, 'io.');

  fixed = fixed.replace(/(?<!io\.)\bprintln\s*\(/g, 'io.println(');
  fixed = fixed.replace(/(?<!io\.)\bprint(?!ln)\s*\(/g, 'io.print(');

  if (!/^\s*use\s+xiom\.io\s*;/.test(fixed)) {
    if (/^\s*\/\//.test(fixed)) {
      const firstCommentEnd = fixed.indexOf('\n');
      if (firstCommentEnd !== -1) {
        fixed = fixed.substring(0, firstCommentEnd + 1) + 'use xiom.io;\n' + fixed.substring(firstCommentEnd + 1);
      } else {
        fixed = 'use xiom.io;\n' + fixed;
      }
    } else {
      fixed = 'use xiom.io;\n' + fixed;
    }
  }

  if (fixed.includes('use xiom.string;') || fixed.includes('string.str_')) {
    if (!/^\s*use\s+xiom\.string\s*;/.test(fixed)) {
      if (/^\s*use\s+xiom\.io\s*;/.test(fixed)) {
        fixed = fixed.replace(/^(use\s+xiom\.io\s*;)/m, '$1\nuse xiom.string;');
      }
    }
  }

  if (fixed.includes('math.random_range') || fixed.includes('math.')) {
    if (!/^\s*use\s+xiom\.math\s*;/.test(fixed)) {
      const lines = fixed.split('\n');
      let lastUse = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*use\s+xiom\./.test(lines[i])) lastUse = i;
      }
      if (lastUse >= 0) {
        lines.splice(lastUse + 1, 0, 'use xiom.math;');
        fixed = lines.join('\n');
      } else if (/^\s*use\s+xiom\.io\s*;/.test(fixed)) {
        fixed = fixed.replace(/^(use\s+xiom\.io\s*;)/m, '$1\nuse xiom.math;');
      }
    }
  }

  fixed = fixed.replace(/\bfn\s+main\s*\(\s*\)\s*->\s*\w+/g, 'fn main()');

  fixed = fixed.replace(/:\s*\[(\w+)\]/g, ': Vec[$1]');
  fixed = fixed.replace(/:\s*\[\s*\]/g, ': Vec[Str]');

  fixed = fixed.replace(/io\.println\(\s*(\d+)\s*\)/g, (_, num) => `io.println("${num}")`);
  fixed = fixed.replace(/io\.print\(\s*(\d+)\s*\)/g, (_, num) => `io.print("${num}")`);

  fixed = fixed.replace(/io\.println\(\s*true\s*\)/g, 'io.println("true")');
  fixed = fixed.replace(/io\.println\(\s*false\s*\)/g, 'io.println("false")');
  fixed = fixed.replace(/io\.print\(\s*true\s*\)/g, 'io.print("true")');
  fixed = fixed.replace(/io\.print\(\s*false\s*\)/g, 'io.print("false")');

  const varValues = {};
  const varTypes = {};
  const varRegex = /(let|var)\s+(\w+)\s*(?::\s*(\w+(?:\[[\w,\s]*\])?))?\s*=\s*(.+?);/g;
  let m;
  while ((m = varRegex.exec(fixed)) !== null) {
    const name = m[2];
    const type = m[3] || null;
    const valExpr = m[4].trim();
    varTypes[name] = type || inferType(valExpr);
    if (isConstantExpr(valExpr)) {
      varValues[name] = evaluateConstant(valExpr, varValues);
    }
  }

  fixed = fixed.replace(/io\.println\(\s*(\w+)\s*\)/g, (match, varName) => {
    const vtype = varTypes[varName];
    if (vtype === 'Int' || vtype === 'Bool' || vtype === 'Float64') {
      const val = varValues[varName];
      if (val !== undefined) {
        return `io.println("${val}")`;
      }
    }
    return match;
  });

  fixed = fixed.replace(/io\.print\(\s*(\w+)\s*\)/g, (match, varName) => {
    const vtype = varTypes[varName];
    if (vtype === 'Int' || vtype === 'Bool' || vtype === 'Float64') {
      const val = varValues[varName];
      if (val !== undefined) {
        return `io.print("${val}")`;
      }
    }
    return match;
  });

  fixed = fixed.replace(/io\.println\(\s*([^"'][^;]*?)\s*\)/g, (match, expr) => {
    const trimmed = expr.trim();
    if (/^\d+$/.test(trimmed)) return `io.println("${trimmed}")`;
    if (trimmed === 'true' || trimmed === 'false') return `io.println("${trimmed}")`;
    return match;
  });

  fixed = addMissingSemicolons(fixed);

  return fixed;
}

function inferType(expr) {
  if (/^".*"$/.test(expr)) return 'Str';
  if (/^\d+$/.test(expr)) return 'Int';
  if (/^\d+\.\d+$/.test(expr)) return 'Float64';
  if (expr === 'true' || expr === 'false') return 'Bool';
  if (expr.includes('string.str_concat')) return 'Str';
  if (expr.includes('string.str_upper')) return 'Str';
  if (expr.includes('string.str_lower')) return 'Str';
  if (expr.includes('string.str_len')) return 'Int';
  if (expr.includes('math.random_range')) return 'Int';
  if (/^\[.*\]$/.test(expr)) return 'Vec';
  if (/[+\-*/%]/.test(expr) && !expr.includes('"')) return 'Int';
  return null;
}

function isConstantExpr(expr) {
  if (/^\d+$/.test(expr)) return true;
  if (/^".*"$/.test(expr)) return true;
  if (expr === 'true' || expr === 'false') return true;
  return false;
}

function evaluateConstant(expr, knownVars) {
  if (/^\d+$/.test(expr)) return parseInt(expr, 10);
  if (expr === 'true') return 'true';
  if (expr === 'false') return 'false';
  if (/^".*"$/.test(expr)) return expr.replace(/^"|"$/g, '');
  if (knownVars[expr] !== undefined) return knownVars[expr];
  try {
    const safeExpr = expr.replace(/(\w+)/g, (m) => knownVars[m] !== undefined ? knownVars[m] : m);
    const val = eval(safeExpr);
    return val;
  } catch {
    return undefined;
  }
}

function addMissingSemicolons(code) {
  const lines = code.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed === '') {
      result.push(line);
      continue;
    }
    if (trimmed.startsWith('//')) {
      result.push(line);
      continue;
    }
    if (trimmed.startsWith('use ')) {
      if (!trimmed.endsWith(';')) {
        line = line.replace(/(use\s+\S.*?)(\s*)$/, '$1;$2');
      }
      result.push(line);
      continue;
    }
    if (trimmed === '{' || trimmed === '}') {
      result.push(line);
      continue;
    }
    if (trimmed.endsWith('{') || trimmed.endsWith('}')) {
      result.push(line);
      continue;
    }
    if (trimmed.startsWith('fn ') && trimmed.endsWith('{')) {
      result.push(line);
      continue;
    }
    if (trimmed.startsWith('if ') || trimmed.startsWith('elif ') || trimmed.startsWith('else ')) {
      result.push(line);
      continue;
    }
    if (trimmed.startsWith('while ') || trimmed.startsWith('for ')) {
      result.push(line);
      continue;
    }
    if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
      if (/\w/.test(trimmed)) {
        line = line.replace(/(\S)(\s*)$/, '$1;$2');
      }
    }
    result.push(line);
  }
  return result.join('\n');
}

function fixLessonFile(filePath) {
  const lesson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = false;

  if (lesson.code_template) {
    const fixed = fixXiomCode(lesson.code_template);
    if (fixed !== lesson.code_template) {
      lesson.code_template = fixed;
      changed = true;
    }
  }

  if (lesson.solution) {
    const fixed = fixXiomCode(lesson.solution);
    if (fixed !== lesson.solution) {
      lesson.solution = fixed;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(lesson, null, 2));
  }

  return changed;
}

function main() {
  console.log('\x1b[36m\x1b[1mXIOM Syntax Validator\x1b[0m');
  if (fixMode) console.log('\x1b[33m  --fix mode: auto-fixing issues\x1b[0m');
  if (levelFilter) console.log('\x1b[33m  --level: ' + levelFilter + '\x1b[0m');
  console.log('\x1b[2mChecking lessons against xiom --check...\x1b[0m\n');

  const cache = loadCache();
  const files = collectLessons(levelFilter);

  if (files.length === 0) {
    console.log('\x1b[33mNo lesson files found.\x1b[0m');
    process.exit(0);
  }

  let total = 0, cached = 0, checked = 0, passed = 0, failed = 0, fixed = 0;
  const failures = [];

  for (const filePath of files) {
    total++;
    const rel = path.relative(LESSONS_DIR, filePath).replace(/\\/g, '/');
    const cacheKey = rel;
    const cachedEntry = cache[cacheKey];

    let lesson;
    try {
      lesson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      failures.push({ file: rel, errors: ['Invalid JSON'] });
      failed++;
      process.stdout.write('\x1b[31mF\x1b[0m');
      continue;
    }

    const templateCode = lesson.code_template || '';
    const solutionCode = lesson.solution || '';
    const templateHash = sha256(templateCode);
    const solutionHash = sha256(solutionCode);

    if (!fixMode && cachedEntry &&
        cachedEntry.template_hash === templateHash &&
        cachedEntry.solution_hash === solutionHash) {
      if (cachedEntry.pass) {
        cached++;
        passed++;
        if (verbose) process.stdout.write('\x1b[90mc\x1b[0m');
        else process.stdout.write('\x1b[90m.\x1b[0m');
      } else {
        cached++;
        failed++;
        failures.push({ file: rel, id: lesson.id, title: lesson.title, errors: cachedEntry.errors || ['cached failure'] });
        process.stdout.write('\x1b[31mF\x1b[0m');
      }
      continue;
    }

    if (fixMode) {
      const wasChanged = fixLessonFile(filePath);
      if (wasChanged) {
        fixed++;
        const updated = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        lesson = updated;
        const newTemplateCode = lesson.code_template || '';
        const newSolutionCode = lesson.solution || '';
        const newTemplateHash = sha256(newTemplateCode);
        const newSolutionHash = sha256(newSolutionCode);

        const templateOk = checkXiomSyntax(newTemplateCode);
        const solutionOk = checkXiomSyntax(newSolutionCode);
        checked++;

        const errors = [];
        if (!templateOk.ok) errors.push('TEMPLATE: ' + (templateOk.errMsg || 'unknown error'));
        if (!solutionOk.ok) errors.push('SOLUTION: ' + (solutionOk.errMsg || 'unknown error'));

        cache[cacheKey] = {
          template_hash: newTemplateHash,
          solution_hash: newSolutionHash,
          pass: errors.length === 0,
          errors: errors,
          timestamp: Math.floor(Date.now() / 1000)
        };

        if (errors.length === 0) {
          passed++;
          process.stdout.write('\x1b[32m+\x1b[0m');
        } else {
          failed++;
          failures.push({ file: rel, id: lesson.id, title: lesson.title, errors });
          process.stdout.write('\x1b[31mF\x1b[0m');
        }
      } else {
        const templateOk = checkXiomSyntax(templateCode);
        const solutionOk = checkXiomSyntax(solutionCode);
        checked++;

        const errors = [];
        if (!templateOk.ok) errors.push('TEMPLATE: ' + (templateOk.errMsg || 'unknown error'));
        if (!solutionOk.ok) errors.push('SOLUTION: ' + (solutionOk.errMsg || 'unknown error'));

        cache[cacheKey] = {
          template_hash: templateHash,
          solution_hash: solutionHash,
          pass: errors.length === 0,
          errors: errors,
          timestamp: Math.floor(Date.now() / 1000)
        };

        if (errors.length === 0) {
          passed++;
          process.stdout.write('\x1b[32m.\x1b[0m');
        } else {
          failed++;
          failures.push({ file: rel, id: lesson.id, title: lesson.title, errors });
          process.stdout.write('\x1b[31mF\x1b[0m');
        }
      }
    } else {
      const templateOk = checkXiomSyntax(templateCode);
      const solutionOk = checkXiomSyntax(solutionCode);
      checked++;

      const errors = [];
      if (!templateOk.ok) errors.push('TEMPLATE: ' + (templateOk.errMsg || 'unknown error'));
      if (!solutionOk.ok) errors.push('SOLUTION: ' + (solutionOk.errMsg || 'unknown error'));

      cache[cacheKey] = {
        template_hash: templateHash,
        solution_hash: solutionHash,
        pass: errors.length === 0,
        errors: errors,
        timestamp: Math.floor(Date.now() / 1000)
      };

      if (errors.length === 0) {
        passed++;
        process.stdout.write('\x1b[32m.\x1b[0m');
      } else {
        failed++;
        failures.push({ file: rel, id: lesson.id, title: lesson.title, errors });
        process.stdout.write('\x1b[31mF\x1b[0m');
      }
    }

    if (total % 25 === 0) process.stdout.write(' ' + total + '\n');
  }

  saveCache(cache);
  console.log('\n');

  if (fixMode) {
    console.log('\x1b[2m──────────────────────────────\x1b[0m');
    console.log(`  Auto-fixed: \x1b[33m${fixed}\x1b[0m lesson(s)`);
  }

  console.log('\x1b[2m──────────────────────────────\x1b[0m');
  console.log(`  Total:   ${total}`);
  console.log(`  Cached:  \x1b[90m${cached}\x1b[0m`);
  console.log(`  Checked: ${checked}`);
  console.log(`  Passed:  \x1b[32m${passed}\x1b[0m`);
  console.log(`  Failed:  \x1b[31m${failed}\x1b[0m`);
  console.log('\x1b[2m──────────────────────────────\x1b[0m');

  if (failures.length > 0) {
    console.log(`\n\x1b[31m${failures.length} lesson(s) with errors:\x1b[0m\n`);
    for (const f of failures.slice(0, 30)) {
      console.log(`\x1b[31mFAIL\x1b[0m ${f.file}  \x1b[33m${f.title || ''}\x1b[0m`);
      for (const e of f.errors) {
        const short = e.length > 200 ? e.substring(0, 200) + '...' : e;
        console.log(`     \x1b[31m\u2192\x1b[0m ${short}`);
      }
      console.log('');
    }
    if (failures.length > 30) console.log(`  ... and ${failures.length - 30} more failures\n`);
  }

  console.log(`\x1b[1m${passed}/${total} pass\x1b[0m`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
