import React, { useState, useCallback, useEffect } from 'react';

const DEFAULT_CODE = `fn main() {
    println("Hello from XIOM!");
}`;

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmModule, setWasmModule] = useState(null);

  useEffect(() => {
    loadWasm();
  }, []);

  async function loadWasm() {
    try {
      const wasm = await WebAssembly.instantiateStreaming(
        fetch('xiom.wasm')
      );
      setWasmModule(wasm.instance);
      setWasmReady(true);
    } catch (e) {
      setError('Failed to load WASM module: ' + e.message);
    }
  }

  const handleCompile = useCallback(async () => {
    if (!wasmModule) {
      setError('WASM module not loaded');
      return;
    }
    setLoading(true);
    setOutput('');
    setError('');

    try {
      const { compile, malloc, memory, free } = wasmModule.exports;
      const encoder = new TextEncoder();
      const codeBytes = encoder.encode(code + '\0');

      const ptr = malloc(codeBytes.length);
      const view = new Uint8Array(memory.buffer, ptr, codeBytes.length);
      view.set(codeBytes);

      const resultPtr = compile(ptr, codeBytes.length - 1);
      const resultView = new Uint8Array(memory.buffer, resultPtr);
      let end = 0;
      while (end < resultView.length && resultView[end] !== 0) end++;
      const result = new TextDecoder().decode(resultView.slice(0, end));

      free(ptr);
      free(resultPtr);

      if (result.startsWith('ERROR:')) {
        setError(result.substring(6));
      } else {
        setOutput(result);
      }
    } catch (e) {
      setError('Compilation error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [code, wasmModule]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>XIOM Playground</h1>
        <span style={styles.version}>v0.49.9</span>
        <span style={wasmReady ? styles.badgeReady : styles.badgeLoading}>
          {wasmReady ? 'WASM Ready' : 'Loading WASM...'}
        </span>
      </header>

      <div style={styles.editorPane}>
        <textarea
          style={styles.editor}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          aria-label="XIOM source code editor"
        />
      </div>

      <button
        style={styles.compileBtn}
        onClick={handleCompile}
        disabled={loading || !wasmReady}
        aria-label="Compile XIOM code"
      >
        {loading ? 'Compiling...' : 'Compile'}
      </button>

      {(output || error) && (
        <div style={output ? styles.outputPane : styles.errorPane}>
          <pre style={styles.outputText}>
            {output || error}
          </pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '24px',
    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
    color: '#ECE8DE',
    background: '#11161D',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#FF8A3D',
    margin: 0,
  },
  version: {
    fontSize: '14px',
    color: '#6B7280',
  },
  badgeReady: {
    fontSize: '12px',
    padding: '2px 10px',
    borderRadius: '12px',
    background: '#065F46',
    color: '#6EE7B7',
  },
  badgeLoading: {
    fontSize: '12px',
    padding: '2px 10px',
    borderRadius: '12px',
    background: '#78350F',
    color: '#FBBF24',
  },
  editorPane: {
    marginBottom: '16px',
  },
  editor: {
    width: '100%',
    height: '280px',
    padding: '16px',
    fontSize: '14px',
    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
    color: '#ECE8DE',
    background: '#1A1F2B',
    border: '1px solid #2D3548',
    borderRadius: '8px',
    resize: 'vertical',
    outline: 'none',
    tabSize: 2,
  },
  compileBtn: {
    padding: '10px 28px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#11161D',
    background: '#FF8A3D',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '20px',
  },
  outputPane: {
    padding: '16px',
    background: '#1A1F2B',
    border: '1px solid #2D3548',
    borderRadius: '8px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  errorPane: {
    padding: '16px',
    background: '#2D1B1B',
    border: '1px solid #7F1D1D',
    borderRadius: '8px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  outputText: {
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};

export default App;
