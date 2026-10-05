// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// "What's new" and "Progress & sync" dialogs (modals live in index.html).
// whatsNew is curated: add one entry at the top whenever a user-visible
// change ships, newest first. Keep items short and about the user.
'use strict';

var XIOM_WHATS_NEW = [
  {
    date: '2026-10-05',
    title: 'A Terminal in the run panel',
    items: [
      'For lessons that read input, the Output tab is now a Terminal: the program\'s lines and your answers share one scrollback with a > prompt, and the separate Input tab is gone.',
      'While the program runs the prompt shows "running..." and disables; every answer re-runs the program with it, and the prompt suggests the program\'s last line.',
    ],
  },
  {
    date: '2026-10-05',
    title: 'Input fixes',
    items: [
      'Answering several questions in a row now always keeps every answer (fast typing used to race the runs); the answer box disables while the program runs and refocuses after.',
      'The Input tab no longer hides the output panel, and it mirrors the conversation answers; the conversation hides while the raw box is open.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Talk to your program',
    items: [
      'Input lessons now open a Conversation panel: the program\'s questions and your typed answers stay together like a chat, and each answer re-runs the program with it.',
      'No more hiding input in a separate tab - the raw input box is still under the Input tab for advanced use.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Fairer races in Compare mode',
    items: [
      'Every sort now starts from the same ten values, so Bubble vs Quick vs Counting (and the rest) race on identical input.',
      'Breadth-First Search, Depth-First Search and Dijkstra now mark their start (green) and goal (amber), so the paths they find have a visible target.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Comfortable to read in both themes',
    items: [
      'A contrast pass over light and dark mode: muted labels, accents and lesson lists now clear WCAG AA, and the Lab charts use outlined bars and cells that stay readable in either theme.',
      'Bigger tap targets on phones (lesson rows and Lab controls), slightly larger small text, and clearer maze walls vs open paths.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'The Lab grows trees and strings (2.1)',
    items: [
      'Binary Search Tree, Min-Heap and Trie join the Lab - and the tree view learned to show labels (letters, weights) next to values.',
      'KMP Pattern Search scans a text without ever stepping back; Activity Selection and Huffman Coding show greedy choices in action.',
      'The 2.1 Lab expansion is complete: 37 algorithms, every frame still from the program\'s own trace.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Graphs in the Lab',
    items: [
      'A new Graphs shelf: Dijkstra and A* find shortest paths on a weighted graph (watch the distance labels drop), Topological Sort orders a DAG, Cycle Detection colours a DFS, and Kruskal grows a minimum spanning tree with union-find.',
      'Maze Generation carves a perfect maze from solid wall with a depth-first walk.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Counting, radix and dynamic programming in the Lab',
    items: [
      'Two comparison-free sorts join the Lab: Counting Sort fills a counts table, Radix Sort runs three digit passes.',
      'Four dynamic-programming programs arrive with a new table view: 0/1 Knapsack, Longest Common Subsequence, Edit Distance and Coin Change - watch the table fill and the traceback light up.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Lessons that listen',
    items: [
      'Lessons that read input now open the Input box automatically with their sample loaded, so you can see where the program gets its text - edit it and Run to play with the program.',
      'The Number Guessing Game lesson is now a real game: it reads your guesses from the Input box and answers Too low! / Too high! until you find the secret.',
      'Using your own input no longer counts as "output differs": the expected-result check only compares against the shipped sample input.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Three more sorts in the Lab',
    items: [
      'Tier 2 is arriving: Merge Sort, Quick Sort and Heap Sort join the Lab with the same real-trace playback and compare mode.',
    ],
  },
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
