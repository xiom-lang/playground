// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
var currentEditorTheme = localStorage.getItem('xiom_editor_theme') || 'xiom-dark';
var currentLessonId = null;
var currentLessonFile = null;
var currentLessonData = null;
var lessonCatalogCache = null;
var syntaxVisible = false;
var compilerRefVisible = false;


function showLanding() {
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('lessonsScreen').classList.add('hidden');
}

function startLearning() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.remove('hidden');
  document.getElementById('lessonsScreen').classList.remove('sidebar-hidden');
  if (window.loadLessonCatalog) {
    window.loadLessonCatalog();
  }
  if (!window.editor && window.initLessonsEditor) {
    window.initLessonsEditor();
  } else if (window.editor) {
    window.editor.layout();
  }
}

function toggleSidebar() {
  var screen = document.getElementById('lessonsScreen');
  if (!screen) return;
  screen.classList.toggle('sidebar-hidden');
  if (window.editor) window.editor.layout();
}

function openFreePlay() {
  document.getElementById('landing').classList.add('hidden');
  var screen = document.getElementById('lessonsScreen');
  screen.classList.add('sidebar-hidden');
  screen.classList.remove('hidden');
  if (!window.editor && window.initLessonsEditor) {
    window.initLessonsEditor();
  } else if (window.editor) {
    window.editor.layout();
  }
}

function toggleSyntax() {
  closeStdlibPanel();
  if (compilerRefVisible) {
    compilerRefVisible = false;
    syntaxVisible = true;
    hideCompilerRef();
  } else {
    syntaxVisible = !syntaxVisible;
  }
  var panel = document.getElementById('syntaxPanel');
  panel.classList.toggle('hidden', !syntaxVisible);
  if (syntaxVisible) {
    populateSyntaxPanel();
  }
}

function toggleCompilerRef() {
  var panel = document.getElementById('syntaxPanel');

  closeStdlibPanel();

  if (!compilerRefVisible && syntaxVisible) {
    compilerRefVisible = true;
    showCompilerRef();
    return;
  }

  if (compilerRefVisible) {
    compilerRefVisible = false;
    syntaxVisible = false;
    panel.classList.add('hidden');
    return;
  }

  compilerRefVisible = true;
  syntaxVisible = true;
  panel.classList.remove('hidden');
  showCompilerRef();
}

function toggleStdlibPanel() {
  var panel = document.getElementById('stdlibPanel');
  if (!panel) return;

  if (panel.classList.contains('hidden')) {
    if (syntaxVisible) toggleSyntax();
    if (compilerRefVisible) toggleCompilerRef();
  }

  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    showStdlibPanel();
  }
}

function closeStdlibPanel() {
  var panel = document.getElementById('stdlibPanel');
  if (panel) panel.classList.add('hidden');
}

function formatCode() {
  var source = window.editor ? window.editor.getValue() : '';
  if (!source) return;

  var statusEl = document.getElementById('status');
  statusEl.textContent = 'Formatting...';
  statusEl.className = 'status-bar busy';

  fetch('/api/format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: source })
  })
    .then(function (resp) { return resp.json(); })
    .then(function (r) {
      if (r.formatted) {
        var ed = window.editor;
        if (ed) ed.setValue(r.formatted);
        statusEl.textContent = 'Formatted.';
        statusEl.className = 'status-bar ok';
      } else {
        statusEl.textContent = 'Format failed: ' + (r.error || 'unknown error');
        statusEl.className = 'status-bar err';
      }
    })
    .catch(function () {
      statusEl.textContent = 'Format server unavailable.';
      statusEl.className = 'status-bar err';
    });
}

function nextLesson() {
  if (!currentLessonData || !currentLessonData.next_lesson) return;
  findAndSelectLesson(currentLessonData.next_lesson);
}

function findAndSelectLesson(lessonId) {
  if (!lessonCatalogCache) return;

  var found = null;
  lessonCatalogCache.levels.forEach(function (level) {
    level.lessons.forEach(function (lesson) {
      if (lesson.id === lessonId) found = lesson;
    });
  });

  if (found && window.selectLesson) {
    window.selectLesson(found.id, found.file);
    var floating = document.querySelector('.floating-complete');
    if (floating) floating.remove();
  }
}

function loadFirstLesson() {
  if (!lessonCatalogCache) return;
  var firstLevel = lessonCatalogCache.levels[0];
  if (firstLevel && firstLevel.lessons.length > 0) {
    var first = firstLevel.lessons[0];
    if (window.selectLesson) {
      window.selectLesson(first.id, first.file);
    }
  }
}

function showCompletionBar() {
  var el = document.querySelector('.floating-complete');
  if (el) el.classList.remove('hidden');
}

function checkOnboarding() {
  if (localStorage.getItem('xiom_onboarding_seen')) return;
  var modal = document.getElementById('onboardingModal');
  if (modal) modal.classList.remove('hidden');
}

