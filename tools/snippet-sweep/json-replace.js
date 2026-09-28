// Replace one exact snippet inside a lesson JSON file, tolerating the
// \uXXXX escapes the lesson files use (e.g. `>` stored as \u003e).
'use strict';

function hexPattern(cp) {
  let out = '';
  for (const h of cp.toString(16).padStart(4, '0')) {
    out += /[0-9]/.test(h) ? h : '[' + h + h.toUpperCase() + ']';
  }
  return '\\\\u' + out;
}

function rawRegex(jsonEsc) {
  let out = '';
  for (let i = 0; i < jsonEsc.length; i++) {
    const ch = jsonEsc[i];
    if (ch === '\\') {
      const nxt = jsonEsc[i + 1];
      out += '\\\\' + (nxt === '\\' ? '\\\\' : nxt);
      i += 1;
      continue;
    }
    const cp = ch.codePointAt(0);
    const plain = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (cp > 31 && cp < 127) out += '(?:' + plain + '|' + hexPattern(cp) + ')';
    else out += plain;
  }
  return out;
}

// Returns the new raw text, or null when oldCode is not present.
function replaceOnce(raw, oldCode, newCode) {
  const o = JSON.stringify(oldCode).slice(1, -1);
  const n = JSON.stringify(newCode).slice(1, -1);
  if (raw.indexOf(o) >= 0) return raw.replace(o, () => n);
  const re = new RegExp(rawRegex(o));
  if (!re.test(raw)) return null;
  return raw.replace(re, () => n);
}

// Replace every occurrence of oldCode (used when the same snippet text
// appears in more than one lesson field). Matches are computed against the
// original text, so a replacement that contains oldCode cannot re-match.
function replaceAll(raw, oldCode, newCode) {
  const o = JSON.stringify(oldCode).slice(1, -1);
  const n = JSON.stringify(newCode).slice(1, -1);
  const plain = raw.split(o);
  if (plain.length > 1) return { text: plain.join(n), count: plain.length - 1 };
  const re = new RegExp(rawRegex(o), 'g');
  const matches = raw.match(re);
  if (!matches) return { text: raw, count: 0 };
  return { text: raw.replace(re, () => n), count: matches.length };
}

module.exports = { replaceOnce, replaceAll };
