// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
var lessonLimitations = null;

function loadLessonLimitations() {
  return fetch('js/limitations.json')
    .then(function (resp) { return resp.ok ? resp.json() : null; })
    .then(function (data) {
      lessonLimitations = {};
      if (data && data.lessons) {
        data.lessons.forEach(function (entry) { lessonLimitations[entry.id] = entry.reason; });
      }
      return lessonLimitations;
    })
    .catch(function () { lessonLimitations = {}; });
}

function lessonLimitReason(lessonId) {
  return (lessonLimitations && lessonLimitations[lessonId]) || null;
}

function applyLessonAvailability(lesson) {
  var reason = lesson ? lessonLimitReason(lesson.id) : null;
  var btn = document.getElementById('btnRun');
  if (btn) {
    btn.disabled = !!reason;
    btn.title = reason || '';
  }
  var existing = document.getElementById('lessonLimitNotice');
  if (reason) {
    if (!existing) {
      var notice = document.createElement('div');
      notice.id = 'lessonLimitNotice';
      notice.className = 'lesson-limit-notice';
      var host = document.querySelector('.editor-section');
      if (host) host.insertBefore(notice, host.firstChild);
      existing = notice;
    }
    existing.textContent = 'Known limitation: ' + reason + '. This lesson does not compile yet; you can still read and edit it.';
  } else if (existing) {
    existing.remove();
  }
}

function loadLessonCatalog() {
  loadLessonLimitations().then(function () {
    return fetch('/api/lessons');
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error('Catalog not found');
      return resp.json();
    })
    .then(function (catalog) {
      lessonCatalogCache = catalog;
      window.lessonCatalogCache = catalog;
      renderLessonList(catalog);
      updateProgressSummary();
      if (window.checkLastProgress) window.checkLastProgress();
    })
    .catch(function (err) {
      fetch('lessons/index.json')
        .then(function (resp) { return resp.json(); })
        .then(function (catalog) {
          lessonCatalogCache = catalog;
          window.lessonCatalogCache = catalog;
          renderLessonList(catalog);
          updateProgressSummary();
          if (window.checkLastProgress) window.checkLastProgress();
        })
        .catch(function () {
          document.getElementById('lessonList').innerHTML = '<div class="lesson-error">Failed to load lessons. Is the server running?</div>';
        });
    });
}

function renderLessonList(catalog) {
  var container = document.getElementById('lessonList');
  if (!container) return;
  container.innerHTML = '';

  var progress = getProgress();

  catalog.levels.forEach(function (level) {
    var header = document.createElement('div');
    header.className = 'lesson-level-header';

    var completedCount = level.lessons.filter(function (l) {
      return progress.indexOf(l.id) !== -1;
    }).length;
    var totalCount = level.lessons.length;
    var completedClass = completedCount === totalCount ? ' all-done' : '';
    var ratio = totalCount > 0 ? completedCount / totalCount : 0;
    var dash = (43.98 * ratio).toFixed(1);

    header.innerHTML =
      '<span class="level-icon">' + level.icon + '</span>' +
      '<span class="level-name">' + level.name + '</span>' +
      '<svg class="level-ring' + (completedCount === totalCount ? ' complete' : '') + '" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">' +
      '<circle class="level-ring-track" cx="9" cy="9" r="7"></circle>' +
      '<circle class="level-ring-fill" cx="9" cy="9" r="7" style="stroke-dasharray:' + dash + ' 43.98"></circle>' +
      '</svg>' +
      '<span class="level-progress' + completedClass + '" title="' + completedCount + ' of ' + totalCount + ' lessons completed">' + completedCount + ' / ' + totalCount + '</span>';

    container.appendChild(header);

    level.lessons.forEach(function (lesson) {
      var item = document.createElement('div');
      item.className = 'lesson-item';
      item.dataset.lessonId = lesson.id;
      item.dataset.lessonFile = lesson.file;

      var done = progress.indexOf(lesson.id) !== -1;
      var checkHtml = done
        ? '<span class="lesson-check completed">&#x2713;</span>'
        : '<span class="lesson-check"></span>';

      var limitReason = lessonLimitReason(lesson.id);
      var limitHtml = limitReason
        ? '<span class="lesson-badge limited" title="' + escapeHtml(limitReason) + '">compiler</span>'
        : '';

      item.innerHTML =
        checkHtml +
        '<span class="lesson-title">' + lesson.title + limitHtml + '</span>' +
        '<span class="lesson-duration">' + lesson.duration + '</span>';

      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', lesson.id === currentLessonId ? 'true' : 'false');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', lesson.title + ' — ' + lesson.duration);

      item.addEventListener('click', function () {
        selectLesson(lesson.id, lesson.file);
      });

      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectLesson(lesson.id, lesson.file);
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          var next = item.nextElementSibling;
          if (next && next.classList.contains('lesson-item')) next.focus();
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          var prev = item.previousElementSibling;
          if (prev && prev.classList.contains('lesson-item')) prev.focus();
        }
      });

      if (lesson.id === currentLessonId) {
        item.classList.add('active');
      }

      container.appendChild(item);
    });
  });
}

