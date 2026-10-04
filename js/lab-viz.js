// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Algorithm Lab drawing primitives: bars, cells, grid, graph, tree, matrix,
// stack, timeline. Each renderer applies protocol v1 events to a small state
// object and draws that state on a canvas, with short eased transitions when
// motion is enabled (disabled under prefers-reduced-motion). No DOM beyond
// the canvas, no HTML interpolation, ES5 only.
'use strict';

var LAB_VIZ_MAX_CELLS = 400;

// Transition durations in milliseconds. Longer than a UI flicker so a slow
// pace still reads as motion, short enough not to lag behind playback.
var LAB_VIZ_DUR = {
  swap: 300,
  set: 240,
  compare: 180,
  mark: 460,
  pointer: 260,
  visit: 300,
  frontier: 300,
  path: 320,
  enter: 240,
  exit: 240,
  point: 280,
  pulse: 460,
  current: 260,
};

function labVizNow() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

function labClamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function labEaseOut(t) {
  var inv = 1 - t;
  return 1 - inv * inv * inv;
}

function labLerp(from, to, t) {
  return from + (to - from) * t;
}

/** Active transition for a named animation, or null when finished/disabled. */
function labAnim(state, name, now) {
  var anim = state.anim && state.anim[name];
  if (!anim || anim.at <= -1e8) return null;
  var t = (now - anim.at) / anim.dur;
  if (t <= 0) t = 0;
  if (t >= 1) return null;
  return { t: labEaseOut(t), raw: t, anim: anim };
}

/** Fade alpha (0..1) for an element whose transition started at `at`. */
function labFadeAlpha(at, dur, now) {
  if (at == null || at <= -1e8) return 1;
  return labEaseOut(labClamp01((now - at) / dur));
}

function labAnimAt(motion) {
  return motion && motion.enabled ? motion.now() : -1e9;
}

function labVizIsAnimating(state, now) {
  if (!state.anim) return false;
  for (var key in state.anim) {
    var anim = state.anim[key];
    if (!anim || anim.at <= -1e8) continue;
    if (now < anim.at + anim.dur) return true;
  }
  return false;
}

function labNum(fields, key, fallback) {
  if (!fields || typeof fields[key] !== 'string') return fallback;
  if (!/^-?\d{1,8}$/.test(fields[key])) return fallback;
  return parseInt(fields[key], 10);
}

function labList(fields, key) {
  if (!fields || typeof fields[key] !== 'string' || fields[key] === '') return [];
  var parts = fields[key].split(',');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    if (!/^-?\d{1,8}$/.test(parts[i])) return [];
    out.push(parseInt(parts[i], 10));
  }
  return out;
}

function labCoordList(fields, key) {
  if (!fields || typeof fields[key] !== 'string' || fields[key] === '') return [];
  var parts = fields[key].split(',');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var pair = parts[i].split('-');
    if (pair.length !== 2 || !/^\d{1,3}$/.test(pair[0]) || !/^\d{1,3}$/.test(pair[1])) continue;
    out.push([parseInt(pair[0], 10), parseInt(pair[1], 10)]);
  }
  return out;
}

function labVizInitial(view) {
  var type = (view && view.type) || 'bars';
  if (type === 'bars') return { values: [], roles: {}, compare: [], flash: [], peak: 1, anim: {} };
  if (type === 'cells') return { values: [], roles: {}, roleIndex: {}, visited: {}, compare: [], queue: Boolean(view.queue), pending: [], exiting: null, answer: null, anim: {} };
  if (type === 'grid') return { rows: 0, cols: 0, walls: {}, labels: [], visited: {}, frontier: {}, path: {}, roles: {}, visitAt: {}, frontierAt: {}, pathAt: {}, pathOrder: [], cursor: null, done: false, anim: {} };
  if (type === 'graph') return { nodes: [], edges: [], roles: {}, visited: {}, cursor: null, done: false, anim: {} };
  if (type === 'tree') return { nodes: {}, order: [], roles: {}, current: null, done: false, anim: {} };
  if (type === 'matrix') return { rows: 0, cols: 0, labels: [], rowLabels: [], cells: {}, roles: {}, current: null, done: false, anim: {} };
  if (type === 'stack') return { frames: [], exiting: null, lastPopped: null, done: false, anim: {} };
  if (type === 'timeline') return { points: [], pointAt: [], peak: 1, result: null, done: false, anim: {} };
  return {};
}

function labRoleColor(colors, role) {
  if (role === 'sorted' || role === 'found' || role === 'prime' || role === 'path') return colors.green;
  if (role === 'compare' || role === 'mid' || role === 'target' || role === 'frontier' || role === 'tail' || role === 'key') return colors.amber;
  if (role === 'lo' || role === 'hi' || role === 'cursor' || role === 'head' || role === 'current' || role === 'minpos' || role === 'move') return colors.indigo;
  if (role === 'wall') return colors.low;
  if (role === 'composite') return colors.border;
  return colors.indigo;
}

