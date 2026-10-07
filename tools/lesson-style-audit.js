// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
'use strict';

// Beginner-friendliness audit for the lesson corpus.
//
// Checks every lesson's user-facing text (story, why, narrative, analogy,
// tips, common_mistakes, try_it) against a mechanical rubric:
//   - required fields present, non-empty and reasonably sized;
//   - the lesson's own `concepts` are actually explained in its text;
//   - programming jargon from later lessons (or never taught) is flagged
//     unless it is introduced inline;
//   - readability outliers (very long sentences/paragraphs) and empathy
//     words ("just", "simply", ...) are reported.
//
// Usage:
//   node tools/lesson-style-audit.js
//   node tools/lesson-style-audit.js --json tools/lesson-style-report.json
//   node tools/lesson-style-audit.js --write-report docs/LESSON_REVIEW.md
//   node tools/lesson-style-audit.js --strict    (exit 1 on errors)
//
// The report is guidance for authors; only `--strict` turns errors into a
// non-zero exit code.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LESSONS_DIR = path.join(ROOT, 'lessons');
const INDEX_FILE = path.join(LESSONS_DIR, 'index.json');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const MOJIBAKE = /â€|â€™|â€œ|Ã©|Ã¨|Ã |Ã¢|â€“/;

// Jargon a brand-new programmer will not know. Each entry maps a display
// term to a regex plus the concept names that count as an introduction.
const JARGON = [
  ['variable', /variables?\b/i, ['variable', 'var']],
  ['function', /functions?\b/i, ['fn', 'function', 'main']],
  ['parameter', /parameters?\b/i, ['parameter', 'argument', 'fn']],
  ['argument', /arguments?\b/i, ['argument', 'parameter', 'fn']],
  ['string', /strings?\b/i, ['string', 'str']],
  ['integer', /integers?\b/i, ['int', 'integer']],
  ['float', /floats?\b/i, ['float', 'num.float']],
  ['boolean', /booleans?\b/i, ['bool', 'boolean']],
  ['loop', /loops?\b/i, ['while', 'for', 'loop']],
  ['array', /arrays?\b/i, ['array', 'slice', 'vec']],
  ['vector', /vectors?\b/i, ['vec', 'vector']],
  ['struct', /structs?\b/i, ['struct']],
  ['enum', /enums?\b/i, ['enum']],
  ['match', /match(?:es|ing)?\b/i, ['match', 'pattern', 'if']],
  ['type', /types?\b/i, ['type']],
  ['compiler', /compilers?\b/i, ['compiler', 'compile']],
  ['runtime', /\bruntime\b/i, ['runtime']],
  ['memory', /memory\b/i, ['memory']],
  ['pointer', /pointers?\b/i, ['pointer', 'reference', 'borrow']],
  ['reference', /references?\b/i, ['reference', 'borrow', 'pointer']],
  ['ownership', /ownership\b/i, ['ownership', 'borrow']],
  ['borrow', /borrows?\b/i, ['borrow', 'reference']],
  ['mutable', /mutables?\b/i, ['mutable', 'mut', 'var']],
  ['generic', /generics?\b/i, ['generic', 'type parameter']],
  ['trait', /traits?\b/i, ['trait', 'interface']],
  ['module', /modules?\b/i, ['module', 'use']],
  ['package', /packages?\b/i, ['package']],
  ['index', /index(?:es)?\b/i, ['index', 'slice', 'array', 'vec']],
  ['iterator', /iterators?\b/i, ['iterator', 'for']],
  ['closure', /closures?\b/i, ['closure', 'lambda']],
  ['recursion', /recurs(?:ion|ive)\b/i, ['recursion']],
  ['stack', /\bstack\b/i, ['stack']],
  ['heap', /\bheap\b/i, ['heap', 'alloc']],
  ['queue', /\bqueue\b/i, ['queue']],
  ['test', /\btests?\b/i, ['test']],
  ['contract', /contracts?\b/i, ['contract']],
  ['unsafe', /\bunsafe\b/i, ['unsafe']],
  ['thread', /threads?\b/i, ['thread', 'concurrency']],
  ['concurrency', /concurren(?:t|cy)\b/i, ['concurrency', 'thread']],
  ['async', /\basync\b/i, ['async']],
  ['socket', /sockets?\b/i, ['socket', 'network', 'tcp']],
  ['json', /\bjson\b/i, ['json']],
  ['error handling', /error handling\b/i, ['error', 'result', 'option']],
  ['encryption', /encrypt(?:ion|ed)?\b/i, ['encryption', 'crypto']],
  ['hash', /hash(?:es|ing)?\b/i, ['hash', 'map']],
  ['bit', /\bbits?\b/i, ['bit', 'bitwise']],
  ['byte', /\bbytes?\b/i, ['byte', 'uint8']],
  ['interface', /interfaces?\b/i, ['trait', 'interface']],
  ['namespace', /namespaces?\b/i, ['module', 'namespace']],
];

