// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
var xiomLanguageRegistered = false;

function registerXiomLanguage() {
  if (xiomLanguageRegistered) return;
  xiomLanguageRegistered = true;

  monaco.languages.register({ id: 'xiom' });

  monaco.languages.setMonarchTokensProvider('xiom', {
    keywords: 'fn|let|var|const|return|if|elif|else|match|while|for|in|type|enum|interface|derive|spawn|async|await|comptime|module|use|pub|as|unsafe|extern|true|false|self|result|Some|None|Ok|Err|is|and|or|not|where',
    typeKeywords: 'Int|Int8|Int16|Int32|Int64|UInt|UInt8|UInt16|UInt32|UInt64|Float32|Float64|Bool|Str|Char|Unit|Option|Result|Vec|Map|Set',
    operators: [
      '=','>','<','!','~','?',':','==','<=','>=','!=','&&','||',
      '++','--','+','-','*','/','&','|','^','%','<<','>>',
      '+=','-=','*=','/=','%=','->','=>','::','.',
    ],
    symbols: /[=><!~?:&|+\-*\/^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        [/[ \t\r\n]+/, 'white'],
        [/\/\/.*$/, 'comment'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/\b(requires|ensures|invariant)\b/, 'contract'],
        [/\bfn\b/, { token: 'keyword', next: '@fnName' }],
        [/@keywords\b/, 'keyword'],
        [/@typeKeywords\b/, 'type'],
        [/\b\d+(\.\d+)?\b/, 'number'],
        [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
      ],

      fnName: [
        [/[ \t]+/, 'white'],
        [/[a-zA-Z_][a-zA-Z0-9_]*/, { token: 'function', next: '@pop' }],
        ['', '', '@pop'],
      ],

      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  });

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
      { token: '',           foreground: 'f2f3f6' },
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
      'editorWidget.background':       '#111217',
      'editorWidget.border':           '#25272e',
      'input.background':              '#08090b',
      'input.foreground':              '#f2f3f6',
      'input.border':                  '#25272e',
      'focusBorder':                   '#5c6bff',
      'scrollbar.shadow':              '#00000033',
      'scrollbarSlider.background':    '#1a1c2266',
      'scrollbarSlider.hoverBackground': '#25272e99',
      'scrollbarSlider.activeBackground': '#5c6bff66',
      'editorOverviewRuler.border':    '#1a1c22',
      'editorGutter.background':       '#111217',
    }
  });

  monaco.editor.defineTheme('xiom-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword',    foreground: 'cf222e', fontStyle: 'bold' },
      { token: 'type',       foreground: '116329' },
      { token: 'function',   foreground: '6639ba' },
      { token: 'contract',   foreground: '1f45b0', fontStyle: 'bold' },
      { token: 'string',     foreground: '0a3069' },
      { token: 'comment',    foreground: '6e7781', fontStyle: 'italic' },
      { token: 'number',     foreground: '0550ae' },
      { token: 'identifier', foreground: '24292f' },
    ],
    colors: {
      'editor.background':           '#ffffff',
      'editor.foreground':           '#24292f',
      'editor.lineHighlightBackground': '#f6f8fa',
    }
  });
}

function createEditor(containerId, initialValue) {
  var theme = (window.currentAppTheme === 'light') ? 'xiom-light' : 'xiom-dark';
  return monaco.editor.create(document.getElementById(containerId), {
    value: initialValue || 'fn main() {\n  io.println("Hello!");\n}',
    language: 'xiom',
    theme: theme,
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

require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' } });
if (!window._monacoLoading) {
  window._monacoLoading = true;
  require(['vs/editor/editor.main'], function () {
    registerXiomLanguage();
    window.editor = createEditor('editorContainer', 'use xiom.io;\n\nfn main() {\n  io.println("Hello, XIOM!");\n}');
    addCompileAction(window.editor);
    window.editor.onDidChangeCursorPosition(function () {
      updateLineCount();
    });
  });
}

window.initLessonsEditor = function () {
  if (!window.monaco) {
    var check = setInterval(function () {
      if (window.monaco) {
        clearInterval(check);
        _createLessonsEditor();
      }
    }, 100);
    return;
  }
  _createLessonsEditor();
};

function _createLessonsEditor() {
  registerXiomLanguage();
  window.editor = createEditor('editorContainer', 'fn main() {\n  io.println("Hello!");\n}');
  addCompileAction(window.editor);
  window.editor.onDidChangeCursorPosition(function () { updateLineCount(); });
  updateLineCount();
}
