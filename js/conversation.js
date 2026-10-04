// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Conversation transcript builder for input lessons. Pure functions (no DOM)
// so tools/test-server.js can cover the interleaving.
//
// The playground runs programs one-shot: each answer re-runs the program with
// one more input line, and the transcript interleaves the answer at the point
// where the program's output starts to differ from the previous run. Programs
// that print a prompt before reading (the recommended pattern) line up
// perfectly; programs that read silently fall back to the first changed line.
'use strict';

function xiomConversationLines(text) {
  var source = String(text == null ? '' : text).replace(/\r\n/g, '\n');
  if (source === '') return [];
  var lines = source.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * @param {Array<string>} outputs outputs[i] is the program output with
 *   answers[0..i-1] supplied; outputs[0] is the no-input run.
 * @param {Array<string>} answers
 * @returns {Array<{kind: 'out'|'you', text: string}>}
 */
function xiomBuildConversation(outputs, answers) {
  var entries = [];
  if (!Array.isArray(outputs) || outputs.length === 0 || outputs[0] == null) return entries;
  var base = xiomConversationLines(outputs[0]);
  for (var i = 0; i < base.length; i++) entries.push({ kind: 'out', text: base[i] });
  var usable = Math.min(answers.length, outputs.length - 1);
  for (var k = 0; k < usable; k++) {
    var prev = xiomConversationLines(outputs[k]);
    var next = xiomConversationLines(outputs[k + 1]);
    var d = 0;
    while (d < prev.length && d < next.length && prev[d] === next[d]) d++;
    var at = d + k; // k answers are already inserted before this point
    if (at > entries.length) at = entries.length;
    var tail = [];
    for (var j = d; j < next.length; j++) tail.push({ kind: 'out', text: next[j] });
    entries = entries.slice(0, at).concat([{ kind: 'you', text: answers[k] }], tail);
  }
  // Answers submitted but not yet run appear as pending lines at the end.
  for (var p = usable; p < answers.length; p++) entries.push({ kind: 'you', text: answers[p] });
  // The latest run ends with the program reading stale/absent input; hide
  // those trailing runtime lines until the next answer arrives.
  while (entries.length > 0) {
    var last = entries[entries.length - 1];
    if (last.kind === 'out' && /(empty input|end of input|unexpected end)/i.test(last.text)) {
      entries.pop();
    } else {
      break;
    }
  }
  return entries;
}

/** Last non-empty line of an output, used as a hint for the answer box. */
function xiomLastPromptLine(text) {
  var lines = xiomConversationLines(text);
  for (var i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() !== '') return lines[i].trim();
  }
  return '';
}

var XiomConversation = { build: xiomBuildConversation, lines: xiomConversationLines, lastPromptLine: xiomLastPromptLine };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    xiomConversationLines: xiomConversationLines,
    xiomBuildConversation: xiomBuildConversation,
    xiomLastPromptLine: xiomLastPromptLine,
  };
}
if (typeof window !== 'undefined') {
  window.XiomConversation = XiomConversation;
}
