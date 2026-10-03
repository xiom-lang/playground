// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Algorithm Lab drawing primitives: bars, cells, grid, graph, tree, matrix,
// stack, timeline. Each renderer applies protocol v1 events to a small state
// object and draws that state on a canvas. No DOM beyond the canvas, no
// HTML interpolation, ES5 only.
'use strict';

var LAB_VIZ_MAX_CELLS = 400;

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
  if (type === 'bars') return { values: [], roles: {}, compare: [], flash: [], peak: 1 };
  if (type === 'cells') return { values: [], roles: {}, visited: {}, compare: [], queue: Boolean(view.queue), pending: [], answer: null };
  if (type === 'grid') return { rows: 0, cols: 0, walls: {}, labels: [], visited: {}, frontier: {}, path: {}, roles: {}, cursor: null, done: false };
  if (type === 'graph') return { nodes: [], edges: [], roles: {}, visited: {}, cursor: null, done: false };
  if (type === 'tree') return { nodes: {}, order: [], roles: {}, current: null, done: false };
  if (type === 'matrix') return { rows: 0, cols: 0, labels: [], cells: {}, roles: {}, current: null, done: false };
  if (type === 'stack') return { frames: [], lastPopped: null, done: false };
  if (type === 'timeline') return { points: [], peak: 1, result: null, done: false };
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

