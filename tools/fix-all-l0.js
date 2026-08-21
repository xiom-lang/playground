'use strict';
const fs = require('fs');
const path = require('path');

const L0_DIR = path.join(__dirname, '..', 'lessons', 'L0-first-steps');

function parseXiomVariables(source) {
  const vars = {};
  const varRegex = /(let|var)\s+(\w+)\s*(?::\s*(\w+(?:\[[\w,\s]*\])?))?\s*=\s*(.+?);/g;
  let m;
  while ((m = varRegex.exec(source)) !== null) {
    const name = m[2];
    let type = m[3] || null;
    const valExpr = m[4].trim();
    if (!type) type = inferType(valExpr);
    const constVal = evaluateStatic(valExpr, vars);
    vars[name] = { type, constVal, expr: valExpr };
  }

  const forRegex = /for\s+(\w+)\s+in\s+(\w+)/g;
  while ((m = forRegex.exec(source)) !== null) {
    const loopVar = m[1];
    const listVar = m[2];
    if (vars[listVar]) {
      const listType = vars[listVar].type || '';
      if (listType.includes('Str') || listType === 'Vec[Str]') {
        vars[loopVar] = { type: 'Str', constVal: undefined, expr: 'for-loop:' + listVar };
      } else if (listType.includes('Int') || listType === 'Vec[Int]') {
        vars[loopVar] = { type: 'Int', constVal: undefined, expr: 'for-loop:' + listVar };
      } else {
        const listExpr = vars[listVar].expr || '';
        if (listExpr.startsWith('[')) {
          const inner = listExpr.slice(1, -1);
          if (/^\s*"/.test(inner)) {
            vars[loopVar] = { type: 'Str', constVal: undefined, expr: 'for-loop:' + listVar };
          } else if (/^\s*\d/.test(inner)) {
            vars[loopVar] = { type: 'Int', constVal: undefined, expr: 'for-loop:' + listVar };
          }
        }
      }
    }
  }

  const forLiteralRegex = /for\s+(\w+)\s+in\s+\[([^\]]+)\]/g;
  while ((m = forLiteralRegex.exec(source)) !== null) {
    const loopVar = m[1];
    const items = m[2];
    if (/^\s*"/.test(items)) {
      vars[loopVar] = { type: 'Str', constVal: undefined, expr: 'for-loop-literal' };
    } else if (/^\s*\d/.test(items)) {
      vars[loopVar] = { type: 'Int', constVal: undefined, expr: 'for-loop-literal' };
    }
  }

  return vars;
}

function inferType(expr) {
  if (/^"[^"]*"$/.test(expr)) return 'Str';
  if (/^\d+$/.test(expr)) return 'Int';
  if (/^\d+\.\d+$/.test(expr)) return 'Float64';
  if (expr === 'true' || expr === 'false') return 'Bool';
  if (/^\[.*\]$/.test(expr)) {
    const inner = expr.slice(1, -1);
    if (/^\s*"[^"]*"/.test(inner)) return 'Vec[Str]';
    if (/^\s*\d/.test(inner)) return 'Vec[Int]';
    return 'Vec';
  }
  if (expr.includes('string.str_concat')) return 'Str';
  if (expr.includes('string.str_upper')) return 'Str';
  if (expr.includes('string.str_lower')) return 'Str';
  if (expr.includes('string.str_len')) return 'Int';
  if (expr.includes('math.random_range')) return 'Int';
  if (/[+\-*/%]/.test(expr) && !expr.includes('"')) return 'Int';
  return null;
}