function dismissOnboarding() {
  localStorage.setItem('xiom_onboarding_seen', '1');
  var modal = document.getElementById('onboardingModal');
  if (modal) modal.classList.add('hidden');
}

function updateLineCount() {
  var ed = window.editor;
  if (!ed) return;
  var pos = ed.getPosition();
  var el = document.getElementById('lineCol');
  if (el && pos) {
    el.textContent = 'Ln ' + pos.lineNumber + ', Col ' + pos.column;
  }
}

function getActiveEditor() {
  return window.editor || null;
}

function getActiveEditorValue() {
  var ed = getActiveEditor();
  return ed ? ed.getValue() : '';
}

function loadQuickExample(name) {
  var examples = {
    hello: 'fn main() {\n  io.println("Hello, world!");\n}',
    vars: 'fn main() {\n  let myName = "Alex";\n  let myAge = 14;\n  io.println(myName);\n  io.println(myAge);\n}',
    math: 'fn main() {\n  let apples = 5;\n  let oranges = 3;\n  let total = apples + oranges;\n  io.println("Total fruit: ");\n  io.println(total);\n}'
  };
  var ed = window.editor;
  if (ed && examples[name]) {
    ed.setValue(examples[name]);
    ed.focus();
  } else if (examples[name]) {
    setTimeout(function () {
      var retryEd = window.editor;
      if (retryEd) { retryEd.setValue(examples[name]); retryEd.focus(); }
    }, 500);
  }
  var el = document.getElementById('exampleSelect');
  if (el) el.value = '';
}

function getActiveOutputIds() {
  return { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts', status: 'status' };
}

// ========== TAB SWITCHING ==========
function setupTabs() {
  document.querySelectorAll('.output-tabs').forEach(function (tabBar) {
    tabBar.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      var parent = tab.closest('.output-tabs');
      parent.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      var tabName = tab.dataset.tab;
      var outputEl = parent.nextElementSibling;
      if (!outputEl) return;
      var ids = { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts' };

      Object.keys(ids).forEach(function (key) {
        var el = document.getElementById(ids[key]);
        if (el) el.classList.toggle('hidden', key !== tabName);
      });

      // Lazy-load IR and Tokens on first click
      if ((tabName === 'ir' || tabName === 'tokens') && window.lazyLoadTab) {
        window.lazyLoadTab(tabName);
      }
    });
  });
}

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', function (e) {
  var lessonsScreen = document.getElementById('lessonsScreen');
  var isLessonsVisible = lessonsScreen && !lessonsScreen.classList.contains('hidden');

  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (isLessonsVisible && window.compile) window.compile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    toggleSyntax();
  }
  if (e.key === 'Escape') {
    var modal = document.getElementById('shortcutModal');
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
      return;
    }
    var stdlibPanel = document.getElementById('stdlibPanel');
    if (stdlibPanel && !stdlibPanel.classList.contains('hidden')) {
      stdlibPanel.classList.add('hidden');
      return;
    }
    if (compilerRefVisible) {
      compilerRefVisible = false;
      document.getElementById('syntaxPanel').classList.add('hidden');
      return;
    }
    if (syntaxVisible) toggleSyntax();
  }
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    toggleShortcuts();
  }
});

window.addEventListener('load', function () {
  applyAppTheme();
  setupTabs();
  if (window.loadLessonCatalog) window.loadLessonCatalog();
  checkLastProgress();
  initResizeHandle();
  applySavedTheme();
  checkOnboarding();
});

function checkLastProgress() {
  var progress = window.getProgress ? window.getProgress() : [];
  if (progress.length === 0) return;

  var el = document.getElementById('continueSection');
  if (!el) return;

  el.classList.remove('hidden');

  var countEl = document.getElementById('continueCount');
  if (countEl) countEl.textContent = progress.length;

  var btnEl = document.getElementById('btnContinue');
  if (btnEl && lessonCatalogCache) {
    var allLessons = [];
    lessonCatalogCache.levels.forEach(function (level) {
      level.lessons.forEach(function (lesson) {
        allLessons.push(lesson);
      });
    });

    for (var i = 0; i < allLessons.length; i++) {
      if (progress.indexOf(allLessons[i].id) === -1) {
        btnEl.setAttribute('data-lesson-id', allLessons[i].id);
        btnEl.setAttribute('data-lesson-file', allLessons[i].file);
        btnEl.textContent = 'Continue: ' + allLessons[i].title + ' \u2192';
        return;
      }
    }

    btnEl.textContent = 'All lessons completed! \u2605 Review \u2192';
  }
}

function continueLearning() {
  var btn = document.getElementById('btnContinue');
  if (!btn) return;

  var lessonId = btn.getAttribute('data-lesson-id');
  var lessonFile = btn.getAttribute('data-lesson-file');

  if (lessonId && lessonFile) {
    startLearning();
    setTimeout(function () {
      if (window.selectLesson) {
        window.selectLesson(lessonId, lessonFile);
      }
    }, 400);
  } else {
    startLearning();
  }
}

