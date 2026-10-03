// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Algorithm Lab player state machine. Pure logic, no DOM: the browser drives
// it from requestAnimationFrame, tools/test-server.js drives it with a fake
// clock. Playback advances by steps-per-second; compare mode runs two players
// from one clock so synchronization is by rate, not index.
'use strict';

var LAB_PLAYER_MIN_SPEED = 1;
var LAB_PLAYER_MAX_SPEED = 64;
var LAB_PLAYER_MAX_TICK_STEPS = 400;

/**
 * @param {{events?: Array, stepsPerSecond?: number, now?: function}} options
 */
function createLabPlayer(options) {
  var opts = options || {};
  var now = opts.now || function () { return Date.now(); };

  var events = [];
  var total = 0;
  var index = 0;
  var status = 'idle'; // idle | ready | playing | paused | done
  var speed = labClampSpeed(opts.stepsPerSecond || 8);
  var lastTs = 0;
  var listeners = [];

  // Prefix counters so per-pane numbers are O(1) at any index.
  var stepCount = [0];
  var compareCount = [0];
  var swapCount = [0];

  function labClampSpeed(value) {
    var n = Math.round(Number(value));
    if (!isFinite(n) || n < LAB_PLAYER_MIN_SPEED) return LAB_PLAYER_MIN_SPEED;
    if (n > LAB_PLAYER_MAX_SPEED) return LAB_PLAYER_MAX_SPEED;
    return n;
  }

  function rebuildPrefixes() {
    stepCount = new Array(total + 1);
    compareCount = new Array(total + 1);
    swapCount = new Array(total + 1);
    stepCount[0] = 0;
    compareCount[0] = 0;
    swapCount[0] = 0;
    for (var i = 0; i < total; i++) {
      stepCount[i + 1] = i + 1;
      compareCount[i + 1] = compareCount[i] + (events[i].event === 'compare' ? 1 : 0);
      swapCount[i + 1] = swapCount[i] + (events[i].event === 'swap' ? 1 : 0);
    }
  }

  function countersAt(i) {
    return { steps: i, compares: compareCount[i], swaps: swapCount[i] };
  }

  function state() {
    return {
      status: status,
      index: index,
      total: total,
      speed: speed,
      counters: countersAt(index),
      event: index > 0 ? events[index - 1] : null,
      nextEvent: index < total ? events[index] : null,
      currentStep: index > 0 ? events[index - 1].step : (total > 0 ? events[0].step : null),
    };
  }

  function notify() {
    var snapshot = state();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](snapshot); } catch (err) { /* listener errors must not break the player */ }
    }
  }

  function load(newEvents) {
    events = Array.isArray(newEvents) ? newEvents.slice() : [];
    total = events.length;
    index = 0;
    status = total > 0 ? 'ready' : 'idle';
    rebuildPrefixes();
    notify();
  }

  function play() {
    if (total === 0) return false;
    if (index >= total) return false;
    if (status !== 'playing') {
      status = 'playing';
      // The next tick adopts its clock. Callers may pass requestAnimationFrame
      // timestamps or Date.now(); mixing them mid-flight would corrupt deltas.
      lastTs = null;
      notify();
    }
    return true;
  }

  function pause() {
    if (status !== 'playing') return false;
    status = 'paused';
    notify();
    return true;
  }

  function toggle() {
    if (status === 'playing') return pause();
    return play();
  }

  function advance(steps) {
    index += steps;
    if (index >= total) {
      index = total;
      status = 'done';
    }
    notify();
  }

  function stepForward() {
    if (index >= total) return false;
    if (status === 'playing') status = 'paused';
    index += 1;
    if (index >= total) status = 'done';
    notify();
    return true;
  }

  function stepBack() {
    if (index <= 0) return false;
    if (status === 'playing' || status === 'done') status = 'paused';
    index -= 1;
    notify();
    return true;
  }

  function seek(target) {
    var i = Math.round(Number(target));
    if (!isFinite(i)) return false;
    if (i < 0) i = 0;
    if (i > total) i = total;
    index = i;
    if (index >= total && total > 0) status = 'done';
    else if (status === 'done') status = 'paused';
    notify();
    return true;
  }

  function reset() {
    index = 0;
    status = total > 0 ? 'ready' : 'idle';
    notify();
  }

  function setSpeed(value) {
    speed = labClampSpeed(value);
    notify();
    return speed;
  }

  /** Advance from wall-clock time. Returns the number of steps applied. */
  function tick(ts) {
    if (status !== 'playing') return 0;
    var stamp = typeof ts === 'number' ? ts : now();
    if (lastTs == null) {
      lastTs = stamp;
      return 0;
    }
    var delta = stamp - lastTs;
    if (delta < 0) {
      lastTs = stamp;
      return 0;
    }
    var steps = Math.floor(delta * speed / 1000);
    if (steps < 1) return 0; // keep the partial time for the next tick
    if (steps > LAB_PLAYER_MAX_TICK_STEPS) steps = LAB_PLAYER_MAX_TICK_STEPS;
    // Consume only the time the applied steps represent, so slow speeds are
    // accurate and fast speeds do not overshoot.
    lastTs = lastTs + (steps * 1000) / speed;
    advance(steps);
    if (status === 'done') lastTs = stamp;
    return steps;
  }

  function onUpdate(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      var at = listeners.indexOf(listener);
      if (at >= 0) listeners.splice(at, 1);
    };
  }

  return {
    load: load,
    play: play,
    pause: pause,
    toggle: toggle,
    stepForward: stepForward,
    stepBack: stepBack,
    seek: seek,
    reset: reset,
    setSpeed: setSpeed,
    tick: tick,
    onUpdate: onUpdate,
    getState: state,
    getEvents: function () { return events; },
    countersAt: countersAt,
  };
}

var LabPlayer = { create: createLabPlayer };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createLabPlayer: createLabPlayer };
}
if (typeof window !== 'undefined') {
  window.LabPlayer = LabPlayer;
}