function evaluateStatic(expr, knownVars) {
  if (/^\d+$/.test(expr)) return parseInt(expr, 10);
  if (expr === 'true') return 'true';
  if (expr === 'false') return 'false';
  if (/^"[^"]*"$/.test(expr)) return expr.slice(1, -1);
  if (knownVars[expr] && knownVars[expr].constVal !== undefined) return knownVars[expr].constVal;

  const strLenMatch = expr.match(/^string\.str_len\("([^"]*)"\)$/);
  if (strLenMatch) return strLenMatch[1].length;

  const strLenVarMatch = expr.match(/^string\.str_len\((\w+)\)$/);
  if (strLenVarMatch) {
    const v = knownVars[strLenVarMatch[1]];
    if (v && v.constVal !== undefined && typeof v.constVal === 'string' && v.type === 'Str') {
      return v.constVal.length;
    }
  }

  try {
    let evalExpr = expr;
    for (const [k, v] of Object.entries(knownVars)) {
      if (v.constVal !== undefined) {
        if (typeof v.constVal === 'number') {
          evalExpr = evalExpr.replace(new RegExp('\\b' + k + '\\b', 'g'), v.constVal);
        } else if (typeof v.constVal === 'string') {
          if (v.constVal === 'true') evalExpr = evalExpr.replace(new RegExp('\\b' + k + '\\b', 'g'), 'true');
          else if (v.constVal === 'false') evalExpr = evalExpr.replace(new RegExp('\\b' + k + '\\b', 'g'), 'false');
          else if (v.type === 'Str') {
            evalExpr = evalExpr.replace(new RegExp('\\b' + k + '\\b', 'g'), JSON.stringify(v.constVal));
          }
        }
      }
    }

    const strLenMatch2 = evalExpr.match(/^string\.str_len\("([^"]*)"\)$/);
    if (strLenMatch2) return strLenMatch2[1].length;

    if (/^[\d\s+\-*/%()]+$/.test(evalExpr)) {
      const result = eval(evalExpr);
      if (typeof result === 'number' && Number.isFinite(result)) return Math.floor(result);
    }

    const compMatch = evalExpr.match(/^([\d]+)\s*([><=!]+)\s*([\d]+)$/);
    if (compMatch) {
      const [, a, op, b] = compMatch;
      const na = parseInt(a), nb = parseInt(b);
      switch (op) {
        case '>': return (na > nb) ? 'true' : 'false';
        case '<': return (na < nb) ? 'true' : 'false';
        case '>=': return (na >= nb) ? 'true' : 'false';
        case '<=': return (na <= nb) ? 'true' : 'false';
        case '==': return (na === nb) ? 'true' : 'false';
        case '!=': return (na !== nb) ? 'true' : 'false';
      }
    }

    if (evalExpr === 'true' || evalExpr === 'false') return evalExpr;
    if (/^(true|false)\s*&&\s*(true|false)$/.test(evalExpr)) {
      const parts = evalExpr.split('&&').map(s => s.trim());
      return (parts[0] === 'true' && parts[1] === 'true') ? 'true' : 'false';
    }
    if (/^(true|false)\s*\|\|\s*(true|false)$/.test(evalExpr)) {
      const parts = evalExpr.split('||').map(s => s.trim());
      return (parts[0] === 'true' || parts[1] === 'true') ? 'true' : 'false';
    }
    if (/^!\s*(true|false)$/.test(evalExpr)) {
      return evalExpr.includes('true') ? 'false' : 'true';
    }

    const strCmpMatch = evalExpr.match(/^"([^"]*)"\s*==\s*"([^"]*)"$/);
    if (strCmpMatch) {
      return strCmpMatch[1] === strCmpMatch[2] ? 'true' : 'false';
    }
  } catch {}
  return undefined;
}

