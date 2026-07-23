var currentLessonId = null;
var currentLessonFile = null;

function loadLessonCatalog() {
  fetch('lessons/index.json')
    .then(function (resp) { return resp.json(); })
    .then(function (catalog) {
      renderLessonList(catalog);
      var progress = getProgress();
      if (progress.length === 0 && catalog.levels.length > 0 && catalog.levels[0].lessons.length > 0) {
        var first = catalog.levels[0].lessons[0];
        selectLesson(first.id, first.file);
      }
    })
    .catch(function (err) {
      console.error('Failed to load lesson catalog:', err);
      document.getElementById('lessonList').innerHTML = '<div class="lesson-error">Failed to load lessons.</div>';
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

    header.innerHTML =
      '<span class="level-icon">' + level.icon + '</span>' +
      '<span class="level-name">' + level.name + '</span>' +
      '<span class="level-progress' + completedClass + '">' + completedCount + ' / ' + totalCount + '</span>';

    container.appendChild(header);

    level.lessons.forEach(function (lesson) {
      var item = document.createElement('div');
      item.className = 'lesson-item';
      item.dataset.lessonId = lesson.id;
      item.dataset.lessonFile = lesson.file;

      var done = progress.indexOf(lesson.id) !== -1;
      var checkHtml = done
        ? '<span class="lesson-check completed">\u2713</span>'
        : '<span class="lesson-check"></span>';

      item.innerHTML =
        checkHtml +
        '<span class="lesson-title">' + lesson.title + '</span>' +
        '<span class="lesson-duration">' + lesson.duration + '</span>';

      if (lesson.id === currentLessonId) {
        item.classList.add('active');
      }

      item.addEventListener('click', function () {
        selectLesson(this.dataset.lessonId, this.dataset.lessonFile);
      });

      container.appendChild(item);
    });
  });
}

function selectLesson(lessonId, lessonFile) {
  currentLessonId = lessonId;
  currentLessonFile = lessonFile;

  var items = document.querySelectorAll('.lesson-item');
  items.forEach(function (item) {
    item.classList.toggle('active', item.dataset.lessonId === lessonId);
  });

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
      renderNarrative(lesson);
      if (window.editor && lesson.code_template) {
        window.editor.setValue(lesson.code_template);
      }
    })
    .catch(function (err) {
      console.error('Failed to load lesson:', err);
      var panel = document.getElementById('narrativeContent');
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

  if (lesson.concepts && lesson.concepts.length) {
    html += '<div class="narrative-concepts">';
    lesson.concepts.forEach(function (c) {
      html += '<span class="concept-tag">' + c + '</span>';
    });
    html += '</div>';
  }

  html += '<div class="narrative-body">' + parseMarkdown(lesson.narrative) + '</div>';

  if (lesson.tips && lesson.tips.length) {
    html += '<div class="narrative-tips">';
    html += '<h3>Tips</h3><ul>';
    lesson.tips.forEach(function (tip) {
      html += '<li>' + tip + '</li>';
    });
    html += '</ul></div>';
  }

  html += '<div class="narrative-actions">';
  if (isCompleted) {
    html += '<button class="btn-complete done" disabled>\u2713 Completed</button>';
  } else {
    html += '<button class="btn-complete" onclick="window.markComplete()">Mark Complete</button>';
  }
  html += '</div>';

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
      .replace(/### (.+)/g, '<h4>$1</h4>')
      .replace(/## (.+)/g, '<h3>$1</h3>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function escapeHtml(str) {
  return str
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
  loadLessonCatalog();
  if (currentLessonFile) {
    loadLessonContent(currentLessonFile);
  }
}

window.loadLessonCatalog = loadLessonCatalog;
window.renderLessonList = renderLessonList;
window.selectLesson = selectLesson;
window.loadLessonContent = loadLessonContent;
window.saveProgress = saveProgress;
window.getProgress = getProgress;
window.markComplete = markComplete;