function labApplyEvent(type, state, event, motion) {
  var fields = event.fields || {};
  var name = event.event;
  var at = labAnimAt(motion);

  if (type === 'bars') {
    if (name === 'init') {
      state.values = labList(fields, 'vals');
      state.peak = 1;
      for (var i = 0; i < state.values.length; i++) if (state.values[i] > state.peak) state.peak = state.values[i];
    } else if (name === 'compare') {
      state.compare = [labNum(fields, 'i', -1), labNum(fields, 'j', -1)];
      state.anim.compare = { at: at, dur: LAB_VIZ_DUR.compare };
    } else if (name === 'swap') {
      var a = labNum(fields, 'i', -1);
      var b = labNum(fields, 'j', -1);
      if (a >= 0 && b >= 0 && a < state.values.length && b < state.values.length) {
        var valueA = state.values[a];
        var valueB = state.values[b];
        state.values[a] = valueB;
        state.values[b] = valueA;
        state.anim.swap = { i: a, j: b, valueA: valueA, valueB: valueB, at: at, dur: LAB_VIZ_DUR.swap };
      }
      state.flash = [a, b];
      state.anim.flash = { at: at, dur: LAB_VIZ_DUR.swap };
    } else if (name === 'set') {
      var atIndex = labNum(fields, 'i', -1);
      if (atIndex >= 0 && atIndex < state.values.length) {
        var previous = state.values[atIndex];
        var next = labNum(fields, 'v', 0);
        state.values[atIndex] = next;
        state.anim.set = { i: atIndex, from: previous, to: next, at: at, dur: LAB_VIZ_DUR.set };
      }
      state.flash = [atIndex, -1];
    } else if (name === 'mark') {
      var roleIndex = labNum(fields, 'i', -1);
      if (roleIndex >= 0) {
        state.roles[roleIndex] = fields.role || 'mark';
        state.anim.mark = { i: roleIndex, at: at, dur: LAB_VIZ_DUR.mark };
      }
    }
  } else if (type === 'cells') {
    if (name === 'init') {
      state.values = labList(fields, 'vals');
      state.queue = state.queue || fields.queue === '1';
    } else if (name === 'compare') {
      if (typeof fields.i === 'string') state.compare = [labNum(fields, 'i', -1), labNum(fields, 'j', -1)];
      else state.compare = [state.roleIndex.cursor != null ? state.roleIndex.cursor : -1, -1];
      state.anim.compare = { at: at, dur: LAB_VIZ_DUR.compare };
    } else if (name === 'mark') {
      var markIndex = labNum(fields, 'i', -1);
      if (markIndex >= 0) {
        var role = fields.role || 'mark';
        var previousIndex = state.roleIndex[role];
        state.roles[markIndex] = role;
        state.roleIndex[role] = markIndex;
        if (role === 'cursor') state.roles.__cursor = markIndex;
        if (role === 'found') {
          state.answer = markIndex;
          state.anim.found = { i: markIndex, at: at, dur: LAB_VIZ_DUR.mark };
        }
        if (previousIndex != null && previousIndex !== markIndex) {
          state.anim['ptr_' + role] = { from: previousIndex, to: markIndex, at: at, dur: LAB_VIZ_DUR.pointer };
        }
      }
    } else if (name === 'visit') {
      var visitIndex = labNum(fields, 'i', -1);
      if (visitIndex >= 0) {
        state.visited[visitIndex] = true;
        state.anim.visit = { i: visitIndex, at: at, dur: LAB_VIZ_DUR.visit };
      }
    } else if (name === 'set') {
      var setIndex = labNum(fields, 'i', -1);
      if (setIndex >= 0 && setIndex < state.values.length) state.values[setIndex] = labNum(fields, 'v', 0);
    } else if (name === 'enqueue') {
      state.pending.push({ v: labNum(fields, 'v', 0), at: at });
      state.anim.enqueue = { at: at, dur: LAB_VIZ_DUR.enter };
    } else if (name === 'dequeue') {
      if (state.pending.length > 0) {
        var served = state.pending.shift();
        state.exiting = { v: served.v, at: at };
        state.anim.exit = { at: at, dur: LAB_VIZ_DUR.exit };
      }
    }
  } else if (type === 'grid') {
    if (name === 'init') {
      state.rows = labNum(fields, 'rows', 0);
      state.cols = labNum(fields, 'cols', 0);
      state.labels = labList(fields, 'vals');
      if (fields.walls === 'all') {
        for (var wallRow = 0; wallRow < state.rows; wallRow++) {
          for (var wallCol = 0; wallCol < state.cols; wallCol++) {
            state.walls[wallRow + ',' + wallCol] = true;
          }
        }
      } else {
        var walls = labCoordList(fields, 'walls');
        for (var w = 0; w < walls.length; w++) state.walls[walls[w][0] + ',' + walls[w][1]] = true;
      }
    } else if (name === 'visit') {
      state.cursor = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
      var visitKey = state.cursor[0] + ',' + state.cursor[1];
      state.visited[visitKey] = true;
      state.visitAt[visitKey] = at;
      state.anim.cursor = { at: at, dur: LAB_VIZ_DUR.mark };
    } else if (name === 'frontier') {
      var frontierKey = labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0);
      state.frontier[frontierKey] = true;
      state.frontierAt[frontierKey] = at;
    } else if (name === 'path') {
      var pathKey = labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0);
      state.path[pathKey] = true;
      if (state.pathAt[pathKey] == null) state.pathOrder.push(pathKey);
      state.pathAt[pathKey] = at;
    } else if (name === 'mark') {
      var markKey = labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0);
      state.roles[markKey] = fields.role || 'mark';
      state.anim.mark = { key: markKey, at: at, dur: LAB_VIZ_DUR.mark };
    } else if (name === 'set') {
      state.cursor = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
      state.anim.cursor = { at: at, dur: LAB_VIZ_DUR.mark };
    }
  } else if (type === 'graph') {
    if (name === 'init') {
      var n = labNum(fields, 'n', 0);
      state.nodes = [];
      for (var nodeIndex = 0; nodeIndex < n; nodeIndex++) state.nodes.push({ id: nodeIndex, v: null });
      var vals = labList(fields, 'vals');
      for (var v = 0; v < vals.length && v < state.nodes.length; v++) state.nodes[v].v = vals[v];
      state.edges = labEdgeList(fields);
    } else if (name === 'visit') {
      var visitedId = labNum(fields, 'id', -1);
      if (visitedId >= 0) {
        state.visited[visitedId] = true;
        state.cursor = visitedId;
        state.anim.pulse = { id: visitedId, at: at, dur: LAB_VIZ_DUR.pulse };
      }
    } else if (name === 'mark') {
      var markedId = labNum(fields, 'id', -1);
      if (markedId >= 0) {
        state.roles[markedId] = fields.role || 'mark';
        state.anim.pulse = { id: markedId, at: at, dur: LAB_VIZ_DUR.pulse };
      }
      if (fields.role === 'cursor') state.cursor = markedId;
    } else if (name === 'set') {
      var setNode = labNum(fields, 'id', -1);
      if (setNode >= 0 && state.nodes[setNode]) {
        state.nodes[setNode].v = labNum(fields, 'v', 0);
        state.anim.pulse = { id: setNode, at: at, dur: LAB_VIZ_DUR.current };
      }
    } else if (name === 'edge') {
      var edgeA = labNum(fields, 'a', 0);
      var edgeB = labNum(fields, 'b', 0);
      var found = null;
      for (var edgeIndex = 0; edgeIndex < state.edges.length; edgeIndex++) {
        if (state.edges[edgeIndex].a === edgeA && state.edges[edgeIndex].b === edgeB) { found = state.edges[edgeIndex]; break; }
      }
      if (found) {
        // Recolouring an existing edge (Dijkstra relax, Kruskal accept/reject).
        if (typeof fields.role === 'string') found.role = fields.role;
        if (typeof fields.w === 'string') found.w = labNum(fields, 'w', found.w || 0);
      } else {
        var newEdge = { a: edgeA, b: edgeB };
        if (typeof fields.w === 'string') newEdge.w = labNum(fields, 'w', 0);
        if (typeof fields.role === 'string') newEdge.role = fields.role;
        state.edges.push(newEdge);
      }
    }
  } else if (type === 'tree') {
    if (name === 'node') {
      var id = labNum(fields, 'id', -1);
      if (id >= 0) {
        var existingNode = state.nodes[id];
        if (existingNode) {
          // Re-emitting a node relabels it (heap swaps) without re-layout.
          existingNode.parent = labNum(fields, 'parent', existingNode.parent);
          existingNode.v = labNum(fields, 'v', existingNode.v);
          if (typeof fields.label === 'string' && fields.label) existingNode.label = fields.label;
        } else {
          state.nodes[id] = {
            id: id,
            parent: labNum(fields, 'parent', -1),
            v: labNum(fields, 'v', 0),
            from: labNum(fields, 'from', -1),
            to: labNum(fields, 'to', -1),
            at: at,
          };
          if (typeof fields.label === 'string' && fields.label) state.nodes[id].label = fields.label;
          state.order.push(id);
          state.anim.enter = { id: id, at: at, dur: LAB_VIZ_DUR.enter };
        }
      }
    } else if (name === 'mark') {
      var markId = labNum(fields, 'id', -1);
      if (markId >= 0) state.roles[markId] = fields.role || 'mark';
      state.current = markId;
      state.anim.pulse = { id: markId, at: at, dur: LAB_VIZ_DUR.pulse };
    } else if (name === 'visit') {
      state.current = labNum(fields, 'id', -1);
      state.anim.pulse = { id: state.current, at: at, dur: LAB_VIZ_DUR.pulse };
    }
  } else if (type === 'matrix') {
    if (name === 'init') {
      state.rows = labNum(fields, 'rows', 0);
      state.cols = labNum(fields, 'cols', 0);
      state.labels = [];
      if (typeof fields.labels === 'string' && fields.labels) state.labels = fields.labels.split(',');
      state.rowLabels = [];
      if (typeof fields.rowlabels === 'string' && fields.rowlabels) state.rowLabels = fields.rowlabels.split(',');
    } else if (name === 'clear') {
      state.cells = {};
      state.roles = {};
      state.current = null;
    } else if (name === 'set') {
      var row = labNum(fields, 'r', 0);
      var col = labNum(fields, 'c', 0);
      state.cells[row + ',' + col] = labNum(fields, 'v', 0);
      if (row + 1 > state.rows) state.rows = row + 1;
      if (col + 1 > state.cols) state.cols = col + 1;
      state.current = [row, col];
      state.anim.current = { at: at, dur: LAB_VIZ_DUR.current };
    } else if (name === 'mark') {
      state.roles[labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0)] = fields.role || 'mark';
      state.current = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
      state.anim.current = { at: at, dur: LAB_VIZ_DUR.current };
    } else if (name === 'visit') {
      state.current = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
      state.anim.current = { at: at, dur: LAB_VIZ_DUR.current };
    }
  } else if (type === 'stack') {
    if (name === 'push') {
      state.frames.push({ label: String(labNum(fields, 'v', 0)), role: 'value', at: at });
      state.lastPopped = null;
      state.anim.enter = { at: at, dur: LAB_VIZ_DUR.enter };
    } else if (name === 'pop') {
      var popped = state.frames.pop();
      state.exiting = popped ? { label: popped.label, at: at } : null;
      state.lastPopped = labNum(fields, 'v', 0);
      state.anim.exit = { at: at, dur: LAB_VIZ_DUR.exit };
    } else if (name === 'call') {
      state.frames.push({ label: (fields.fn || 'fn') + '(' + labNum(fields, 'n', 0) + ')', role: 'call', at: at });
      state.lastPopped = null;
      state.anim.enter = { at: at, dur: LAB_VIZ_DUR.enter };
    } else if (name === 'ret') {
      var returned = state.frames.pop();
      state.exiting = returned ? { label: returned.label, at: at } : null;
      state.lastPopped = labNum(fields, 'v', 0);
      state.anim.exit = { at: at, dur: LAB_VIZ_DUR.exit };
    }
  } else if (type === 'timeline') {
    if (name === 'point') {
      var point = labNum(fields, 'v', 0);
      state.points.push(point);
      state.pointAt.push(at);
      if (point > state.peak) state.peak = point;
      state.anim.point = { at: at, dur: LAB_VIZ_DUR.point };
    } else if (name === 'mark') {
      var peak = labNum(fields, 'v', 0);
      if (peak > state.peak) state.peak = peak;
      state.anim.peak = { at: at, dur: LAB_VIZ_DUR.pulse };
    }
  }

  if (name === 'done') {
    state.done = true;
    if (type === 'timeline') {
      var result = labNum(fields, 'result', null);
      if (result !== null) state.result = result;
      var donePeak = labNum(fields, 'peak', null);
      if (donePeak !== null) state.peak = donePeak;
    }
    if (type === 'bars') {
      state.compare = [];
      state.flash = [];
    }
    if (type === 'cells') state.compare = [];
  }
}