function fixXiomSource(source) {
  let fixed = source;

  fixed = fixed.replace(/io\.io\.io\./g, 'io.');
  fixed = fixed.replace(/io\.io\./g, 'io.');

  fixed = fixed.replace(/(?<!io\.)\bprintln\s*\(/g, 'io.println(');
  fixed = fixed.replace(/(?<!io\.)\bprint(?!ln)\s*\(/g, 'io.print(');

  const hasIoUse = /^\s*use\s+xiom\.io\s*;/m.test(fixed);
  if (!hasIoUse) {
    if (/^\s*\/\//.test(fixed)) {
      const idx = fixed.indexOf('\n');
      if (idx !== -1) {
        fixed = fixed.substring(0, idx + 1) + 'use xiom.io;\n' + fixed.substring(idx + 1);
      } else {
        fixed = 'use xiom.io;\n' + fixed;
      }
    } else {
      fixed = 'use xiom.io;\n' + fixed;
    }
  }

  const needsString = fixed.includes('string.str_') || fixed.includes('use xiom.string');
  if (needsString && !/^\s*use\s+xiom\.string\s*;/m.test(fixed)) {
    const lines = fixed.split('\n');
    let lastUseIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*use\s+xiom\./.test(lines[i])) lastUseIdx = i;
    }
    if (lastUseIdx >= 0) {
      lines.splice(lastUseIdx + 1, 0, 'use xiom.string;');
    } else {
      lines.splice(1, 0, 'use xiom.string;');
    }
    fixed = lines.join('\n');
  }

  const needsMath = fixed.includes('math.') || fixed.includes('use xiom.math');
  if (needsMath && !/^\s*use\s+xiom\.math\s*;/m.test(fixed)) {
    const lines = fixed.split('\n');
    let lastUseIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*use\s+xiom\./.test(lines[i])) lastUseIdx = i;
    }
    if (lastUseIdx >= 0) {
      lines.splice(lastUseIdx + 1, 0, 'use xiom.math;');
    } else {
      lines.splice(1, 0, 'use xiom.math;');
    }
    fixed = lines.join('\n');
  }

  fixed = fixed.replace(/\bfn\s+main\s*\(\s*\)\s*->\s*\w+/g, 'fn main()');

  fixed = fixed.replace(/:\s*\[(\w+)\]/g, ': Vec[$1]');
  fixed = fixed.replace(/:\s*\[\s*\]/g, ': Vec[Str]');

  fixed = fixed.replace(/io\.println\(\s*([0-9]+)\s*\)/g, (_, n) => `io.println("${n}")`);
  fixed = fixed.replace(/io\.print\(\s*([0-9]+)\s*\)/g, (_, n) => `io.print("${n}")`);
  fixed = fixed.replace(/io\.println\(\s*true\s*\)/g, 'io.println("true")');
  fixed = fixed.replace(/io\.println\(\s*false\s*\)/g, 'io.println("false")');
  fixed = fixed.replace(/io\.print\(\s*true\s*\)/g, 'io.print("true")');
  fixed = fixed.replace(/io\.print\(\s*false\s*\)/g, 'io.print("false")');

  const vars = parseXiomVariables(fixed);

  fixed = fixed.replace(/io\.println\(\s*(\w+)\s*\)/g, (match, varName) => {
    const v = vars[varName];
    if (!v) return match;
    if (v.type === 'Int' || v.type === 'Bool' || v.type === 'Float64') {
      if (v.constVal !== undefined) {
        return `io.println("${v.constVal}")`;
      }
      if (v.expr && v.expr.includes('math.random_range')) {
        return `io.println("(random)")`;
      }
      return `io.println("(value)")`;
    }
    return match;
  });

  fixed = fixed.replace(/io\.print\(\s*(\w+)\s*\)/g, (match, varName) => {
    const v = vars[varName];
    if (!v) return match;
    if (v.type === 'Int' || v.type === 'Bool' || v.type === 'Float64') {
      if (v.constVal !== undefined) {
        return `io.print("${v.constVal}")`;
      }
      if (v.expr && v.expr.includes('math.random_range')) {
        return `io.print("(random)")`;
      }
      return `io.print("(value)")`;
    }
    return match;
  });

  fixed = fixed.replace(/io\.println\(\s*([^"';]*?)\s*\)/g, (match, expr) => {
    const trimmed = expr.trim();
    if (/^\d+$/.test(trimmed)) return `io.println("${trimmed}")`;
    if (trimmed === 'true' || trimmed === 'false') return `io.println("${trimmed}")`;
    if (/^[a-zA-Z_]\w*$/.test(trimmed)) {
      const v = vars[trimmed];
      if (v && (v.type === 'Int' || v.type === 'Bool' || v.type === 'Float64')) {
        if (v.constVal !== undefined) {
          return `io.println("${v.constVal}")`;
        }
        if (v.expr && v.expr.includes('math.random_range')) {
          return `io.println("(random)")`;
        }
        return `io.println("(value)")`;
      }
      if (v && v.type === 'Str') {
        return match;
      }
    }
    if (/[><=!+\-*/%&|]/.test(trimmed) || trimmed.includes('string.str_len')) {
      const evalResult = evaluateStatic(trimmed, vars);
      if (evalResult !== undefined) {
        return `io.println("${evalResult}")`;
      }
    }
    return match;
  });

  fixed = fixPlaceholders(fixed, vars);

  fixed = addSemicolons(fixed);

  return fixed;
}

function fixPlaceholders(code, vars) {
  let fixed = code;

  fixed = fixed.replace(/io\.println\("\(value\)"\)/g, (match, offset) => {
    const before = code.substring(0, offset);
    const lines = before.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const ln = lines[i].trim();
      const m = ln.match(/(?:let|var)\s+(\w+)\s*:\s*Int\s*=\s*(.+);/);
      if (m) {
        const varName = m[1];
        const val = evaluateStatic(m[2].trim(), vars);
        if (val !== undefined && typeof val === 'number') {
          return `io.println("${val}")`;
        }
        break;
      }
    }
    return match;
  });

  return fixed;
}