function selectLesson(lessonId, lessonFile) {
  currentLessonId = lessonId;
  currentLessonFile = lessonFile;

  document.querySelectorAll('.lesson-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.lessonId === lessonId);
  });

  if (window.rememberLesson) {
    var title = lessonId;
    if (lessonCatalogCache && lessonCatalogCache.levels) {
      lessonCatalogCache.levels.forEach(function (level) {
        level.lessons.forEach(function (lesson) {
          if (lesson.id === lessonId) title = lesson.title;
        });
      });
    }
    window.rememberLesson(lessonId, lessonFile, title);
  }

  loadLessonContent(lessonFile);
}

function loadLessonContent(lessonFile) {
  var panel = document.getElementById('narrativeContent');
  if (panel) {
    panel.innerHTML = '<div class="narrative-loading">Loading lesson...</div>';
  }

  fetch('lessons/' + lessonFile)
    .then(function (resp) {
      if (!resp.ok) throw new Error('Lesson not found: ' + lessonFile);
      return resp.json();
    })
    .then(function (lesson) {
      currentLessonData = lesson;
      renderNarrative(lesson);
      if (window.renderHistoryBlock) window.renderHistoryBlock(lesson.id);
      document.getElementById('lessonTitle').textContent = lesson.title;
      if (window.editor && lesson.code_template) {
        window.editor.setValue(lesson.code_template);
      } else if (window.setMobileCode) {
        window.setMobileCode(lesson.code_template || '');
      }
      if (window.resetOutputMatch) window.resetOutputMatch();
      applyLessonAvailability(lesson);
      updateProgressSummary();
    })
    .catch(function (err) {
      if (panel) {
        panel.innerHTML = '<div class="narrative-error">Failed to load lesson: ' + err.message + '</div>';
      }
    });
}

function renderNarrative(lesson) {
  var panel = document.getElementById('narrativeContent');
  if (!panel) return;

  var progress = getProgress();
  var isCompleted = progress.indexOf(lesson.id) !== -1;

  var html = '';

  html += '<div class="narrative-header">';
  html += '<h2 class="narrative-title">' + lesson.title + '</h2>';
  html += '<span class="narrative-duration">' + lesson.duration + '</span>';
  html += '</div>';

  if (lesson.story) {
    html += '<div class="narrative-story">';
    html += '<div class="narrative-story-label">📖 Story</div>';
    html += '<p>' + escapeHtml(lesson.story) + '</p>';
    html += '</div>';
  }

  if (lesson.concepts && lesson.concepts.length) {
    html += '<div class="narrative-concepts">';
    lesson.concepts.forEach(function (c) {
      html += '<span class="concept-tag">' + c + '</span>';
    });
    html += '</div>';
  }

  if (lesson.concept) {
    html += '<div class="narrative-body"><p><em>' + lesson.concept + '</em></p></div>';
  }

  if (lesson.analogy) {
    html += '<div class="narrative-analogy">';
    html += '<div class="narrative-analogy-label">💡 Key Idea</div>';
    html += '<p>' + escapeHtml(lesson.analogy) + '</p>';
    html += '</div>';
  }

  if (lesson.why) {
    html += '<div class="narrative-why">';
    html += '<div class="narrative-why-label">🎯 Why This Matters</div>';
    html += '<p>' + escapeHtml(lesson.why) + '</p>';
    html += '</div>';
  }

  if (lesson.theory) {
    html += '<div class="narrative-body">' + parseMarkdown(lesson.theory) + '</div>';
  }

  if (lesson.syntax_ref) {
    html += '<div class="narrative-tips">';
    html += '<h3>&#x1F4DD; Syntax</h3>';
    html += '<pre><code>' + escapeHtml(lesson.syntax_ref) + '</code></pre>';
    html += '</div>';
  }

  if (lesson.tips && lesson.tips.length) {
    html += '<div class="narrative-tips">';
    html += '<h3>&#x1F4A1; Tips</h3><ul>';
    lesson.tips.forEach(function (tip) {
      html += '<li>' + tip + '</li>';
    });
    html += '</ul></div>';
  }

  if (lesson.common_mistakes && lesson.common_mistakes.length) {
    html += '<div class="narrative-tips" style="background:rgba(233,69,96,0.06);border-color:rgba(233,69,96,0.15);">';
    html += '<h3 style="color:var(--error)">&#x26A0; Common Mistakes</h3><ul>';
    lesson.common_mistakes.forEach(function (m) {
      html += '<li>' + m + '</li>';
    });
    html += '</ul></div>';
  }

  html += '<div class="narrative-actions">';
  if (isCompleted) {
    html += '<button class="btn-complete done" disabled>&#x2713; Completed</button>';
  } else {
    html += '<button class="btn-complete" onclick="window.markComplete()">Mark Complete</button>';
  }
  html += '</div>';

  if (lesson.try_it) {
    html += '<div class="narrative-tryit">';
    html += '<div class="narrative-tryit-label">🔬 Experiment</div>';
    html += '<p>' + escapeHtml(lesson.try_it) + '</p>';
    html += '</div>';
  }

  html += '<div id="lessonHistory" class="history-block"></div>';

  panel.innerHTML = html;
}

