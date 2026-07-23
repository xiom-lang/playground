require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  monaco.languages.register({ id: 'xiom' });
  monaco.languages.setMonarchTokensProvider('xiom', {
    tokenizer: { root: [
      [/fn|let|var|const|return|if|elif|else|match|while|for|in|type|enum|interface|derive|module|use|pub|as|unsafe|extern|requires|ensures|invariant|spawn|async|await|comptime|true|false|self|result|Some|None|Ok|Err|is|and|or|not|where/, 'keyword'],
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
      [/"[^"]*"/, 'string'],
      [/\/\/.*$/, 'comment'],
      [/\b\d+(\.\d+)?\b/, 'number'],
    ]}
  });
  monaco.editor.defineTheme('xiom-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'e94560', fontStyle: 'bold' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'identifier', foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background': '#0a0a0f',
      'editor.foreground': '#e8e8f0',
      'editor.lineHighlightBackground': '#12121a',
      'editorCursor.foreground': '#e94560',
      'editorLineNumber.foreground': '#444466',
    }
  });

  window.editor = monaco.editor.create(document.getElementById('editorContainer'), {
    value: 'fn main() -> Int {\n  return 42;\n}',
    language: 'xiom',
    theme: 'xiom-dark',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    padding: { top: 16 },
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'line',
  });

  window.editor.addAction({
    id: 'compile',
    label: 'Compile',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => compile(),
  });
});