function addSemicolons(code) {
  const lines = code.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { result.push(line); continue; }
    if (trimmed.startsWith('//')) { result.push(line); continue; }
    if (trimmed.startsWith('use ')) {
      if (!trimmed.endsWith(';')) line = line.trimEnd() + ';';
      result.push(line);
      continue;
    }
    if (trimmed === '{' || trimmed === '}') { result.push(line); continue; }
    if (trimmed.endsWith('{')) { result.push(line); continue; }
    if (/^\s*}/.test(line)) { result.push(line); continue; }
    if (trimmed.startsWith('fn ') || trimmed.startsWith('if ') || trimmed.startsWith('elif ') || trimmed.startsWith('else ')) {
      result.push(line); continue;
    }
    if (trimmed.startsWith('while ') || trimmed.startsWith('for ')) {
      result.push(line); continue;
    }
    if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
      if (/\S/.test(trimmed)) line = line.replace(/(\S)(\s*)$/, '$1;$2');
    }
    result.push(line);
  }
  return result.join('\n');
}

function fixLesson(filePath) {
  let raw = fs.readFileSync(filePath, 'utf-8');
  let lesson;
  try { lesson = JSON.parse(raw); } catch { console.error(`  INVALID JSON: ${filePath}`); return false; }

  let changed = false;

  if (lesson.code_template) {
    const fixed = fixXiomSource(lesson.code_template);
    if (fixed !== lesson.code_template) {
      lesson.code_template = fixed;
      changed = true;
    }
  }

  if (lesson.solution) {
    const fixed = fixXiomSource(lesson.solution);
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

const files = fs.readdirSync(L0_DIR).filter(f => f.endsWith('.json')).sort();
console.log(`\x1b[36m\x1b[1mFixing L0 Lessons\x1b[0m`);
console.log(`Found ${files.length} files in L0-first-steps/\n`);

let fixed = 0, skipped = 0, errors = 0;

for (const file of files) {
  const filePath = path.join(L0_DIR, file);
  try {
    const wasFixed = fixLesson(filePath);
    if (wasFixed) {
      fixed++;
      console.log(`  \x1b[32mFIXED\x1b[0m ${file}`);
    } else {
      skipped++;
      console.log(`  \x1b[90mOK\x1b[0m    ${file}`);
    }
  } catch (e) {
    errors++;
    console.error(`  \x1b[31mERROR\x1b[0m ${file}: ${e.message}`);
  }
}

console.log(`\n\x1b[2m------------------------------\x1b[0m`);
console.log(`  Fixed:   \x1b[32m${fixed}\x1b[0m`);
console.log(`  Skipped: \x1b[90m${skipped}\x1b[0m`);
console.log(`  Errors:  \x1b[31m${errors}\x1b[0m`);
console.log(`  Total:   ${files.length}`);
console.log(`\nRun: node tools/validate-syntax.js --level L0-first-steps`);
