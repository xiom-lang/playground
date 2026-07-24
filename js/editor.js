var xiomLanguageRegistered = false;

function registerXiomLanguage() {
  if (xiomLanguageRegistered) return;
  xiomLanguageRegistered = true;

  monaco.languages.register({ id: 'xiom' });

  // ── Monarch tokeniser with state-based function-name highlighting ──
  monaco.languages.setMonarchTokensProvider('xiom', {
    keywords: [
      'fn','let','var','const','return',
      'if','elif','else','match','while','for','in',
      'type','enum','interface','derive','spawn','async','await','comptime',
      'module','use','pub','as','unsafe','extern',
      'true','false','self','result',
      'Some','None','Ok','Err',
      'is','and','or','not','where',
    ],
    typeKeywords: [
      'Int','Int8','Int16','Int32','Int64',
      'UInt','UInt8','UInt16','UInt32','UInt64',
      'Float32','Float64','Bool','Str','Char','Unit',
      'Option','Result','Vec','Map','Set',
    ],
    contractKeywords: [
      'requires','ensures','invariant',
    ],
    operators: [
      '=','>','<','!','~','?',':','==','<=','>=','!=','&&','||',
      '++','--','+','-','*','/','&','|','^','%','<<','>>',
      '+=','-=','*=','/=','%=','->','=>','::','.',
    ],
    symbols: /[=><!~?:&|+\-*\/^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        // Whitespace & comments
        [/[ \t\r\n]+/, 'white'],
        [/\/\/.*$/, 'comment'],

        // String literals
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

        // Contract keywords (indigo, bold)
        [/@contractKeywords\b/, 'contract'],

        // The 'fn' keyword transitions to capture the function name
        [/\bfn\b/, { token: 'keyword', next: '@fnName' }],

        // Regular keywords
        [/@keywords\b/, 'keyword'],

        // Type names
        [/@typeKeywords\b/, 'type'],

        // Numbers
        [/\b\d+(\.\d+)?\b/, 'number'],

        // Identifiers
        [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],

        // Operators
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
      ],

      // After 'fn', the next identifier is the function name
      fnName: [
        [/[ \t]+/, 'white'],
        [/[a-zA-Z_][a-zA-Z0-9_]*/, { token: 'function', next: '@pop' }],
        ['', '', '@pop'],
      ],

      // String state
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });

  // ── XIOM Dark Theme — mockup code colours ──
  monaco.editor.defineTheme('xiom-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword',    foreground: 'ff8fb3', fontStyle: 'bold' },
      { token: 'type',       foreground: '7fd6c0' },
      { token: 'function',   foreground: '8fb3ff' },
      { token: 'contract',   foreground: '5c6bff', fontStyle: 'bold' },
      { token: 'string',     foreground: 'e8c37a' },
      { token: 'comment',    foreground: '5c5f6b', fontStyle: 'italic' },
      { token: 'number',     foreground: 'e8c37a' },
      { token: 'identifier', foreground: 'f2f3f6' },
      { token: 'operator',   foreground: 'f2f3f6' },
      { token: 'white',      foreground: 'f2f3f6' },
    ],
    colors: {
      'editor.background':           '#111217',
      'editor.foreground':           '#f2f3f6',
      'editor.lineHighlightBackground': '#16181d',
      'editor.selectionBackground':    'rgba(92,107,255,0.18)',
      'editorCursor.foreground':       '#5c6bff',
      'editorLineNumber.foreground':   '#5c5f6b',
      'editorLineNumber.activeForeground': '#9497a3',
      'editor.selectionHighlightBorder': 'rgba(92,107,255,0.25)',
      'editor.inactiveSelectionBackground': 'rgba(92,107,255,0.08)',
      'editorIndentGuide.background':  '#1a1c22',
      'editorIndentGuide.activeBackground': '#25272e',
    }
  });
}

function disposeAllEditors() {
  if (window.editor) { window.editor.dispose(); window.editor = null; }
  if (window.pgEditor) { window.pgEditor.dispose(); window.pgEditor = null; }
}

function createEditor(containerId, initialValue) {
  return monaco.editor.create(document.getElementById(containerId), {
    value: initialValue || 'fn main() {\n  io.println("Hello!");\n}',
    language: 'xiom',
    theme: 'xiom-dark',
    fontSize: 13.5,
    fontFamily: "ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace",
    fontLigatures: true,
    lineHeight: 24,
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    padding: { top: 16, bottom: 8 },
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'line',
    bracketPairColorization: { enabled: true },
    matchBrackets: 'always',
    guides: { indentation: true, bracketPairs: true },
  });
}

function addCompileAction(editor) {
  editor.addAction({
    id: 'compile',
    label: 'Compile',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: function () { compile(); },
  });
}

function addLineColTracker(editor) {
  editor.onDidChangeCursorPosition(function () {
    updateLineCount();
  });
}

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  registerXiomLanguage();

  disposeAllEditors();
  window.editor = createEditor('editorContainer', 'fn main() {\n  io.println("Hello!");\n}');
  addCompileAction(window.editor);
  addLineColTracker(window.editor);

  window.editor.onDidChangeCursorPosition(function () {
    updateLineCount();
  });
});

window.initLessonsEditor = function () {
  if (!window.monaco) {
    require(['vs/editor/editor.main'], function () {
      registerXiomLanguage();
      if (window.pgEditor) { window.pgEditor.dispose(); window.pgEditor = null; }
      window.editor = createEditor('editorContainer', 'fn main() {\n  io.println("Hello!");\n}');
      addCompileAction(window.editor);
      window.editor.onDidChangeCursorPosition(function () { updateLineCount(); });
      updateLineCount();
    });
    return;
  }
  registerXiomLanguage();
  if (window.pgEditor) { window.pgEditor.dispose(); window.pgEditor = null; }
  window.editor = createEditor('editorContainer', 'fn main() {\n  io.println("Hello!");\n}');
  addCompileAction(window.editor);
  window.editor.onDidChangeCursorPosition(function () { updateLineCount(); });
  updateLineCount();
};

window.initPlaygroundEditor = function () {
  if (window.pgEditor) return;

  if (!window.monaco) {
    require(['vs/editor/editor.main'], function () {
      registerXiomLanguage();
      disposeAllEditors();
      window.pgEditor = createEditor('pgEditorContainer', 'fn main() {\n  io.println("Hello!");\n}');
      addCompileAction(window.pgEditor);
      window.pgEditor.onDidChangeCursorPosition(function () {
        updateLineCount();
      });
      updateLineCount();
    });
    return;
  }

  registerXiomLanguage();
  disposeAllEditors();
  window.pgEditor = createEditor('pgEditorContainer', 'fn main() {\n  io.println("Hello!");\n}');
  addCompileAction(window.pgEditor);
  window.pgEditor.onDidChangeCursorPosition(function () {
    updateLineCount();
  });
  updateLineCount();
};