function parseMarkdown(md) {
  if (!md) return '';

  var blocks = md.split(/(```[\s\S]*?```)/g);

  return blocks.map(function (block) {
    if (/^```/.test(block)) {
      var code = block.replace(/```\w*\n?/, '').replace(/```$/, '');
      return '<pre><code>' + escapeHtml(code.trim()) + '</code></pre>';
    }
    return '<p>' + block
      .replace(/#### (.+)/g, '<h5>$1</h5>')
      .replace(/### (.+)/g, '<h4>$1</h4>')
      .replace(/## (.+)/g, '<h3>$1</h3>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function saveProgress(lessonId) {
  var progress = getProgress();
  if (progress.indexOf(lessonId) === -1) {
    progress.push(lessonId);
    localStorage.setItem('xiom_lessons_completed', JSON.stringify(progress));
  }
}

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem('xiom_lessons_completed') || '[]');
  } catch (e) {
    return [];
  }
}

function markComplete() {
  if (!currentLessonId) return;
  saveProgress(currentLessonId);
  if (window.scheduleSync) window.scheduleSync();
  if (lessonCatalogCache) {
    renderLessonList(lessonCatalogCache);
  }
  if (currentLessonFile) {
    loadLessonContent(currentLessonFile);
  }
  updateProgressSummary();

  var editorSection = document.querySelector('.editor-section');
  if (!editorSection) return;

  var existing = editorSection.querySelector('.floating-complete');
  if (existing) existing.remove();

  var isLastInLevel = false;
  if (lessonCatalogCache && currentLessonData) {
    lessonCatalogCache.levels.forEach(function (level) {
      for (var i = 0; i < level.lessons.length; i++) {
        if (level.lessons[i].id === currentLessonId) {
          if (i === level.lessons.length - 1) isLastInLevel = true;
          return;
        }
      }
    });
  }

  var nextLabel = isLastInLevel ? 'Next Level \u2192' : 'Next \u2192';

  var wrapper = document.createElement('div');
  wrapper.className = 'floating-complete';

  var checkmark = document.createElement('span');
  checkmark.style.cssText = 'color:var(--green);font-weight:600;font-size:14px;';
  checkmark.textContent = '\u2713 Completed';

  var nextBtn = document.createElement('button');
  nextBtn.className = 'btn-next';
  nextBtn.textContent = nextLabel;
  nextBtn.onclick = function () { nextLesson(); };

  wrapper.appendChild(checkmark);
  wrapper.appendChild(nextBtn);
  editorSection.appendChild(wrapper);

  celebrateCompletion();
  if (currentLessonData && currentLessonData.level) {
    checkLevelCompletion(currentLessonData.level);
  }
}

function checkLevelCompletion(levelId) {
  var progress = getProgress();
  var levelLessons = [];

  if (window.lessonCatalogCache && window.lessonCatalogCache.levels) {
    window.lessonCatalogCache.levels.forEach(function (lvl) {
      if (lvl.id === levelId) levelLessons = lvl.lessons;
    });
  }

  if (levelLessons.length === 0) return;

  var completed = levelLessons.filter(function (l) { return progress.indexOf(l.id) >= 0; });
  if (completed.length === levelLessons.length) {
    showLevelComplete(levelId, completed.length);
  }
}

function showLevelComplete(levelId, count) {
  var existing = document.getElementById('levelCompleteOverlay');
  if (existing) existing.remove();

  var names = { L0: 'First Steps', L1: 'Functions', L2: 'Data', L3: 'Pattern Power', L4: 'XIOM Magic', L5: 'Collections', L6: 'Engineering', L7: 'Practice', L8: 'Showcase' };
  var name = names[levelId] || levelId;
  var nextLevel = { L0: 'L1', L1: 'L2', L2: 'L3', L3: 'L4', L4: 'L5', L5: 'L6', L6: 'L7', L7: 'L8', L8: null }[levelId];

  var overlay = document.createElement('div');
  overlay.id = 'levelCompleteOverlay';
  overlay.className = 'onboarding-modal';
  overlay.innerHTML = '<div class="onboarding-content">' +
    '<div style="font-size:48px;margin-bottom:8px">\uD83C\uDF89</div>' +
    '<h2>' + name + ' \u2014 Complete!</h2>' +
    '<p>You finished all ' + count + ' lessons in ' + name + '.</p>' +
    (nextLevel ? '<button class="btn-primary" style="margin-top:12px" onclick="this.parentElement.parentElement.remove(); jumpToLevel(\'' + nextLevel + '\')">Next: ' + (names[nextLevel] || nextLevel) + ' \u2192</button>' : '<p style="color:var(--green);margin-top:12px">\uD83C\uDFC6 You completed the entire XIOM curriculum! Amazing!</p>') +
    '<button class="btn-secondary" style="margin-top:8px" onclick="this.parentElement.parentElement.remove()">Keep Learning</button>' +
    '</div>';
  document.body.appendChild(overlay);

  celebrateCompletion();
}

function jumpToLevel(levelId) {
  if (!window.lessonCatalogCache || !window.lessonCatalogCache.levels) return;
  for (var i = 0; i < window.lessonCatalogCache.levels.length; i++) {
    if (window.lessonCatalogCache.levels[i].id === levelId) {
      var first = window.lessonCatalogCache.levels[i].lessons[0];
      if (first && window.selectLesson) {
        window.selectLesson(first.id, first.file);
      }
      break;
    }
  }
}

function updateProgressSummary() {
  var progress = getProgress();
  var el = document.getElementById('progressSummary');
  if (el) el.textContent = progress.length + '/410';
  var fill = document.getElementById('progressFill');
  if (fill) fill.style.width = (progress.length / 410 * 100) + '%';
}

function filterLessons(query) {
  var q = query.toLowerCase().trim();
  var items = document.querySelectorAll('.lesson-item');
  var headers = document.querySelectorAll('.lesson-level-header');
  var visibleCount = 0;

  items.forEach(function (item) {
    var text = (item.textContent || '').toLowerCase();
    var show = q === '' || text.indexOf(q) >= 0;
    item.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  headers.forEach(function (header) {
    var next = header.nextElementSibling;
    var hasVisible = false;
    while (next && !next.classList.contains('lesson-level-header')) {
      if (next.style.display !== 'none') { hasVisible = true; break; }
      next = next.nextElementSibling;
    }
    header.style.display = hasVisible ? '' : 'none';
  });

  var empty = document.getElementById('lessonEmpty');
  if (q !== '' && visibleCount === 0) {
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'lessonEmpty';
      empty.className = 'lesson-empty';
      var list = document.getElementById('lessonList');
      if (list) list.appendChild(empty);
    }
    empty.textContent = 'No lessons match "' + query.trim() + '". Try a different word.';
  } else if (empty && empty.parentNode) {
    empty.parentNode.removeChild(empty);
  }
}

window.loadLessonCatalog = loadLessonCatalog;
window.filterLessons = filterLessons;
window.renderLessonList = renderLessonList;
window.selectLesson = selectLesson;
window.loadLessonContent = loadLessonContent;
window.saveProgress = saveProgress;
window.getProgress = getProgress;
window.markComplete = markComplete;
window.escapeHtml = escapeHtml;
window.isCurrentLessonLimited = function () {
  return !!(currentLessonId && lessonLimitReason(currentLessonId));
};
window.applyLessonAvailability = applyLessonAvailability;