function labEdgeList(fields) {
  if (!fields || typeof fields.edges !== 'string' || fields.edges === '') return [];
  var parts = fields.edges.split(',');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i].split('-');
    if (seg.length === 2 && /^\d{1,4}$/.test(seg[0]) && /^\d{1,4}$/.test(seg[1])) {
      out.push({ a: parseInt(seg[0], 10), b: parseInt(seg[1], 10) });
    } else if (seg.length === 3 && /^\d{1,4}$/.test(seg[0]) && /^\d{1,4}$/.test(seg[1]) && /^\d{1,4}$/.test(seg[2])) {
      out.push({ a: parseInt(seg[0], 10), b: parseInt(seg[1], 10), w: parseInt(seg[2], 10) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function labRoundRect(ctx, x, y, w, h, r) {
  var radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function labArrow(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  var angle = Math.atan2(y2 - y1, x2 - x1);
  var size = 6;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function labFitText(ctx, text, maxWidth, baseSize) {
  var size = baseSize;
  while (size > 8) {
    ctx.font = '600 ' + size + 'px ' + 'ui-monospace, Menlo, Consolas, monospace';
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function labEmptyMessage(ctx, w, h, colors) {
  ctx.fillStyle = colors.low;
  ctx.font = '13px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Run the program to generate its trace, then press play.', w / 2, h / 2);
}

function labPulseRing(ctx, x, y, baseRadius, progress, color) {
  if (!progress) return;
  var alpha = 1 - progress.raw;
  ctx.globalAlpha = alpha * 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, baseRadius + 4 + progress.raw * 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// bars
// ---------------------------------------------------------------------------

function labDrawBars(state, ctx, w, h, colors, now) {
  if (state.values.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var pad = 14;
  var labelSpace = 20;
  var available = w - pad * 2;
  var baseline = h - pad - labelSpace;
  var barWidth = Math.min(54, Math.max(6, available / state.values.length - 6));
  var gap = Math.max(2, (available - barWidth * state.values.length) / Math.max(1, state.values.length - 1));
  var totalWidth = barWidth * state.values.length + gap * (state.values.length - 1);
  var startX = (w - totalWidth) / 2;
  var topLimit = pad + 24;

  function xFor(index) { return startX + index * (barWidth + gap); }
  function heightFor(value) { return Math.max(4, (value / Math.max(1, state.peak)) * (baseline - topLimit)); }

  function drawBar(x, value, fill, border, crossed) {
    var barHeight = heightFor(value);
    var y = baseline - barHeight;
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = crossed ? 2 : 1;
    labRoundRect(ctx, x, y, barWidth, barHeight, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.hi;
    var text = String(Math.round(value));
    labFitText(ctx, text, barWidth + 6, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, x + barWidth / 2, y - 4);
  }

  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(pad, baseline + 0.5);
  ctx.lineTo(w - pad, baseline + 0.5);
  ctx.stroke();

  var swap = labAnim(state, 'swap', now);
  var setAnim = labAnim(state, 'set', now);
  var markAnim = labAnim(state, 'mark', now);
  var compareAlpha = state.anim.compare ? labFadeAlpha(state.anim.compare.at, state.anim.compare.dur, now) : 1;
  var flashAlpha = state.anim.flash ? labFadeAlpha(state.anim.flash.at, state.anim.flash.dur, now) : 1;

  for (var i = 0; i < state.values.length; i++) {
    if (swap && (i === swap.anim.i || i === swap.anim.j)) continue; // travelers drawn below
    var value = state.values[i];
    if (setAnim && setAnim.anim.i === i) value = labLerp(setAnim.anim.from, setAnim.anim.to, setAnim.t);
    var fill = colors.panel3;
    var border = colors.vizStroke;
    if (state.roles[i]) {
      var roleColor = labRoleColor(colors, state.roles[i]);
      fill = roleColor;
      border = roleColor;
    }
    drawBar(xFor(i), value, fill, border, Boolean(state.roles[i]));
    if (state.compare.indexOf(i) >= 0 && compareAlpha < 1) {
      ctx.globalAlpha = compareAlpha;
      ctx.fillStyle = colors.amber;
      var cmpHeight = heightFor(value);
      labRoundRect(ctx, xFor(i), baseline - cmpHeight, barWidth, cmpHeight, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (state.compare.indexOf(i) >= 0) {
      ctx.fillStyle = colors.amber;
      var amberHeight = heightFor(value);
      labRoundRect(ctx, xFor(i), baseline - amberHeight, barWidth, amberHeight, 4);
      ctx.fill();
    }
    if (state.flash.indexOf(i) >= 0 && flashAlpha > 0 && !swap) {
      ctx.globalAlpha = flashAlpha;
      ctx.strokeStyle = colors.indigo;
      ctx.lineWidth = 2;
      var flashHeight = heightFor(value);
      labRoundRect(ctx, xFor(i), baseline - flashHeight, barWidth, flashHeight, 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  if (swap) {
    var progress = swap.t;
    var xA = labLerp(xFor(swap.anim.i), xFor(swap.anim.j), progress);
    var xB = labLerp(xFor(swap.anim.j), xFor(swap.anim.i), progress);
    drawBar(xA, swap.anim.valueA, colors.indigo, colors.indigo, true);
    drawBar(xB, swap.anim.valueB, colors.indigo, colors.indigo, true);
  }

  if (markAnim) {
    var markIndex = markAnim.anim.i;
    if (markIndex >= 0 && markIndex < state.values.length) {
      labPulseRing(ctx, xFor(markIndex) + barWidth / 2, baseline - 6, barWidth * 0.45, markAnim, labRoleColor(colors, state.roles[markIndex] || 'cursor'));
    }
  }

  ctx.fillStyle = colors.mid;
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (var index = 0; index < state.values.length; index++) {
    ctx.fillText(String(index), xFor(index) + barWidth / 2, baseline + 4);
  }
}

// ---------------------------------------------------------------------------
// cells (search pointers, queue)
// ---------------------------------------------------------------------------

function labDrawCells(state, ctx, w, h, colors, now) {
  if (state.queue) {
    labDrawQueue(state, ctx, w, h, colors, now);
    return;
  }
  if (state.values.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var pad = 16;
  var n = state.values.length;
  var cellWidth = Math.min(64, Math.max(18, (w - pad * 2) / n - 6));
  var gap = Math.max(2, ((w - pad * 2) - cellWidth * n) / Math.max(1, n - 1));
  var total = cellWidth * n + gap * (n - 1);
  var startX = (w - total) / 2;
  var top = h / 2 - cellWidth / 2;
  function xFor(index) { return startX + index * (cellWidth + gap); }

  var cursor = state.roleIndex.cursor != null ? state.roleIndex.cursor : -1;
  var compareAlpha = state.anim.compare ? labFadeAlpha(state.anim.compare.at, state.anim.compare.dur, now) : 1;
  var visitAnim = labAnim(state, 'visit', now);
  var foundAnim = labAnim(state, 'found', now);

  for (var i = 0; i < n; i++) {
    var x = xFor(i);
    var fill = colors.panel2;
    var border = colors.vizStroke;
    var role = state.roles[i];
    if (state.visited[i]) fill = colors.indigoSoft;
    if (role === 'target') border = colors.amber;
    if (role === 'found') { fill = colors.green; border = colors.green; }
    if (role === 'lo' || role === 'hi' || role === 'cursor') border = colors.indigo;
    if (role === 'mid') border = colors.amber;
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = cursor === i || role ? 2 : 1;
    labRoundRect(ctx, x, top, cellWidth, cellWidth, 5);
    ctx.fill();
    ctx.stroke();

    if (visitAnim && visitAnim.anim.i === i && !state.roles[i]) {
      ctx.globalAlpha = visitAnim.t;
      ctx.fillStyle = colors.indigoSoft;
      labRoundRect(ctx, x, top, cellWidth, cellWidth, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (state.compare.indexOf(i) >= 0 && compareAlpha < 1) {
      ctx.globalAlpha = compareAlpha;
      ctx.fillStyle = colors.amber;
      labRoundRect(ctx, x, top, cellWidth, cellWidth, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (state.compare.indexOf(i) >= 0) {
      ctx.fillStyle = colors.amber;
      labRoundRect(ctx, x, top, cellWidth, cellWidth, 5);
      ctx.fill();
    }

    ctx.fillStyle = colors.hi;
    var label = String(state.values[i]);
    labFitText(ctx, label, cellWidth - 8, 13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + cellWidth / 2, top + cellWidth / 2);
  }

  if (foundAnim && foundAnim.anim.i >= 0 && foundAnim.anim.i < n) {
    labPulseRing(ctx, xFor(foundAnim.anim.i) + cellWidth / 2, top + cellWidth / 2, cellWidth * 0.5, foundAnim, colors.green);
  }

  var pointerRoles = ['lo', 'mid', 'hi', 'cursor', 'target', 'found'];
  for (var extraRole in state.roleIndex) {
    if (pointerRoles.indexOf(extraRole) === -1 && extraRole !== 'sorted' && extraRole !== 'current' && extraRole !== 'visited') {
      pointerRoles.push(extraRole);
    }
  }
  for (var p = 0; p < pointerRoles.length; p++) {
    var pointerRole = pointerRoles[p];
    var targetIndex = state.roleIndex[pointerRole];
    if (targetIndex == null) continue;
    var pointerX = xFor(targetIndex) + cellWidth / 2;
    var move = labAnim(state, 'ptr_' + pointerRole, now);
    if (move) pointerX = labInterpolateX(xFor(move.anim.from) + cellWidth / 2, pointerX, move.t);
    ctx.fillStyle = labRoleColor(colors, pointerRole);
    ctx.font = '600 10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(pointerRole, pointerX, top - 4);
  }
}

function labInterpolateX(from, to, t) {
  return from + (to - from) * t;
}

function labDrawQueue(state, ctx, w, h, colors, now) {
  var pad = 24;
  var cellWidth = Math.min(56, Math.max(26, (w - pad * 2) / 8 - 8));
  var gap = 8;
  var top = h / 2 - cellWidth / 2;
  if (state.pending.length === 0 && !state.exiting) {
    ctx.fillStyle = colors.low;
    ctx.font = '13px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Queue is empty. Enqueue events will appear here.', w / 2, h / 2);
    return;
  }
  var startX = pad;
  function drawCell(index, value, at, isHead, slide) {
    var x = startX + index * (cellWidth + gap);
    if (x + cellWidth > w - pad) return;
    var enter = labFadeAlpha(at, LAB_VIZ_DUR.enter, now);
    ctx.globalAlpha = enter;
    var y = top + (slide ? (1 - enter) * -12 : 0);
    ctx.fillStyle = isHead ? colors.greenSoft : colors.panel2;
    ctx.strokeStyle = isHead ? colors.green : colors.vizStroke;
    ctx.lineWidth = isHead ? 2 : 1;
    labRoundRect(ctx, x, y, cellWidth, cellWidth, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.hi;
    ctx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + cellWidth / 2, y + cellWidth / 2);
    ctx.fillStyle = isHead ? colors.green : colors.mid;
    ctx.font = '600 10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(isHead ? 'front' : (index === state.pending.length - 1 ? 'back' : ''), x + cellWidth / 2, y - 4);
    ctx.globalAlpha = 1;
  }

  if (state.exiting) {
    var exit = labAnim(state, 'exit', now);
    if (exit) {
      ctx.globalAlpha = 1 - exit.raw;
      var exitX = startX - (1 - exit.raw) * (cellWidth + gap) * 0.6;
      ctx.strokeStyle = colors.amber;
      ctx.lineWidth = 2;
      labRoundRect(ctx, exitX, top, cellWidth, cellWidth, 5);
      ctx.stroke();
      ctx.fillStyle = colors.amber;
      ctx.font = '600 12px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(state.exiting.v), exitX + cellWidth / 2, top + cellWidth / 2);
      ctx.globalAlpha = 1;
    }
  }
  for (var i = 0; i < state.pending.length; i++) {
    var item = state.pending[i];
    drawCell(i, item.v, item.at, i === 0, true);
  }
}

// ---------------------------------------------------------------------------
// grid
// ---------------------------------------------------------------------------

function labDrawGrid(state, ctx, w, h, colors, now) {
  if (state.rows === 0 || state.cols === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var pad = 12;
  var cell = Math.max(8, Math.min((w - pad * 2) / state.cols, (h - pad * 2) / state.rows));
  var gridW = cell * state.cols;
  var gridH = cell * state.rows;
  var ox = (w - gridW) / 2;
  var oy = (h - gridH) / 2;
  var cursorAnim = labAnim(state, 'cursor', now);
  var markAnim = labAnim(state, 'mark', now);

  var r;
  var c;
  for (r = 0; r < state.rows; r++) {
    for (c = 0; c < state.cols; c++) {
      var key = r + ',' + c;
      var x = ox + c * cell;
      var y = oy + r * cell;
      var fill = colors.panel2;
      var border = colors.vizStroke;
      var textColor = colors.mid;
      var alpha = 1;
      if (state.walls[key]) { fill = colors.vizWall; border = colors.vizStroke; textColor = colors.low; }
      if (state.frontier[key]) {
        fill = colors.indigoSoft;
        border = colors.indigo;
        alpha = labFadeAlpha(state.frontierAt[key], LAB_VIZ_DUR.frontier, now);
      }
      if (state.visited[key]) {
        fill = colors.panel3;
        border = colors.borderSoft;
        alpha = labFadeAlpha(state.visitAt[key], LAB_VIZ_DUR.visit, now);
      }
      if (state.path[key]) {
        fill = colors.greenSoft;
        border = colors.green;
        alpha = labFadeAlpha(state.pathAt[key], LAB_VIZ_DUR.path, now);
      }
      var role = state.roles[key];
      if (role === 'prime') { border = colors.green; fill = colors.greenSoft; }
      if (role === 'composite') { border = colors.vizStroke; textColor = colors.low; }
      if (role === 'wall') { fill = colors.vizWall; border = colors.vizStroke; textColor = colors.low; }
      if (role === 'open') { fill = colors.panel2; border = colors.vizStroke; textColor = colors.mid; }
      if (role === 'start') { border = colors.green; fill = colors.greenSoft; }
      if (role === 'target') { border = colors.amber; }
      if (state.cursor && state.cursor[0] === r && state.cursor[1] === c) { border = colors.amber; }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.strokeStyle = border;
      ctx.lineWidth = (border === colors.amber || border === colors.indigo || border === colors.green) ? 2 : 1;
      ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      if (role === 'target') {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = colors.amber;
        ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }
      ctx.globalAlpha = 1;
      if (r * state.cols + c < state.labels.length) {
        var text = String(state.labels[r * state.cols + c]);
        ctx.fillStyle = role === 'composite' ? colors.low : textColor;
        labFitText(ctx, text, cell - 4, Math.min(12, cell * 0.45));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + cell / 2, y + cell / 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  if (state.pathOrder.length >= 2) {
    ctx.strokeStyle = colors.green;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var p = 0; p < state.pathOrder.length; p++) {
      var parts = state.pathOrder[p].split(',');
      var px = ox + parseInt(parts[1], 10) * cell + cell / 2;
      var py = oy + parseInt(parts[0], 10) * cell + cell / 2;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  if (cursorAnim && state.cursor) {
    labPulseRing(ctx, ox + state.cursor[1] * cell + cell / 2, oy + state.cursor[0] * cell + cell / 2, cell * 0.5, cursorAnim, colors.amber);
  }
  if (markAnim && markAnim.anim.key) {
    var markParts = markAnim.anim.key.split(',');
    labPulseRing(ctx, ox + parseInt(markParts[1], 10) * cell + cell / 2, oy + parseInt(markParts[0], 10) * cell + cell / 2, cell * 0.5, markAnim, labRoleColor(colors, state.roles[markAnim.anim.key] || 'mark'));
  }
}

// ---------------------------------------------------------------------------
// graph (nodes + directed edges; linked lists render as a chain)
// ---------------------------------------------------------------------------

function labGraphLayout(state, w, h) {
  var positions = [];
  var incoming = {};
  for (var i = 0; i < state.edges.length; i++) incoming[state.edges[i].b] = true;
  var roots = [];
  for (var r = 0; r < state.nodes.length; r++) if (!incoming[r]) roots.push(r);
  if (roots.length === 0 && state.nodes.length > 0) roots.push(0);
  var levels = {};
  var queue = roots.slice();
  for (var q = 0; q < queue.length; q++) levels[queue[q]] = 0;
  var guard = 0;
  while (queue.length > 0 && guard < 1000) {
    guard += 1;
    var id = queue.shift();
    for (var e = 0; e < state.edges.length; e++) {
      var edge = state.edges[e];
      if (edge.a === id && levels[edge.b] == null) {
        levels[edge.b] = levels[id] + 1;
        queue.push(edge.b);
      }
    }
  }
  var maxLevel = 0;
  for (var n = 0; n < state.nodes.length; n++) {
    if (levels[n] == null) levels[n] = maxLevel;
    if (levels[n] > maxLevel) maxLevel = levels[n];
  }
  var byLevel = {};
  for (var k = 0; k < state.nodes.length; k++) {
    var level = levels[k];
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(k);
  }
  var pad = 30;
  var nodeW = Math.min(64, Math.max(30, (w - pad * 2) / 6));
  var nodeH = Math.min(36, Math.max(22, nodeW * 0.62));
  var levelHeight = maxLevel > 0 ? (h - pad * 2 - nodeH) / maxLevel : 0;
  for (var l = 0; l <= maxLevel; l++) {
    var nodes = byLevel[l] || [];
    for (var index = 0; index < nodes.length; index++) {
      var count = Math.max(nodes.length, 1);
      var span = w - pad * 2 - nodeW;
      var cx = count === 1 ? w / 2 : pad + nodeW / 2 + (span * index) / (count - 1);
      positions[nodes[index]] = { x: cx - nodeW / 2, y: pad + l * levelHeight, w: nodeW, h: nodeH };
    }
  }
  return positions;
}

function labDrawGraph(state, ctx, w, h, colors, now) {
  if (state.nodes.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var positions = labGraphLayout(state, w, h);
  for (var e = 0; e < state.edges.length; e++) {
    var edge = state.edges[e];
    var from = positions[edge.a];
    var to = positions[edge.b];
    if (!from || !to) continue;
    var edgeColor = colors.borderHover;
    if (edge.role === 'tree' || edge.role === 'path' || edge.role === 'accepted' || edge.role === 'relaxed') edgeColor = colors.green;
    else if (edge.role === 'frontier' || edge.role === 'relax' || edge.role === 'candidate') edgeColor = colors.indigo;
    else if (edge.role === 'cycle') edgeColor = colors.error;
    else if (edge.role === 'reject' || edge.role === 'rejected') edgeColor = colors.border;
    else if (edge.role === 'current') edgeColor = colors.amber;
    var x1 = from.x + from.w / 2;
    var y1 = from.y + from.h;
    var x2 = to.x + to.w / 2;
    var y2 = to.y;
    labArrow(ctx, x1, y1, x2, y2, edgeColor);
    if (edge.w != null) {
      ctx.fillStyle = edgeColor === colors.border ? colors.low : edgeColor;
      ctx.font = '600 10px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(edge.w), (x1 + x2) / 2 + 6, (y1 + y2) / 2);
    }
  }
  var pulse = labAnim(state, 'pulse', now);
  for (var i = 0; i < state.nodes.length; i++) {
    var pos = positions[i];
    if (!pos) continue;
    var role = state.roles[i];
    var fill = colors.panel2;
    var border = colors.vizStroke;
    if (state.visited[i]) fill = colors.indigoSoft;
    if (role === 'cursor') { border = colors.indigo; }
    if (role === 'start') { border = colors.green; fill = colors.greenSoft; }
    if (role === 'target') { border = colors.amber; }
    if (role === 'found') { fill = colors.green; border = colors.green; }
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = role ? 2 : 1;
    labRoundRect(ctx, pos.x, pos.y, pos.w, pos.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.hi;
    var label = state.nodes[i].v == null ? String(i) : String(state.nodes[i].v);
    labFitText(ctx, label, pos.w - 8, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pos.x + pos.w / 2, pos.y + pos.h / 2);
    if (role === 'cursor' || role === 'found' || role === 'start' || role === 'target') {
      ctx.fillStyle = labRoleColor(colors, role);
      ctx.font = '600 10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(role, pos.x + pos.w / 2, pos.y - 3);
    }
    if (pulse && pulse.anim.id === i) {
      ctx.globalAlpha = (1 - pulse.raw) * 0.9;
      ctx.strokeStyle = labRoleColor(colors, role || 'cursor');
      ctx.lineWidth = 3;
      labRoundRect(ctx, pos.x - 4 - pulse.raw * 6, pos.y - 4 - pulse.raw * 6, pos.w + 8 + pulse.raw * 12, pos.h + 8 + pulse.raw * 12, 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// tree (recursion tree)
// ---------------------------------------------------------------------------

function labTreeLayout(state, w, h) {
  var positions = {};
  var children = {};
  var roots = [];
  for (var i = 0; i < state.order.length; i++) {
    var id = state.order[i];
    var node = state.nodes[id];
    if (!node) continue;
    if (node.parent == null || node.parent < 0 || !state.nodes[node.parent]) {
      roots.push(id);
    } else {
      if (!children[node.parent]) children[node.parent] = [];
      children[node.parent].push(id);
    }
  }
  var depths = {};
  var order = [];
  function walk(id, depth) {
    var kids = children[id] || [];
    // In-order: first child's subtree, this node, then the rest. This keeps
    // left-to-right x positions monotonic (BST in-order comes out sorted).
    if (kids.length > 0) walk(kids[0], depth + 1);
    depths[id] = depth;
    order.push(id);
    for (var k = 1; k < kids.length; k++) walk(kids[k], depth + 1);
  }
  for (var r = 0; r < roots.length; r++) walk(roots[r], 0);
  var maxDepth = 0;
  for (var key in depths) if (depths[key] > maxDepth) maxDepth = depths[key];
  var pad = 26;
  var nodeR = Math.min(22, Math.max(10, (w - pad * 2) / (order.length * 2.4)));
  var levelHeight = maxDepth > 0 ? (h - pad * 2 - nodeR * 2) / maxDepth : 0;
  var span = w - pad * 2 - nodeR * 2;
  for (var index = 0; index < order.length; index++) {
    var nodeId = order[index];
    var x = order.length === 1 ? w / 2 : pad + nodeR + (span * index) / (order.length - 1);
    positions[nodeId] = { x: x, y: pad + nodeR + depths[nodeId] * levelHeight, r: nodeR };
  }
  return positions;
}

function labDrawTree(state, ctx, w, h, colors, now) {
  if (state.order.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var positions = labTreeLayout(state, w, h);
  var pulse = labAnim(state, 'pulse', now);
  var enter = labAnim(state, 'enter', now);
  for (var i = 0; i < state.order.length; i++) {
    var id = state.order[i];
    var node = state.nodes[id];
    var pos = positions[id];
    if (!node || !pos) continue;
    var parentPos = node.parent >= 0 ? positions[node.parent] : null;
    if (parentPos) {
      ctx.strokeStyle = colors.vizStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(parentPos.x, parentPos.y + parentPos.r);
      ctx.lineTo(pos.x, pos.y - pos.r);
      ctx.stroke();
    }
  }
  for (var k = 0; k < state.order.length; k++) {
    var nodeId = state.order[k];
    var nodeData = state.nodes[nodeId];
    var p = positions[nodeId];
    if (!nodeData || !p) continue;
    var role = state.roles[nodeId];
    var fill = colors.panel2;
    var border = colors.border;
    var textColor = colors.hi;
    if (role === 'move') { fill = colors.indigoSoft; border = colors.indigo; }
    if (state.current === nodeId) { border = colors.amber; }
    var scale = 1;
    if (enter && enter.anim.id === nodeId) scale = 0.6 + enter.t * 0.4;
    ctx.globalAlpha = (enter && enter.anim.id === nodeId) ? enter.t : 1;
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = (role || state.current === nodeId) ? 2 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = textColor;
    var label = nodeData.label != null ? nodeData.label : String(nodeData.v);
    labFitText(ctx, label, p.r * 1.8, Math.min(13, p.r));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y);
    if (role === 'move' && nodeData.from > 0) {
      ctx.fillStyle = colors.indigo;
      ctx.font = '600 9px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(nodeData.from + '\u2192' + nodeData.to, p.x, p.y + p.r + 2);
    }
    if (pulse && pulse.anim.id === nodeId) {
      labPulseRing(ctx, p.x, p.y, p.r, pulse, labRoleColor(colors, role || 'cursor'));
    }
  }
}

// ---------------------------------------------------------------------------
// matrix (growable table)
// ---------------------------------------------------------------------------

function labDrawMatrix(state, ctx, w, h, colors, now) {
  if (state.rows === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var cols = Math.max(state.cols, 1);
  var rows = Math.max(state.rows, 1);
  var pad = 18;
  var topSpace = state.labels.length ? 18 : 0;
  var rowLabelSpace = state.rowLabels.length ? 58 : 0;
  var cellW = Math.min(110, Math.max(14, (w - pad * 2 - rowLabelSpace) / cols));
  var cellH = Math.min(40, Math.max(12, (h - pad * 2 - topSpace) / rows));
  var totalW = cellW * cols;
  var ox = pad + rowLabelSpace + Math.max(0, (w - pad * 2 - rowLabelSpace - totalW) / 2);
  var oy = (h - (cellH * rows + topSpace)) / 2 + topSpace;
  var currentAnim = labAnim(state, 'current', now);

  for (var c = 0; c < cols; c++) {
    if (state.labels[c]) {
      ctx.fillStyle = colors.mid;
      ctx.font = '600 11px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(state.labels[c], ox + c * cellW + cellW / 2, oy - 4);
    }
  }
  for (var r = 0; r < rows; r++) {
    if (state.rowLabels[r]) {
      ctx.fillStyle = colors.mid;
      ctx.font = '600 11px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.rowLabels[r], ox - 8, oy + r * cellH + cellH / 2);
    }
    for (var col = 0; col < cols; col++) {
      var key = r + ',' + col;
      var x = ox + col * cellW;
      var y = oy + r * cellH;
      var role = state.roles[key];
      var hasValue = state.cells[key] != null;
      var fill = colors.panel2;
      var border = colors.vizStroke;
      var textColor = colors.hi;
      if (hasValue) fill = colors.panel3;
      if (role === 'current') { border = colors.amber; fill = colors.amber; textColor = colors.void; }
      if (role === 'path' || role === 'found') { border = colors.green; fill = colors.green; textColor = colors.void; }
      ctx.fillStyle = fill;
      ctx.strokeStyle = border;
      ctx.lineWidth = role ? 2 : 1;
      ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      if (hasValue) {
        ctx.fillStyle = textColor;
        labFitText(ctx, String(state.cells[key]), cellW - 6, Math.min(13, cellH * 0.5));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(state.cells[key]), x + cellW / 2, y + cellH / 2);
      }
      if (currentAnim && state.current && state.current[0] === r && state.current[1] === col && (role === 'current' || hasValue)) {
        ctx.globalAlpha = (1 - currentAnim.raw) * 0.8;
        ctx.strokeStyle = colors.amber;
        ctx.lineWidth = 3;
        labRoundRect(ctx, x - 2 - currentAnim.raw * 4, y - 2 - currentAnim.raw * 4, cellW + 4 + currentAnim.raw * 8, cellH + 4 + currentAnim.raw * 8, 6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// stack / call stack
// ---------------------------------------------------------------------------

function labDrawStack(state, ctx, w, h, colors, now) {
  if (state.frames.length === 0 && !state.exiting) {
    ctx.fillStyle = colors.low;
    ctx.font = '13px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.lastPopped == null ? 'The stack is empty.' : 'The stack is empty. Last popped value: ' + state.lastPopped + '.', w / 2, h / 2);
    return;
  }
  var pad = 16;
  var frameH = Math.min(44, Math.max(20, (h - pad * 2) / Math.max(state.frames.length, 1) - 6));
  var frameW = Math.min(200, w - pad * 2);
  var x = (w - frameW) / 2;
  var gap = 6;
  var totalH = state.frames.length * frameH + Math.max(0, state.frames.length - 1) * gap;
  var bottom = Math.min(h - pad, (h + totalH) / 2);
  var enter = labAnim(state, 'enter', now);
  var exit = labAnim(state, 'exit', now);

  if (state.exiting && exit) {
    var exitY = bottom - (state.frames.length + 1) * frameH - state.frames.length * gap - (1 - exit.raw) * 18;
    ctx.globalAlpha = 1 - exit.raw;
    ctx.strokeStyle = colors.amber;
    ctx.lineWidth = 2;
    labRoundRect(ctx, x, exitY, frameW, frameH, 5);
    ctx.stroke();
    ctx.fillStyle = colors.amber;
    labFitText(ctx, state.exiting.label, frameW - 12, Math.min(14, frameH * 0.5));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.exiting.label, x + frameW / 2, exitY + frameH / 2);
    ctx.globalAlpha = 1;
  }

  for (var i = 0; i < state.frames.length; i++) {
    var frame = state.frames[i];
    var y = bottom - (i + 1) * frameH - i * gap;
    var isTop = i === state.frames.length - 1;
    var entering = enter && isTop;
    var offset = entering ? (1 - enter.t) * -14 : 0;
    ctx.globalAlpha = entering ? enter.t : 1;
    ctx.fillStyle = isTop ? colors.indigoSoft : colors.panel2;
    ctx.strokeStyle = isTop ? colors.indigo : colors.vizStroke;
    ctx.lineWidth = isTop ? 2 : 1;
    labRoundRect(ctx, x, y + offset, frameW, frameH, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.hi;
    labFitText(ctx, frame.label, frameW - 12, Math.min(14, frameH * 0.5));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frame.label, x + frameW / 2, y + frameH / 2 + offset);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = colors.mid;
  ctx.font = '600 10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('top of stack', w / 2, bottom + 4);
}

// ---------------------------------------------------------------------------
// timeline
// ---------------------------------------------------------------------------

function labDrawTimeline(state, ctx, w, h, colors, now) {
  if (state.points.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var pad = 22;
  var left = pad + 26;
  var right = w - pad;
  var top = pad;
  var bottom = h - pad;
  var max = Math.max(1, state.peak);
  var n = state.points.length;

  ctx.strokeStyle = colors.borderSoft;
  ctx.fillStyle = colors.low;
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (var grid = 0; grid <= 4; grid++) {
    var value = Math.round((max * grid) / 4);
    var y = bottom - ((bottom - top) * grid) / 4;
    ctx.beginPath();
    ctx.moveTo(left, y + 0.5);
    ctx.lineTo(right, y + 0.5);
    ctx.stroke();
    ctx.fillText(String(value), left - 6, y);
  }

  function xFor(index) { return n === 1 ? (left + right) / 2 : left + ((right - left) * index) / (n - 1); }
  function yFor(point) { return bottom - ((bottom - top) * point) / max; }

  var pointAnim = labAnim(state, 'point', now);
  var drawn = n;
  var tipX = n > 0 ? xFor(n - 1) : left;
  var tipY = n > 0 ? yFor(state.points[n - 1]) : bottom;
  if (pointAnim && n >= 2) {
    var previousX = xFor(n - 2);
    var previousY = yFor(state.points[n - 2]);
    var currentX = xFor(n - 1);
    var currentY = yFor(state.points[n - 1]);
    tipX = labLerp(previousX, currentX, pointAnim.t);
    tipY = labLerp(previousY, currentY, pointAnim.t);
    drawn = n - 1;
  }

  ctx.strokeStyle = colors.indigo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var i = 0; i < drawn; i++) {
    var px = xFor(i);
    var py = yFor(state.points[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  if (drawn > 0) ctx.lineTo(tipX, tipY);
  ctx.stroke();

  function drawDot(index, x, y, color, radius) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (var dot = 0; dot < n - (pointAnim ? 1 : 0); dot++) {
    if (state.points[dot] === state.peak) drawDot(dot, xFor(dot), yFor(state.points[dot]), colors.amber, 4);
    else drawDot(dot, xFor(dot), yFor(state.points[dot]), colors.borderHover, 2);
  }
  if (pointAnim) drawDot(n - 1, tipX, tipY, colors.indigo, 2 + pointAnim.raw * 2);
  else if (n > 0) drawDot(n - 1, xFor(n - 1), yFor(state.points[n - 1]), colors.indigo, 4);

  ctx.fillStyle = colors.hi;
  ctx.font = '600 12px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(String(state.points[n - 1]), Math.min(tipX + 8, right - 30), tipY - 6);
  ctx.fillStyle = colors.mid;
  ctx.font = '10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('step ' + (n - 1), left, bottom + 6);
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

var LAB_VIZ_DRAWERS = {
  bars: labDrawBars,
  cells: labDrawCells,
  grid: labDrawGrid,
  graph: labDrawGraph,
  tree: labDrawTree,
  matrix: labDrawMatrix,
  stack: labDrawStack,
  timeline: labDrawTimeline,
};

/**
 * @param {{type: string}} view
 * @param {{motion?: boolean, now?: function}} options motion disabled under
 *   prefers-reduced-motion: transitions jump straight to their end state.
 */
function labVizCreate(view, options) {
  var opts = options || {};
  var renderer = {
    view: view || { type: 'bars' },
    motionEnabled: opts.motion !== false,
    now: opts.now || labVizNow,
    state: labVizInitial(view),
    draw: function (ctx, w, h, colors, now) {
      var type = renderer.view.type || 'bars';
      if (type === 'cells' && renderer.view.queue) renderer.state.queue = true;
      (LAB_VIZ_DRAWERS[type] || LAB_VIZ_DRAWERS.bars)(renderer.state, ctx, w, h, colors, typeof now === 'number' ? now : renderer.now());
    },
    isAnimating: function (now) {
      var stamp = typeof now === 'number' ? now : renderer.now();
      return renderer.motionEnabled && labVizIsAnimating(renderer.state, stamp);
    },
    reset: function () {
      renderer.state = labVizInitial(renderer.view);
      if (renderer.view.type === 'cells' && renderer.view.queue) renderer.state.queue = true;
    },
  };
  return renderer;
}

function labVizApply(renderer, event) {
  labApplyEvent(renderer.view.type || 'bars', renderer.state, event, { enabled: renderer.motionEnabled, now: renderer.now });
}

var LAB_VIZ_DESCRIBE_KEYS = ['i', 'j', 'r', 'c', 'id', 'a', 'b', 'v', 'role', 'fn', 'n', 'from', 'to', 'result', 'peak'];

function labVizDescribe(event) {
  if (!event) return '';
  var fields = event.fields || {};
  var bits = [];
  for (var i = 0; i < LAB_VIZ_DESCRIBE_KEYS.length; i++) {
    var key = LAB_VIZ_DESCRIBE_KEYS[i];
    if (typeof fields[key] === 'string') bits.push(key + '=' + fields[key]);
  }
  return event.event + (bits.length ? ' (' + bits.join(', ') + ')' : '');
}

var LabViz = { create: labVizCreate, apply: labVizApply, describe: labVizDescribe };

function labVizSupportedTypes() {
  return Object.keys(LAB_VIZ_DRAWERS);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    labVizCreate: labVizCreate,
    labVizApply: labVizApply,
    labVizDescribe: labVizDescribe,
    labVizInitial: labVizInitial,
    labApplyEvent: labApplyEvent,
    labVizSupportedTypes: labVizSupportedTypes,
    labVizIsAnimating: labVizIsAnimating,
  };
}
if (typeof window !== 'undefined') {
  window.LabViz = LabViz;
}
