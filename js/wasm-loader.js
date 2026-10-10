// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// ============================================================================
// XIOM WASM compiler loader (v0.64.3)
// Loads the in-browser compiler (xiom-wasm.js + xiom-wasm_bg.wasm) built from
// crates/xiom-wasm via wasm-bindgen --target web and shipped with the release
// (v0.64.3 assets: xiom-wasm.js, xiom-wasm.d.ts, xiom-wasm_bg.wasm).
// Exposes a promise that resolves to { compile(source)->JSON-string, version }
// or null when the WASM cannot load (then the playground falls back to the
// server endpoints).
// ============================================================================
window.xiomWasm = (async function () {
  try {
    // The wasm files live at the playground ROOT (xiom-wasm.js +
    // xiom-wasm_bg.wasm), while this loader lives in js/ -- import one level up.
    var mod = await import('../xiom-wasm.js');
    var init = mod.default;
    var wasmUrl = new URL('../xiom-wasm_bg.wasm', document.baseURI).href;
    var resp = await fetch(wasmUrl);
    if (!resp.ok) throw new Error('fetch ' + wasmUrl + ' -> ' + resp.status);
    var bytes = await resp.arrayBuffer();
    await init({ module_or_path: bytes });
    var version = mod.get_version();
    console.log('[xiom-wasm] in-browser compiler ready: ' + version);
    return { compile: mod.compile_xiom, version: version };
  } catch (e) {
    console.warn('[xiom-wasm] unavailable, playground falls back to server: ' + e);
    return null;
  }
})();
