// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// "What's new" and "Progress & sync" dialogs (modals live in index.html).
// whatsNew is curated: add one entry at the top whenever a user-visible
// change ships, newest first. Keep items short and about the user.
'use strict';

var XIOM_WHATS_NEW = [
  {
    date: '2026-10-04',
    title: 'Lab on the phone',
    items: [
      'Algorithm Lab on narrow screens now highlights the executing line right in the plain-text editor, and follows it as the trace plays.',
      'Edit the program on your phone and press Run: the visualization rebuilds from your version of the code.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'A gentler Lab pace',
    items: [
      'Algorithm Lab now starts at 4 steps per second (was 8) so first looks are easier to follow; the speed slider goes down to 1.',
      'Smooth in-canvas transitions: bars slide when swapped, search pointers glide, visited cells fade in, and stack frames rise and drop.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Algorithm Lab (2.0)',
    items: [
      'New Algorithm Lab: watch real XIOM programs run step by step - bars swapping, mazes flooding, call stacks growing - with the executing line highlighted in the source.',
      'Compare mode races two algorithms on one shared clock, with per-pane counters for steps, compares and swaps.',
      'Play, step forward/back, scrub and speed control; keyboard shortcuts (Space, arrows, R); works on mobile and respects reduced motion.',
    ],
  },
  {
    date: '2026-10-02',
    title: 'Playground 1.0',
    items: [
      'The playground now has its own version line, shown in the footer: starting at 1.0.0, with 2.0 reserved for the Algorithm Lab.',
      'The app version moves independently of the toolchain pin, so playground fixes no longer wait for a compiler release.',
    ],
  },
  {
    date: '2026-09-30',
    title: 'Faster runs, accurate results',
    items: [
      'Run is up to 3x faster: interactive programs now compile without optimization (unchanged code is still instant).',
      'Fixed three lessons whose "expected result" could show wrong (L6-15, L7-39, L8-09).',
      'The landing page says it straight: sign-in is optional, only for progress sync.',
    ],
  },
  {
    date: '2026-09-29',
    title: 'Offline packages and sandbox labels',
    items: [
      'use xiom.hello; and use xiom.csv; work with no network, plus the full 353-package registry catalog mounted read-only in production.',
      'Reference panel badges now show what the sandbox allows: limited (files in /tmp only, contained processes) and blocked (network).',
      'Sandbox denials read in plain language, for example "the playground sandbox has no network access".',
    ],
  },
  {
    date: '2026-09-28',
    title: 'Every lesson example re-checked',
    items: [
      'Hundreds of in-lesson snippets were recompiled against the pinned toolchain; examples that no longer compiled were fixed (renamed stdlib calls, module syntax, loops).',
      'Direct for x in vector is the standard loop idiom in examples again.',
    ],
  },
];

function renderWhatsNew() {
  var list = document.getElementById('whatsNewList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < XIOM_WHATS_NEW.length; i++) {
    var entry = XIOM_WHATS_NEW[i];
    html += '<div class="info-release"><div class="info-date">' + entry.date + '</div>';
    html += '<h3 class="info-section">' + entry.title + '</h3><ul class="info-list">';
    for (var j = 0; j < entry.items.length; j++) {
      html += '<li>' + entry.items[j] + '</li>';
    }
    html += '</ul></div>';
  }
  list.innerHTML = html;
}

function openWhatsNew() {
  renderWhatsNew();
  var modal = document.getElementById('whatsNewModal');
  if (modal) modal.classList.remove('hidden');
}

function closeWhatsNew() {
  var modal = document.getElementById('whatsNewModal');
  if (modal) modal.classList.add('hidden');
}

function openHelp() {
  var modal = document.getElementById('helpModal');
  if (modal) modal.classList.remove('hidden');
}

function closeHelp() {
  var modal = document.getElementById('helpModal');
  if (modal) modal.classList.add('hidden');
}

document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') {
    closeWhatsNew();
    closeHelp();
  }
});

window.openWhatsNew = openWhatsNew;
window.closeWhatsNew = closeWhatsNew;
window.openHelp = openHelp;
window.closeHelp = closeHelp;
