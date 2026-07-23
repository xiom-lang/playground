document.querySelectorAll('.tab').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var tab = btn.dataset.tab;
    ['output', 'ir', 'diag', 'tokens', 'contracts'].forEach(function (id) {
      document.getElementById(id).classList.toggle('hidden', id !== tab);
    });
  });
});

document.getElementById('btnLessons').addEventListener('click', function () {
  document.getElementById('sidebar').classList.toggle('hidden');
});

function loadDefault() {
  if (window.editor) {
    window.editor.setValue('fn main() -> Int {\n  return 42;\n}');
  }
}

window.addEventListener('load', function () {
  if (window.loadLessonCatalog) window.loadLessonCatalog();
});