// ========== RESIZE HANDLE ==========
function initResizeHandle() {
  var handle = document.getElementById('resizeHandle');
  var panel = document.getElementById('narrativePanel');
  if (!handle || !panel) return;

  var startX = 0;
  var startWidth = 0;
  var dragging = false;

  handle.addEventListener('mousedown', function (e) {
    dragging = true;
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var delta = e.clientX - startX;
    var newWidth = startWidth + delta;
    if (newWidth < 220) newWidth = 220;
    if (newWidth > 600) newWidth = 600;
    panel.style.width = newWidth + 'px';
    panel.style.minWidth = newWidth + 'px';
    panel.style.maxWidth = newWidth + 'px';
  });

  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// ========== LOADING OVERLAY ==========
function showLoading() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function toggleShortcuts() {
  var modal = document.getElementById('shortcutModal');
  if (!modal) return;
  modal.classList.toggle('hidden');
}

function toggleHamburger() {
  var actions = document.querySelector('#lessonsScreen:not(.hidden) .header-actions');
  if (actions) actions.classList.toggle('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.header-actions') && !e.target.closest('.hamburger-btn')) {
    document.querySelectorAll('.header-actions.open').forEach(function(el) { el.classList.remove('open'); });
  }
  if (!e.target.closest('.header-dropdown')) {
    document.querySelectorAll('.header-dropdown.open').forEach(function(el) { el.classList.remove('open'); });
  }
});

function toggleNarrative() {
  var panel = document.getElementById('narrativePanel');
  if (panel) panel.classList.toggle('collapsed');
}

// ========== THEME TOGGLE ==========
var currentAppTheme = localStorage.getItem('xiom_app_theme') || 'dark';

function applyAppTheme() {
  var html = document.documentElement;
  if (currentAppTheme === 'light') {
    html.classList.add('light-mode');
  } else {
    html.classList.remove('light-mode');
  }
  currentEditorTheme = currentAppTheme === 'light' ? 'xiom-light' : 'xiom-dark';
  updateThemeButtons();
}

function toggleEditorTheme() {
  currentAppTheme = currentAppTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('xiom_app_theme', currentAppTheme);
  applyAppTheme();

  try {
    var t = currentAppTheme === 'light' ? 'xiom-light' : 'xiom-dark';
    if (window.editor) monaco.editor.setTheme(t);
  } catch(e) {}

  var overlay = document.getElementById('themeFlash');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'themeFlash';
    overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--panel);color:var(--hi);padding:12px 24px;border-radius:12px;font-size:15px;font-weight:600;z-index:999;pointer-events:none;transition:opacity 0.4s;opacity:1;border:1px solid var(--border);';
    document.body.appendChild(overlay);
  }
  overlay.textContent = currentAppTheme === 'dark' ? '\uD83C\uDF19 Dark mode' : '\u2600\uFE0F Light mode';
  overlay.style.opacity = '1';
  setTimeout(function () { overlay.style.opacity = '0'; }, 1200);
}

function updateThemeButtons() {
  var isDark = currentAppTheme === 'dark';
  var btns = document.querySelectorAll('.theme-toggle');
  btns.forEach(function (btn) {
    btn.innerHTML = isDark ? '\uD83C\uDF19' : '\u2600\uFE0F';
    btn.title = isDark ? 'Dark mode' : 'Light mode';
  });
}

function applySavedTheme() {
  var btns = document.querySelectorAll('.theme-toggle');
  var isDark = currentAppTheme === 'dark';
  btns.forEach(function (btn) {
    btn.innerHTML = isDark ? '\uD83C\uDF19' : '\u2600\uFE0F';
    btn.title = isDark ? 'Dark mode' : 'Light mode';
  });
}
window.applySavedTheme = applySavedTheme;

function celebrateCompletion() {
  var colors = ['#5c6bff', '#34d399', '#f0b445', '#ff8fb3', '#7fd6c0', '#8fb3ff'];
  var container = document.getElementById('confettiContainer');
  if (!container) { container = document.body; }

  for (var i = 0; i < 30; i++) {
    var particle = document.createElement('div');
    var color = colors[Math.floor(Math.random() * colors.length)];
    var left = Math.random() * 100;
    var delay = Math.random() * 0.5;
    var size = 4 + Math.random() * 6;
    var rotation = Math.random() * 360;

    particle.style.cssText = [
      'position: fixed',
      'top: -10px',
      'left: ' + left + '%',
      'width: ' + size + 'px',
      'height: ' + size + 'px',
      'background: ' + color,
      'border-radius: 2px',
      'z-index: 999',
      'pointer-events: none',
      'animation: confettiFall ' + (1.5 + Math.random() * 2) + 's ease-in ' + delay + 's forwards',
      'transform: rotate(' + rotation + 'deg)',
      'opacity: 0.9'
    ].join(';');

    container.appendChild(particle);

    (function(p) {
      setTimeout(function() { p.remove(); }, 3500);
    })(particle);
  }
}
