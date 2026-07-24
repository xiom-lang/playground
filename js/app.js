var currentMode = 'landing';
var currentLessonId = null;
var currentLessonFile = null;
var currentLessonData = null;
var lessonCatalogCache = null;
var syntaxVisible = false;
var compilerRefVisible = false;

function showLanding() {
  currentMode = 'landing';
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('lessonsScreen').classList.add('hidden');
  document.getElementById('playgroundScreen').classList.add('hidden');
}

function startLearning() {
  currentMode = 'lessons';
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('playgroundScreen').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.remove('hidden');
  if (window.loadLessonCatalog) {
    window.loadLessonCatalog();
  }
  // Re-init editor if it was disposed (e.g. by switching to playground)
  if (!window.editor && window.initLessonsEditor) {
    window.initLessonsEditor();
  } else if (window.editor) {
    window.editor.layout();
  }
}

function openPlayground() {
  currentMode = 'playground';
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.add('hidden');
  document.getElementById('playgroundScreen').classList.remove('hidden');
  initPlaygroundEditor();
}

function toggleSyntax() {
  if (compilerRefVisible) {
    compilerRefVisible = false;
    syntaxVisible = true;
    var panel = document.getElementById('syntaxPanel');
    panel.classList.remove('hidden');
    hideCompilerRef();
    return;
  }
  syntaxVisible = !syntaxVisible;
  var panel = document.getElementById('syntaxPanel');
  panel.classList.toggle('hidden', !syntaxVisible);
  if (syntaxVisible) {
    populateSyntaxPanel();
  }
}

function toggleCompilerRef() {
  var panel = document.getElementById('syntaxPanel');
  if (syntaxVisible && !compilerRefVisible) {
    compilerRefVisible = true;
    showCompilerRef();
    return;
  }
  if (compilerRefVisible) {
    compilerRefVisible = false;
    panel.classList.add('hidden');
    return;
  }
  compilerRefVisible = true;
  syntaxVisible = true;
  panel.classList.remove('hidden');
  showCompilerRef();
}

function formatCode() {
  var source = getActiveEditorValue();
  if (!source) return;

  var statusEl = currentMode === 'playground' ? document.getElementById('pgStatus') : document.getElementById('status');
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
        var ed = getActiveEditor();
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
    document.getElementById('completionBar').classList.add('hidden');
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
  document.getElementById('completionBar').classList.remove('hidden');
}

function updateLineCount() {
  var ed = getActiveEditor();
  if (!ed) return;
  var pos = ed.getPosition();
  var elId = currentMode === 'playground' ? 'pgLineCol' : 'lineCol';
  var el = document.getElementById(elId);
  if (el && pos) {
    el.textContent = 'Ln ' + pos.lineNumber + ', Col ' + pos.column;
  }
}

function getActiveEditor() {
  if (currentMode === 'playground') return window.pgEditor || null;
  return window.editor || null;
}

function getActiveEditorValue() {
  var ed = getActiveEditor();
  return ed ? ed.getValue() : '';
}

function loadQuickExample(name) {
  var examples = {
    hello: '// Your first program!\nio.println("Hello, world!");',
    vars: '// Variables are named boxes\nlet myName = "Alex";\nio.println(myName);',
    math: '// Math is easy\nlet apples = 5;\nlet oranges = 3;\nio.println(apples + oranges);'
  };
  var ed = window.editor || window.pgEditor;
  if (ed && examples[name]) ed.setValue(examples[name]);
  document.getElementById('exampleSelect').value = '';
}

function getActiveOutputIds() {
  if (!document.getElementById('lessonsScreen').classList.contains('hidden'))
    return { output:'output', ir:'ir', diag:'diag', tokens:'tokens', contracts:'contracts', status:'status' };
  return { output:'pgOutput', ir:'pgIR', diag:'pgDiag', tokens:'pgTokens', contracts:'pgContracts', status:'pgStatus' };
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
      var ids = !document.getElementById('lessonsScreen').classList.contains('hidden')
        ? { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts' }
        : { output: 'pgOutput', ir: 'pgIR', diag: 'pgDiag', tokens: 'pgTokens', contracts: 'pgContracts' };

      Object.keys(ids).forEach(function (key) {
        var el = document.getElementById(ids[key]);
        if (el) el.classList.toggle('hidden', key !== tabName);
      });
    });
  });
}

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (currentMode !== 'landing' && window.compile) window.compile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    toggleSyntax();
  }
  if (e.key === 'Escape') {
    // Close shortcut modal first
    var modal = document.getElementById('shortcutModal');
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
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
  setupTabs();
  if (window.loadLessonCatalog) window.loadLessonCatalog();
  checkLastProgress();
  initResizeHandle();
});

function checkLastProgress() {
  var progress = window.getProgress ? window.getProgress() : [];
  if (progress.length === 0) return;

  var el = document.getElementById('continueSection');
  if (!el) return;

  el.classList.remove('hidden');

  var countEl = document.getElementById('continueCount');
  if (countEl) countEl.textContent = progress.length;

  // Find the first uncompleted lesson in the catalog
  var btnEl = document.getElementById('btnContinue');
  if (btnEl && lessonCatalogCache) {
    var allLessons = [];
    lessonCatalogCache.levels.forEach(function (level) {
      level.lessons.forEach(function (lesson) {
        allLessons.push(lesson);
      });
    });

    // Find the next uncompleted lesson
    for (var i = 0; i < allLessons.length; i++) {
      if (progress.indexOf(allLessons[i].id) === -1) {
        btnEl.setAttribute('data-lesson-id', allLessons[i].id);
        btnEl.setAttribute('data-lesson-file', allLessons[i].file);
        btnEl.textContent = 'Continue: ' + allLessons[i].title + ' \u2192';
        return;
      }
    }

    // All lessons completed
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
    // Wait for the lessons screen to render, then select the lesson
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
    // Clamp between 220px and 600px
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
  var overlay = currentMode === 'playground'
    ? document.getElementById('pgLoadingOverlay')
    : document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
  var pgOverlay = document.getElementById('pgLoadingOverlay');
  if (pgOverlay) pgOverlay.classList.add('hidden');
}

function toggleShortcuts() {
  var modal = document.getElementById('shortcutModal');
  if (!modal) return;
  modal.classList.toggle('hidden');
}