const EMPATHY = [/\bjust\b/gi, /\bsimply\b/gi, /\bobviously\b/gi, /\bof course\b/gi, /\btrivially\b/gi];
const EXPLAIN_MARKERS = /\b(is a|is an|are a|are an|means|stands for|think of|imagine|like a|like an|for example|for instance|called|known as|imagine|picture)\b/i;

const LITERAL_KEYWORDS = new Set([
  'fn', 'main', 'var', 'let', 'if', 'else', 'elif', 'while', 'for', 'loop', 'match',
  'enum', 'struct', 'impl', 'use', 'return', 'break', 'continue', 'int', 'str', 'bool',
  'vec', 'option', 'result', 'true', 'false', 'and', 'or', 'not', 'print', 'println',
]);

const STOPWORDS = new Set([
  'the', 'this', 'that', 'with', 'your', 'you', 'and', 'for', 'from', 'into', 'over',
  'more', 'when', 'then', 'than', 'have', 'has', 'are', 'was', 'were', 'will', 'what',
  'how', 'why', 'not', 'but', 'can', 'may', 'its', 'their', 'them', 'they', 'each',
  'make', 'made', 'using', 'used', 'use', 'about', 'like', 'some', 'such', 'only',
]);

// School-familiar words a young learner already knows; tagging a lesson with
// them is fine without an extra definition.
const COMMON_KNOWLEDGE = new Set([
  'arithmetic', 'addition', 'subtraction', 'multiplication', 'division', 'remainder',
  'shorthand', 'units', 'formulas', 'formula', 'comparison', 'counting', 'average',
  'total', 'percent', 'percentage', 'geometry', 'temperature', 'conversion',
]);

// A concept is "literal" when it names a concrete symbol/API/type/keyword
// that must appear in the lesson; otherwise it is an author-facing theme
// tag (including hyphenated phrases like "if-elif-else") that only needs
// its idea described.
function isLiteralConcept(concept) {
  const c = concept.trim();
  if (/\s/.test(c)) return false;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(c)) return false;
  if (/[._]/.test(c) || /[<>=+*/%!&|^~]/.test(c)) return true;
  if (/\d/.test(c)) return true;
  if (/^[A-Z]/.test(c)) return true;
  return LITERAL_KEYWORDS.has(c.toLowerCase());
}

function stemWord(word) {
  const alpha = word.match(/^[a-z]+/i);
  if (alpha && /\d/.test(word)) return alpha[0].toLowerCase();
  const suffixes = ['ation', 'tion', 'sion', 'ion', 'ment', 'ness', 'ing', 'ers', 'er', 'ed', 'es', 's'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      return word.slice(0, word.length - suffix.length);
    }
  }
  return word;
}

function contentWords(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function collectLessonFiles(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'lab') continue;
      collectLessonFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
      acc.push(full);
    }
  }
  return acc;
}