function labApplyEvent(type, state, event) {
  var fields = event.fields || {};
  var name = event.event;

  if (type === 'bars') {
    if (name === 'init') {
      state.values = labList(fields, 'vals');
      state.peak = 1;
      for (var i = 0; i < state.values.length; i++) if (state.values[i] > state.peak) state.peak = state.values[i];
    } else if (name === 'compare') {
      state.compare = [labNum(fields, 'i', -1), labNum(fields, 'j', -1)];
    } else if (name === 'swap') {
      var a = labNum(fields, 'i', -1);
      var b = labNum(fields, 'j', -1);
      if (a >= 0 && b >= 0 && a < state.values.length && b < state.values.length) {
        var tmp = state.values[a];
        state.values[a] = state.values[b];
        state.values[b] = tmp;
      }
      state.flash = [a, b];
    } else if (name === 'set') {
      var at = labNum(fields, 'i', -1);
      if (at >= 0 && at < state.values.length) state.values[at] = labNum(fields, 'v', 0);
      state.flash = [at, -1];
    } else if (name === 'mark') {
      var roleIndex = labNum(fields, 'i', -1);
      if (roleIndex >= 0) state.roles[roleIndex] = fields.role || 'mark';
    }
  } else if (type === 'cells') {
    if (name === 'init') {
      state.values = labList(fields, 'vals');
      state.queue = state.queue || fields.queue === '1';
    } else if (name === 'compare') {
      if (typeof fields.i === 'string') state.compare = [labNum(fields, 'i', -1), labNum(fields, 'j', -1)];
      else state.compare = [state.roles.__cursor != null ? state.roles.__cursor : -1, -1];
    } else if (name === 'mark') {
      var markIndex = labNum(fields, 'i', -1);
      if (markIndex >= 0) state.roles[markIndex] = fields.role || 'mark';
      if (fields.role === 'cursor') state.roles.__cursor = markIndex;
      if (fields.role === 'found') state.answer = markIndex;
    } else if (name === 'visit') {
      var visitIndex = labNum(fields, 'i', -1);
      if (visitIndex >= 0) state.visited[visitIndex] = true;
    } else if (name === 'set') {
      var setIndex = labNum(fields, 'i', -1);
      if (setIndex >= 0 && setIndex < state.values.length) state.values[setIndex] = labNum(fields, 'v', 0);
    } else if (name === 'enqueue') {
      state.pending.push(labNum(fields, 'v', 0));
    } else if (name === 'dequeue') {
      if (state.pending.length > 0) state.pending.shift();
    }
  } else if (type === 'grid') {
    if (name === 'init') {
      state.rows = labNum(fields, 'rows', 0);
      state.cols = labNum(fields, 'cols', 0);
      state.labels = labList(fields, 'vals');
      var walls = labCoordList(fields, 'walls');
      for (var w = 0; w < walls.length; w++) state.walls[walls[w][0] + ',' + walls[w][1]] = true;
    } else if (name === 'visit') {
      state.cursor = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
      state.visited[state.cursor[0] + ',' + state.cursor[1]] = true;
    } else if (name === 'frontier') {
      state.frontier[labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0)] = true;
    } else if (name === 'path') {
      state.path[labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0)] = true;
    } else if (name === 'mark') {
      var key = labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0);
      state.roles[key] = fields.role || 'mark';
    } else if (name === 'set') {
      state.cursor = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
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
      }
    } else if (name === 'mark') {
      var markedId = labNum(fields, 'id', -1);
      if (markedId >= 0) state.roles[markedId] = fields.role || 'mark';
      if (fields.role === 'cursor') state.cursor = markedId;
    } else if (name === 'edge') {
      state.edges.push({ a: labNum(fields, 'a', 0), b: labNum(fields, 'b', 0) });
    }
  } else if (type === 'tree') {
    if (name === 'node') {
      var id = labNum(fields, 'id', -1);
      if (id >= 0) {
        state.nodes[id] = {
          id: id,
          parent: labNum(fields, 'parent', -1),
          v: labNum(fields, 'v', 0),
          from: labNum(fields, 'from', -1),
          to: labNum(fields, 'to', -1),
        };
        state.order.push(id);
      }
    } else if (name === 'mark') {
      var markId = labNum(fields, 'id', -1);
      if (markId >= 0) state.roles[markId] = fields.role || 'mark';
      state.current = markId;
    } else if (name === 'visit') {
      state.current = labNum(fields, 'id', -1);
    }
  } else if (type === 'matrix') {
    if (name === 'init') {
      state.rows = labNum(fields, 'rows', 0);
      state.cols = labNum(fields, 'cols', 0);
      state.labels = [];
      if (typeof fields.labels === 'string' && fields.labels) state.labels = fields.labels.split(',');
    } else if (name === 'set') {
      var row = labNum(fields, 'r', 0);
      var col = labNum(fields, 'c', 0);
      state.cells[row + ',' + col] = labNum(fields, 'v', 0);
      if (row + 1 > state.rows) state.rows = row + 1;
      if (col + 1 > state.cols) state.cols = col + 1;
      state.current = [row, col];
    } else if (name === 'mark') {
      state.roles[labNum(fields, 'r', 0) + ',' + labNum(fields, 'c', 0)] = fields.role || 'mark';
      state.current = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
    } else if (name === 'visit') {
      state.current = [labNum(fields, 'r', 0), labNum(fields, 'c', 0)];
    }
  } else if (type === 'stack') {
    if (name === 'push') {
      state.frames.push({ label: String(labNum(fields, 'v', 0)), role: 'value' });
      state.lastPopped = null;
    } else if (name === 'pop') {
      if (state.frames.length > 0) state.frames.pop();
      state.lastPopped = labNum(fields, 'v', 0);
    } else if (name === 'call') {
      state.frames.push({ label: (fields.fn || 'fn') + '(' + labNum(fields, 'n', 0) + ')', role: 'call' });
      state.lastPopped = null;
    } else if (name === 'ret') {
      if (state.frames.length > 0) state.frames.pop();
      state.lastPopped = labNum(fields, 'v', 0);
    }
  } else if (type === 'timeline') {
    if (name === 'point') {
      var point = labNum(fields, 'v', 0);
      state.points.push(point);
      if (point > state.peak) state.peak = point;
    } else if (name === 'mark') {
      var peak = labNum(fields, 'v', 0);
      if (peak > state.peak) state.peak = peak;
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
    if (type === 'bars') { state.compare = []; state.flash = []; }
    if (type === 'cells') state.compare = [];
  }
}

