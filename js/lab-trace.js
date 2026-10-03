// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Algorithm Lab trace protocol v1 parser (docs/LAB_PROTOCOL.md).
//
// Shared by the browser player and tools/lab-audit.js. Parses stdout as data
// only: a split on '|' and '=', never eval, never HTML. All values are
// bounded; excess events are dropped and reported as truncated.
'use strict';

var LAB_TRACE_MAX_EVENTS = 20000;
var LAB_TRACE_MAX_LINE = 512;
var LAB_TRACE_MAX_FIELDS = 32;
var LAB_TRACE_MAX_VALUE = 256;
var LAB_TRACE_MAX_TEXT = 1024 * 1024;

var LAB_TRACE_NAME_RE = /^[a-z][a-z0-9_]*$/;
var LAB_TRACE_VALUE_RE = /^[A-Za-z0-9_.:,+*-]*$/;

function labTraceFieldValueOk(value) {
  return value.length <= LAB_TRACE_MAX_VALUE && LAB_TRACE_VALUE_RE.test(value);
}

/**
 * Parse one trace line. Returns { ok: true, event } or { ok: false, reason }.
 * A line that does not start with "v1|" is not a trace line at all and is
 * reported with reason "not-trace".
 * @param {string} line
 * @param {number} lineNumber 1-based, for reporting
 */
function labParseTraceLine(line, lineNumber) {
  if (line.slice(0, 3) !== 'v1|') return { ok: false, reason: 'not-trace' };
  if (line.length > LAB_TRACE_MAX_LINE) return { ok: false, reason: 'line-too-long' };

  var parts = line.split('|');
  var eventName = parts[1];
  if (!LAB_TRACE_NAME_RE.test(eventName)) {
    return { ok: false, reason: 'bad-event-name' };
  }
  if (parts.length - 2 > LAB_TRACE_MAX_FIELDS) {
    return { ok: false, reason: 'too-many-fields' };
  }

  var fields = {};
  var step = null;
  for (var i = 2; i < parts.length; i++) {
    var part = parts[i];
    if (!part) return { ok: false, reason: 'empty-field' };
    var eq = part.indexOf('=');
    if (eq <= 0) return { ok: false, reason: 'bad-field' };
    var key = part.slice(0, eq);
    var value = part.slice(eq + 1);
    if (!LAB_TRACE_NAME_RE.test(key) || !labTraceFieldValueOk(value)) {
      return { ok: false, reason: 'bad-field' };
    }
    if (key === 'step') step = value;
    else fields[key] = value;
  }

  return {
    ok: true,
    event: { event: eventName, fields: fields, step: step, line: lineNumber },
  };
}

/**
 * Parse a program's stdout into trace events.
 * @param {string} text
 * @returns {{ok: boolean, events: Array, errors: Array, ignored: Array, truncated: boolean, bytes: number}}
 */
function labParseTrace(text) {
  var source = String(text == null ? '' : text);
  var result = {
    ok: true,
    events: [],
    errors: [],
    ignored: [],
    truncated: false,
    bytes: source.length,
  };

  if (source.length > LAB_TRACE_MAX_TEXT) {
    result.truncated = true;
    result.ok = false;
    result.errors.push({ line: 0, reason: 'trace-too-large' });
    source = source.slice(0, LAB_TRACE_MAX_TEXT);
  }

  var lines = source.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/\s+$/, '');
    if (!line) continue;
    var parsed = labParseTraceLine(line, i + 1);
    if (!parsed.ok) {
      if (parsed.reason === 'not-trace') {
        if (result.ignored.length < 20) {
          result.ignored.push({ line: i + 1, text: line.slice(0, 120) });
        }
        continue;
      }
      result.ok = false;
      if (result.errors.length < 20) {
        result.errors.push({ line: i + 1, reason: parsed.reason });
      }
      continue;
    }
    if (result.events.length >= LAB_TRACE_MAX_EVENTS) {
      result.truncated = true;
      break;
    }
    result.events.push(parsed.event);
  }

  return result;
}

/**
 * Collect "// @step <name>" annotations from program source.
 * @param {string} code
 * @returns {{map: Object, names: Array, lines: Object}} map name -> [1-based lines]
 */
function labExtractAnnotations(code) {
  var source = String(code == null ? '' : code);
  var map = {};
  var lines = source.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var m = /\/\/\s*@step\s+([a-z0-9_]+)/.exec(lines[i]);
    if (!m) continue;
    var name = m[1];
    if (!map[name]) map[name] = [];
    map[name].push(i + 1);
  }
  var names = Object.keys(map).sort();
  return { map: map, names: names, lines: lines.length };
}

/** Read an integer field, bounded to +-10,000,000. Returns null when absent. */
function labIntField(fields, key) {
  if (!fields || typeof fields[key] !== 'string') return null;
  if (!/^-?\d{1,8}$/.test(fields[key])) return null;
  var n = parseInt(fields[key], 10);
  if (n > 10000000 || n < -10000000) return null;
  return n;
}

/** Read a comma-separated integer list field, bounded. Returns [] when absent. */
function labIntListField(fields, key) {
  if (!fields || typeof fields[key] !== 'string' || fields[key] === '') return [];
  var parts = fields[key].split(',');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    if (!/^-?\d{1,8}$/.test(parts[i])) return null;
    out.push(parseInt(parts[i], 10));
  }
  return out;
}

/** Count events by type. */
function labEventSummary(events) {
  var counts = {};
  for (var i = 0; i < events.length; i++) {
    var name = events[i].event;
    counts[name] = (counts[name] || 0) + 1;
  }
  return { total: events.length, counts: counts };
}

var LabTrace = {
  MAX_EVENTS: LAB_TRACE_MAX_EVENTS,
  MAX_LINE: LAB_TRACE_MAX_LINE,
  parseLine: labParseTraceLine,
  parse: labParseTrace,
  extractAnnotations: labExtractAnnotations,
  intField: labIntField,
  intListField: labIntListField,
  summary: labEventSummary,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LAB_TRACE_MAX_EVENTS: LAB_TRACE_MAX_EVENTS,
    LAB_TRACE_MAX_LINE: LAB_TRACE_MAX_LINE,
    labParseTraceLine: labParseTraceLine,
    labParseTrace: labParseTrace,
    labExtractAnnotations: labExtractAnnotations,
    labIntField: labIntField,
    labIntListField: labIntListField,
    labEventSummary: labEventSummary,
  };
}
if (typeof window !== 'undefined') {
  window.LabTrace = LabTrace;
}