function normalizeConcept(name) {
  return String(name || '')
    .replace(/[`*]/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function conceptPattern(concept) {
  const alternatives = new Set([concept]);
  const last = concept.split('.').pop();
  if (last && last.length >= 3) alternatives.add(last);
  const parts = concept.split(/[-\s]+/).filter((p) => p.length >= 3);
  if (parts.length > 1) alternatives.add(parts.join(' '));
  return new RegExp(Array.from(alternatives)
    .filter(Boolean)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'), 'i');
}

function sentences(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\|[^\n]*\|/g, ' ')
    .replace(/^#{1,6}.*$/gm, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function words(text) {
  return String(text).split(/\s+/).filter(Boolean);
}

function orderedCatalog() {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const order = [];
  const levels = Object.keys(index.levels).sort((a, b) => Number(a) - Number(b));
  for (const key of levels) {
    for (const lesson of index.levels[key].lessons || []) {
      order.push(lesson);
    }
  }
  return order;
}

function run() {
  const files = collectLessonFiles(LESSONS_DIR, []);
  const lessons = new Map();
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      console.error(RED + 'invalid JSON: ' + file + ': ' + error.message + RESET);
      continue;
    }
    if (data.id) lessons.set(data.id, { file, data });
  }

  const order = orderedCatalog().filter((entry) => lessons.has(entry.id));

  // First introduction of every concept in catalog order.
  const firstIntro = new Map();
  const introduced = new Set();
  for (const entry of order) {
    const lesson = lessons.get(entry.id);
    const concepts = (lesson.data.concepts || []).map(normalizeConcept);
    for (const concept of concepts) {
      if (!concept) continue;
      introduced.add(concept);
      if (!firstIntro.has(concept)) firstIntro.set(concept, entry.id);
    }
  }

  const reports = [];
  for (const entry of order) {
    const lesson = lessons.get(entry.id);
    const d = lesson.data;
    const issues = { error: [], warn: [], info: [] };
    const story = String(d.story || '');
    const why = String(d.why || '');
    const narrative = String(d.narrative || '');
    const analogy = String(d.analogy || '');
    const tips = Array.isArray(d.tips) ? d.tips : [];
    const mistakes = Array.isArray(d.common_mistakes) ? d.common_mistakes : [];
    const tryIt = String(d.try_it || '');
    const concepts = (Array.isArray(d.concepts) ? d.concepts : []).map((c) => String(c || '').trim()).filter(Boolean);
    const userText = [story, why, narrative, analogy, tips.join('\n'), mistakes.join('\n'), tryIt].join('\n');
    const plainText = userText.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');

    if (!story.trim()) issues.error.push('story is empty');
    if (!why.trim()) issues.error.push('why is empty');
    if (!analogy.trim()) issues.error.push('analogy is empty');
    if (!narrative.trim()) issues.error.push('narrative is empty');
    if (!tryIt.trim()) issues.error.push('try_it is empty');
    if (!concepts.length) issues.error.push('concepts is empty');
    if (tips.length < 2) issues.error.push('needs at least 2 tips (has ' + tips.length + ')');
    if (mistakes.length < 1) issues.error.push('needs at least 1 common_mistake');
    if (narrative.length < 150) issues.info.push('narrative is very short (' + narrative.length + ' chars)');
    if (MOJIBAKE.test(userText)) issues.error.push('mojibake/encoding damage in text');
    if (words(story).length > 90) issues.warn.push('story is long for an opener (' + words(story).length + ' words)');

    // Concepts must actually appear in the lesson (prose or code: the code
    // blocks and inline snippets demonstrate them). Literal names (APIs,
    // operators, keywords) must be present; theme tags only need their idea
    // described when this lesson introduces them (repetition of earlier
    // concepts is assumed known).
    for (const concept of concepts) {
      const norm = normalizeConcept(concept);
      if (isLiteralConcept(norm)) {
        const pattern = conceptPattern(norm);
        if (!pattern.test(userText)) issues.error.push('concept "' + concept + '" never appears in the lesson');
        continue;
      }
      if (firstIntro.get(norm) !== entry.id) continue;
      const stems = contentWords(norm).map(stemWord);
      const described = !stems.length || stems.some((stem) => plainText.toLowerCase().includes(stem));
      if (described) continue;
      const common = stems.every((stem) => COMMON_KNOWLEDGE.has(stem));
      if (common) {
        issues.info.push('theme "' + concept + '" uses common-knowledge words (no definition needed)');
      } else {
        issues.warn.push('first introduction of the idea "' + concept + '" is not described in the prose (name it in plain words or retag)');
      }
    }

    // First-introduction lessons should mention literal concepts (APIs,
    // operators, types) in the opener, where the reader starts.
    const opener = [story, why, analogy, narrative].join('\n');
    for (const concept of concepts) {
      const norm = normalizeConcept(concept);
      if (firstIntro.get(norm) !== entry.id) continue;
      if (!isLiteralConcept(norm)) continue;
      const pattern = conceptPattern(norm);
      if (!pattern.test(opener)) {
        issues.warn.push('first introduction of "' + concept + '" is not mentioned in story/why/analogy/narrative');
      }
    }

    // Jargon that has not been introduced yet.
    const introducedHere = new Set(concepts.map(normalizeConcept));
    for (const [term, pattern, aliases] of JARGON) {
      if (!pattern.test(plainText)) continue;
      const known = aliases.some((alias) => introduced.has(alias)) ||
        [...introduced].some((c) => c === term || c.includes(term) || term.includes(c));
      if (known) continue;
      const explained = sentences(plainText).some((s) => pattern.test(s) && EXPLAIN_MARKERS.test(s));
      if (explained) {
        issues.info.push('mentions "' + term + '" before it is taught, but explains it inline');
      } else {
        issues.warn.push('mentions "' + term + '" before it is taught');
      }
    }

    // Readability and tone.
    const allSentences = sentences(userText);
    let longest = { text: '', words: 0 };
    for (const s of allSentences) {
      const n = words(s).length;
      if (n > longest.words) longest = { text: s, words: n };
    }
    if (longest.words > 34) issues.warn.push('long sentence (' + longest.words + ' words): "' + longest.text.slice(0, 90) + '..."');
    for (const pattern of EMPATHY) {
      const matches = plainText.match(pattern);
      if (matches && matches.length) issues.info.push('empathy word "' + matches[0].toLowerCase() + '" x' + matches.length + ' (can feel dismissive to beginners)');
    }
    for (const [index, tip] of tips.entries()) {
      if (words(tip).length > 45) issues.warn.push('tip ' + (index + 1) + ' is long (' + words(tip).length + ' words)');
    }
    for (const [index, mistake] of mistakes.entries()) {
      if (words(mistake).length > 45) issues.warn.push('common_mistake ' + (index + 1) + ' is long (' + words(mistake).length + ' words)');
    }
    if (concepts.length > 5) issues.info.push('concept-heavy lesson (' + concepts.length + ' concepts)');

    reports.push({
      id: entry.id,
      title: d.title || '',
      level: d.level || '',
      file: path.relative(ROOT, lesson.file).replace(/\\/g, '/'),
      concepts,
      tips: tips.length,
      mistakes: mistakes.length,
      words: words(userText).length,
      issues,
    });
  }

  return { reports, firstIntro, order };
}

function summarize(result) {
  const { reports } = result;
  const errors = reports.reduce((n, r) => n + r.issues.error.length, 0);
  const warns = reports.reduce((n, r) => n + r.issues.warn.length, 0);
  const infos = reports.reduce((n, r) => n + r.issues.info.length, 0);
  const warnKinds = new Map();
  const jargonTerms = new Map();
  for (const r of reports) {
    for (const w of r.issues.warn) {
      const kind = w.startsWith('mentions "') ? 'jargon before taught'
        : w.startsWith('first introduction') ? 'first introduction not described'
          : w.startsWith('theme "') ? 'theme not described'
            : w.startsWith('long sentence') ? 'long sentence'
              : w.startsWith('story is long') ? 'long story'
                : w.startsWith('tip ') ? 'long tip'
                  : w.startsWith('common_mistake ') ? 'long common mistake'
                    : 'other';
      warnKinds.set(kind, (warnKinds.get(kind) || 0) + 1);
      const term = /^mentions "([^"]+)"/.exec(w);
      if (term) jargonTerms.set(term[1], (jargonTerms.get(term[1]) || 0) + 1);
    }
  }
  console.log(CYAN + 'Lesson style audit' + RESET + ' - ' + reports.length + ' lessons');
  console.log('  errors: ' + errors + '  warnings: ' + warns + '  info: ' + infos);
  console.log('  warning kinds: ' + [...warnKinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => k + '=' + n).join(', '));
  console.log('  top jargon terms: ' + [...jargonTerms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => k + '=' + n).join(', '));
  const withErrors = reports.filter((r) => r.issues.error.length);
  const withWarns = reports.filter((r) => r.issues.warn.length);
  if (withErrors.length) {
    console.log(RED + '\nErrors (' + withErrors.length + ' lessons, first 30):' + RESET);
    for (const r of withErrors.slice(0, 30)) {
      console.log('  ' + r.id + ' ' + r.title);
      for (const issue of r.issues.error.slice(0, 4)) console.log('    - ' + issue);
    }
    if (withErrors.length > 30) console.log(DIM + '  ... ' + (withErrors.length - 30) + ' more' + RESET);
  }
  if (withWarns.length) {
    console.log(YELLOW + '\nWarnings (' + withWarns.length + ' lessons, first 12):' + RESET);
    for (const r of withWarns.slice(0, 12)) {
      console.log('  ' + r.id + ' ' + r.title);
      for (const issue of r.issues.warn.slice(0, 3)) console.log('    - ' + issue);
    }
    if (withWarns.length > 12) console.log(DIM + '  ... ' + (withWarns.length - 12) + ' more' + RESET);
  }
  if (!withErrors.length && !withWarns.length) console.log(GREEN + '\nNo errors or warnings. ' + RESET);
  return { errors, warns, infos };
}

function writeMarkdown(result, outFile) {
  const { reports, firstIntro } = result;
  const lines = [];
  lines.push('# Lesson review - beginner-friendliness');
  lines.push('');
  lines.push('Generated by `tools/lesson-style-audit.js`. This report checks every lesson\'s');
  lines.push('user-facing text (story, why, narrative, analogy, tips, common mistakes, try_it)');
  lines.push('against the beginner rubric: concepts explained where they first appear, no jargon');
  lines.push('before it is taught, readable sentences, and concrete tips/mistakes.');
  lines.push('');
  const errors = reports.filter((r) => r.issues.error.length);
  const warns = reports.filter((r) => r.issues.warn.length);
  lines.push('- Lessons: ' + reports.length);
  lines.push('- Lessons with errors: ' + errors.length);
  lines.push('- Lessons with warnings: ' + warns.length);
  lines.push('');
  lines.push('## Concept introduction map');
  lines.push('');
  lines.push('| Concept | First lesson |');
  lines.push('| --- | --- |');
  for (const [concept, id] of [...firstIntro.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    lines.push('| `' + concept + '` | ' + id + ' |');
  }
  if (errors.length) {
    lines.push('');
    lines.push('## Errors');
    for (const r of errors) {
      lines.push('');
      lines.push('### ' + r.id + ' - ' + r.title);
      for (const issue of r.issues.error) lines.push('- ' + issue);
    }
  }
  if (warns.length) {
    lines.push('');
    lines.push('## Warnings');
    for (const r of warns) {
      lines.push('');
      lines.push('### ' + r.id + ' - ' + r.title);
      for (const issue of r.issues.warn) lines.push('- ' + issue);
    }
  }
  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
  console.log('report written: ' + path.relative(ROOT, outFile));
}

function main() {
  const args = process.argv.slice(2);
  const jsonIndex = args.indexOf('--json');
  const mdIndex = args.indexOf('--write-report');
  const levelIndex = args.indexOf('--level');
  const strict = args.includes('--strict');
  const result = run();
  if (levelIndex >= 0 && args[levelIndex + 1]) {
    const level = args[levelIndex + 1].toUpperCase();
    result.reports = result.reports.filter((r) => r.level === level);
  }
  const totals = summarize(result);
  if (jsonIndex >= 0) {
    const out = args[jsonIndex + 1] || path.join(ROOT, 'tools', 'lesson-style-report.json');
    fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), reports: result.reports }, null, 2) + '\n', 'utf8');
    console.log('json written: ' + path.relative(ROOT, out));
  }
  if (mdIndex >= 0) {
    writeMarkdown(result, args[mdIndex + 1] || path.join(ROOT, 'docs', 'LESSON_REVIEW.md'));
  }
  if (strict && totals.errors > 0) process.exit(1);
}

main();