function labEdgeList(fields) {
  if (!fields || typeof fields.edges !== 'string' || fields.edges === '') return [];
  var parts = fields.edges.split(',');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var pair = parts[i].split('-');
    if (pair.length !== 2 || !/^\d{1,4}$/.test(pair[0]) || !/^\d{1,4}$/.test(pair[1])) continue;
    out.push({ a: parseInt(pair[0], 10), b: parseInt(pair[1], 10) });
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

// ---------------------------------------------------------------------------
// bars
// ---------------------------------------------------------------------------

function labDrawBars(state, ctx, w, h, colors) {
  if (state.values.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var pad = 14;
  var labelSpace = 20;
  var available = w - pad * 2;
  var baseline = h - pad - labelSpace;
  var barWidth = Math.min(54, Math.max(6, available / state.values.length - 6));
  var gap = Math.max(2, (available - barWidth * state.values.length) / Math.max(1, state.values.length - 1));
  var totalWidth = barWidth * state.values.length + gap * (state.values.length - 1);
  var startX = (w - totalWidth) / 2;

  for (var i = 0; i < state.values.length; i++) {
    var value = state.values[i];
    var barHeight = Math.max(4, (value / Math.max(1, state.peak)) * (baseline - pad - 24));
    var x = startX + i * (barWidth + gap);
    var y = baseline - barHeight;
    var color = colors.panel3;
    var border = colors.border;
    if (state.compare.indexOf(i) >= 0) { color = colors.amber; border = colors.amber; }
    if (state.flash.indexOf(i) >= 0) { color = colors.indigo; border = colors.indigo; }
    if (state.roles[i]) { color = labRoleColor(colors, state.roles[i]); border = color; }
    ctx.fillStyle = color;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    labRoundRect(ctx, x, y, barWidth, barHeight, 4);
    ctx.fill();
    if (state.compare.indexOf(i) >= 0 || state.flash.indexOf(i) >= 0 || state.roles[i]) ctx.stroke();
    ctx.fillStyle = colors.hi;
    var text = String(value);
    labFitText(ctx, text, barWidth + 6, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, x + barWidth / 2, y - 4);
    ctx.fillStyle = colors.low;
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(String(i), x + barWidth / 2, baseline + 4);
  }
  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(pad, baseline + 0.5);
  ctx.lineTo(w - pad, baseline + 0.5);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// cells (search pointers, queue)
// ---------------------------------------------------------------------------

function labDrawCells(state, ctx, w, h, colors) {
  if (state.queue) {
    labDrawQueue(state, ctx, w, h, colors);
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

  var cursor = state.roles.__cursor != null ? state.roles.__cursor : -1;
  for (var i = 0; i < n; i++) {
    var x = startX + i * (cellWidth + gap);
    var fill = colors.panel2;
    var border = colors.border;
    var role = state.roles[i];
    if (state.visited[i]) fill = colors.indigoSoft;
    if (state.compare.indexOf(i) >= 0) { border = colors.amber; fill = colors.amber; }
    if (role === 'target') border = colors.amber;
    if (role === 'found') { fill = colors.green; border = colors.green; }
    if (role === 'lo' || role === 'hi') { border = colors.indigo; }
    if (role === 'mid') { border = colors.amber; }
    if (cursor === i) { border = colors.indigo; }
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = state.compare.indexOf(i) >= 0 || cursor === i || role ? 2 : 1;
    labRoundRect(ctx, x, top, cellWidth, cellWidth, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.hi;
    var label = String(state.values[i]);
    labFitText(ctx, label, cellWidth - 8, 13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + cellWidth / 2, top + cellWidth / 2);

    var pointers = [];
    if (role === 'lo') pointers.push('lo');
    if (role === 'mid') pointers.push('mid');
    if (role === 'hi') pointers.push('hi');
    if (cursor === i && pointers.length === 0) pointers.push('cursor');
    if (role === 'target') pointers.push('target');
    if (role === 'found') pointers.push('found');
    if (pointers.length > 0) {
      ctx.fillStyle = labRoleColor(colors, pointers[0]);
      ctx.font = '600 10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(pointers.join(' '), x + cellWidth / 2, top - 4);
    }
  }
}

function labDrawQueue(state, ctx, w, h, colors) {
  var pad = 24;
  var n = Math.max(state.pending.length, 1);
  var cellWidth = Math.min(56, Math.max(26, (w - pad * 2) / 8 - 8));
  var gap = 8;
  var top = h / 2 - cellWidth / 2;
  if (state.pending.length === 0) {
    ctx.fillStyle = colors.low;
    ctx.font = '13px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Queue is empty. Enqueue events will appear here.', w / 2, h / 2);
    return;
  }
  var startX = pad;
  for (var i = 0; i < state.pending.length; i++) {
    var x = startX + i * (cellWidth + gap);
    if (x + cellWidth > w - pad) break;
    var isHead = i === 0;
    ctx.fillStyle = isHead ? colors.greenSoft : colors.panel2;
    ctx.strokeStyle = isHead ? colors.green : colors.border;
    ctx.lineWidth = isHead ? 2 : 1;
    labRoundRect(ctx, x, top, cellWidth, cellWidth, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.hi;
    ctx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(state.pending[i]), x + cellWidth / 2, top + cellWidth / 2);
    ctx.fillStyle = isHead ? colors.green : colors.mid;
    ctx.font = '600 10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(isHead ? 'front' : (i === state.pending.length - 1 ? 'back' : ''), x + cellWidth / 2, top - 4);
  }
}

// ---------------------------------------------------------------------------
// grid
// ---------------------------------------------------------------------------

function labDrawGrid(state, ctx, w, h, colors) {
  if (state.rows === 0 || state.cols === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var pad = 12;
  var cell = Math.max(8, Math.min((w - pad * 2) / state.cols, (h - pad * 2) / state.rows));
  var gridW = cell * state.cols;
  var gridH = cell * state.rows;
  var ox = (w - gridW) / 2;
  var oy = (h - gridH) / 2;

  for (var r = 0; r < state.rows; r++) {
    for (var c = 0; c < state.cols; c++) {
      var key = r + ',' + c;
      var x = ox + c * cell;
      var y = oy + r * cell;
      var fill = colors.panel2;
      var border = colors.borderSoft;
      var textColor = colors.mid;
      if (state.walls[key]) { fill = colors.panel3; border = colors.border; textColor = colors.low; }
      if (state.frontier[key]) { fill = colors.indigoSoft; border = colors.indigo; }
      if (state.visited[key]) { fill = colors.panel3; border = colors.borderSoft; }
      if (state.path[key]) { fill = colors.greenSoft; border = colors.green; }
      var role = state.roles[key];
      if (role === 'prime') { border = colors.green; fill = colors.greenSoft; }
      if (role === 'composite') { border = colors.border; textColor = colors.low; }
      if (state.cursor && state.cursor[0] === r && state.cursor[1] === c) { border = colors.amber; }
      ctx.fillStyle = fill;
      ctx.strokeStyle = border;
      ctx.lineWidth = (border === colors.amber || border === colors.indigo || border === colors.green) ? 2 : 1;
      ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      if (r * state.cols + c < state.labels.length) {
        var text = String(state.labels[r * state.cols + c]);
        ctx.fillStyle = role === 'composite' ? colors.low : textColor;
        labFitText(ctx, text, cell - 4, Math.min(12, cell * 0.45));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + cell / 2, y + cell / 2);
      }
    }
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

function labDrawGraph(state, ctx, w, h, colors) {
  if (state.nodes.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var positions = labGraphLayout(state, w, h);
  for (var e = 0; e < state.edges.length; e++) {
    var edge = state.edges[e];
    var from = positions[edge.a];
    var to = positions[edge.b];
    if (!from || !to) continue;
    labArrow(ctx, from.x + from.w / 2, from.y + from.h, to.x + to.w / 2, to.y, colors.borderHover);
  }
  for (var i = 0; i < state.nodes.length; i++) {
    var pos = positions[i];
    if (!pos) continue;
    var role = state.roles[i];
    var fill = colors.panel2;
    var border = colors.border;
    if (state.visited[i]) fill = colors.indigoSoft;
    if (role === 'cursor') { border = colors.indigo; }
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
    if (role === 'cursor' || role === 'found') {
      ctx.fillStyle = labRoleColor(colors, role);
      ctx.font = '600 10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(role, pos.x + pos.w / 2, pos.y - 3);
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
  var nextX = 0;
  var order = [];
  function walk(id, depth) {
    var kids = children[id] || [];
    if (kids.length === 0) {
      depths[id] = depth;
      order.push(id);
      return;
    }
    for (var k = 0; k < kids.length; k++) walk(kids[k], depth + 1);
    depths[id] = depth;
    order.push(id);
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
    nextX += 1;
  }
  return positions;
}

function labDrawTree(state, ctx, w, h, colors) {
  if (state.order.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var positions = labTreeLayout(state, w, h);
  for (var i = 0; i < state.order.length; i++) {
    var id = state.order[i];
    var node = state.nodes[id];
    var pos = positions[id];
    if (!node || !pos) continue;
    var parentPos = node.parent >= 0 ? positions[node.parent] : null;
    if (parentPos) {
      ctx.strokeStyle = colors.border;
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
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = (role || state.current === nodeId) ? 2 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = textColor;
    var label = String(nodeData.v);
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
  }
}

// ---------------------------------------------------------------------------
// matrix (growable table)
// ---------------------------------------------------------------------------

function labDrawMatrix(state, ctx, w, h, colors) {
  if (state.rows === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var cols = Math.max(state.cols, 1);
  var rows = Math.max(state.rows, 1);
  var pad = 18;
  var labelSpace = state.labels.length ? 18 : 0;
  var cellW = Math.min(110, (w - pad * 2 - 42) / cols);
  var cellH = Math.min(40, (h - pad * 2 - labelSpace) / rows);
  var totalW = cellW * cols;
  var ox = (w - totalW) / 2;
  var oy = (h - (cellH * rows + labelSpace)) / 2 + labelSpace;

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
    for (var col = 0; col < cols; col++) {
      var key = r + ',' + col;
      var x = ox + col * cellW;
      var y = oy + r * cellH;
      var role = state.roles[key];
      var hasValue = state.cells[key] != null;
      var fill = colors.panel2;
      var border = colors.borderSoft;
      if (hasValue) fill = colors.panel3;
      if (role === 'current') { border = colors.amber; fill = colors.amber; }
      ctx.fillStyle = fill;
      ctx.strokeStyle = border;
      ctx.lineWidth = role === 'current' ? 2 : 1;
      ctx.fillRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      if (hasValue) {
        ctx.fillStyle = role === 'current' ? colors.void : colors.hi;
        ctx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(state.cells[key]), x + cellW / 2, y + cellH / 2);
      }
    }
  }
  ctx.fillStyle = colors.low;
  ctx.font = '10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('each row = one division step', ox, oy + cellH * rows + 6);
}

// ---------------------------------------------------------------------------
// stack / call stack
// ---------------------------------------------------------------------------

function labDrawStack(state, ctx, w, h, colors) {
  if (state.frames.length === 0) {
    ctx.fillStyle = colors.low;
    ctx.font = '13px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.lastPopped == null ? 'The stack is empty.' : 'The stack is empty. Last popped value: ' + state.lastPopped + '.', w / 2, h / 2);
    return;
  }
  var pad = 16;
  var frameH = Math.min(44, Math.max(20, (h - pad * 2) / state.frames.length - 6));
  var frameW = Math.min(200, w - pad * 2);
  var x = (w - frameW) / 2;
  var gap = 6;
  var totalH = state.frames.length * frameH + (state.frames.length - 1) * gap;
  var bottom = Math.min(h - pad, (h + totalH) / 2);
  for (var i = 0; i < state.frames.length; i++) {
    var frame = state.frames[i];
    var y = bottom - (i + 1) * frameH - i * gap;
    var isTop = i === state.frames.length - 1;
    ctx.fillStyle = isTop ? colors.indigoSoft : colors.panel2;
    ctx.strokeStyle = isTop ? colors.indigo : colors.border;
    ctx.lineWidth = isTop ? 2 : 1;
    labRoundRect(ctx, x, y, frameW, frameH, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.hi;
    labFitText(ctx, frame.label, frameW - 12, Math.min(14, frameH * 0.5));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frame.label, x + frameW / 2, y + frameH / 2);
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

function labDrawTimeline(state, ctx, w, h, colors) {
  if (state.points.length === 0) { labEmptyMessage(ctx, w, h, colors); return; }
  var pad = 22;
  var left = pad + 26;
  var right = w - pad;
  var top = pad;
  var bottom = h - pad;
  var max = Math.max(1, state.peak);
  var min = 0;
  var n = state.points.length;

  ctx.strokeStyle = colors.borderSoft;
  ctx.fillStyle = colors.low;
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (var grid = 0; grid <= 4; grid++) {
    var value = Math.round(min + ((max - min) * grid) / 4);
    var y = bottom - ((bottom - top) * grid) / 4;
    ctx.beginPath();
    ctx.moveTo(left, y + 0.5);
    ctx.lineTo(right, y + 0.5);
    ctx.stroke();
    ctx.fillText(String(value), left - 6, y);
  }

  var xFor = function (index) { return n === 1 ? (left + right) / 2 : left + ((right - left) * index) / (n - 1); };
  var yFor = function (value) { return bottom - ((bottom - top) * (value - min)) / (max - min); };

  ctx.strokeStyle = colors.indigo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    var px = xFor(i);
    var py = yFor(state.points[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  var drawDot = function (i, color, radius) {
    var px = xFor(i);
    var py = yFor(state.points[i]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  for (var dot = 0; dot < n; dot++) {
    if (state.points[dot] === state.peak) drawDot(dot, colors.amber, 4);
    else if (dot === n - 1) drawDot(dot, colors.indigo, 4);
    else drawDot(dot, colors.borderHover, 2);
  }
  var last = n - 1;
  ctx.fillStyle = colors.hi;
  ctx.font = '600 12px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(String(state.points[last]), Math.min(xFor(last) + 8, right - 30), yFor(state.points[last]) - 6);
  ctx.fillStyle = colors.mid;
  ctx.font = '10px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('step ' + last, left, bottom + 6);
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

function labVizCreate(view) {
  var renderer = {
    view: view || { type: 'bars' },
    state: labVizInitial(view),
    draw: function (ctx, w, h, colors) {
      var type = renderer.view.type || 'bars';
      if (type === 'cells' && renderer.view.queue) renderer.state.queue = true;
      (LAB_VIZ_DRAWERS[type] || LAB_VIZ_DRAWERS.bars)(renderer.state, ctx, w, h, colors);
    },
    reset: function () {
      renderer.state = labVizInitial(renderer.view);
      if (renderer.view.type === 'cells' && renderer.view.queue) renderer.state.queue = true;
    },
  };
  return renderer;
}

function labVizApply(renderer, event) {
  labApplyEvent(renderer.view.type || 'bars', renderer.state, event);
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
  module.exports = { labVizCreate: labVizCreate, labVizApply: labVizApply, labVizDescribe: labVizDescribe, labVizInitial: labVizInitial, labApplyEvent: labApplyEvent, labVizSupportedTypes: labVizSupportedTypes };
}
if (typeof window !== 'undefined') {
  window.LabViz = LabViz;
}
