'use strict';

const fs = require('fs');
const path = require('path');

const LESSONS_DIR = path.join(__dirname, '..', 'lessons');

const VALID_LEVELS = new Set(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']);

const ID_PATTERN = /^L\d-\d{2}$/;
const NEXT_LESSON_PATTERN = /^L\d-\d{2}$/;

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';
const DIM    = '\x1b[2m';

const REQUIRED_FIELDS = [
  'id', 'title', 'level', 'duration', 'story', 'why',
  'narrative', 'analogy', 'code_template', 'solution',
  'try_it', 'concepts', 'tips', 'common_mistakes',
  'next_lesson', 'related'
];

const ARRAY_FIELDS = new Set(['concepts', 'tips', 'common_mistakes', 'related']);

function collectLessonFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectLessonFiles(fullPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.json') {
      results.push(fullPath);
    }
  }
  return results;
}

function validateLesson(filePath) {
  const errors = [];
  const relativePath = path.relative(LESSONS_DIR, filePath).replace(/\\/g, '/');
  let data;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    return { file: relativePath, passed: false, errors: [`Invalid JSON: ${e.message}`] };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in data));
  if (missing.length > 0) {
    errors.push(`Missing fields: ${missing.join(', ')}`);
  }

  if (typeof data.id !== 'undefined') {
    if (typeof data.id !== 'string') {
      errors.push("'id' must be a string");
    } else if (!ID_PATTERN.test(data.id)) {
      errors.push(`'id' "${data.id}" does not match pattern Ld-dd (e.g. "L0-01")`);
    }
  }

  if (typeof data.level !== 'undefined') {
    if (typeof data.level !== 'string') {
      errors.push("'level' must be a string");
    } else if (!VALID_LEVELS.has(data.level)) {
      errors.push(`'level' "${data.level}" is not a valid level (must be L0-L8)`);
    }
  }

  if (typeof data.narrative !== 'undefined') {
    if (typeof data.narrative !== 'string' || data.narrative.trim() === '') {
      errors.push("'narrative' is empty");
    } else if (!data.narrative.includes('##')) {
      errors.push("'narrative' must contain at least one '##' heading");
    }
  }

  if (typeof data.code_template !== 'undefined') {
    if (typeof data.code_template !== 'string' || data.code_template.trim() === '') {
      errors.push("'code_template' is empty");
    }
  }

  if (typeof data.solution !== 'undefined') {
    if (typeof data.solution !== 'string' || data.solution.trim() === '') {
      errors.push("'solution' is empty");
    }
  }

  if (typeof data.next_lesson !== 'undefined') {
    if (typeof data.next_lesson !== 'string') {
      errors.push("'next_lesson' must be a string");
    } else if (!NEXT_LESSON_PATTERN.test(data.next_lesson)) {
      errors.push(`'next_lesson' "${data.next_lesson}" does not match pattern Ld-dd`);
    }
  }

  for (const field of ARRAY_FIELDS) {
    if (typeof data[field] !== 'undefined' && !Array.isArray(data[field])) {
      errors.push(`'${field}' must be an array, got ${typeof data[field]}`);
    }
  }

  return {
    file: relativePath,
    passed: errors.length === 0,
    errors
  };
}

function padResults(count) {
  return String(count).padStart(4);
}

console.log(`${CYAN}${BOLD}XIOM Lesson Validator v0.49.9${RESET}`);
console.log(`${DIM}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`);
console.log(`Scanning lessons/ ...`);

const files = collectLessonFiles(LESSONS_DIR);

if (files.length === 0) {
  console.log(`\n${YELLOW}No lesson files found in ${LESSONS_DIR}${RESET}\n`);
  process.exit(0);
}

console.log(`Found ${files.length} lesson file${files.length === 1 ? '' : 's'}.\n`);

let passed = 0;
let failed = 0;

for (const file of files.sort()) {
  const result = validateLesson(file);
  if (result.passed) {
    passed++;
    console.log(`${GREEN}PASS${RESET}  ${result.file}`);
  } else {
    failed++;
    console.log(`${RED}FAIL${RESET}  ${result.file}`);
    for (const err of result.errors) {
      console.log(`      ${RED}\u2192${RESET} ${err}`);
    }
  }
}

console.log(`${DIM}\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${RESET}`);
console.log(`Results: ${GREEN}${padResults(passed)} passed${RESET}, ${RED}${padResults(failed)} failed${RESET}, ${YELLOW}${padResults(0)} skipped${RESET}`);
console.log(`Exit code: ${failed > 0 ? `${RED}1${RESET} (fix ${failed} file${failed === 1 ? '' : 's'})` : `${GREEN}0${RESET} (all clear)`}`);
console.log();

process.exit(failed > 0 ? 1 : 0);
