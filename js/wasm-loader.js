// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
// ============================================================================
// XIOM WASM compiler loader (v0.58.0)
// Loads the in-browser compiler (xiom_wasm.js + xiom_wasm_bg.wasm) built from
// crates/xiom-wasm via wasm-bindgen --target web. Exposes a promise that
// resolves to { compile(source)->JSON-string, version() } or null when the
// WASM cannot load (then the playground falls back to the server endpoints).
// Rebuild: cargo build -p xiom-wasm --target wasm32-unknown-unknown --release
//          wasm-bindgen --target web --out-dir xiom-playground <wasm>
// ============================================================================
window.xiomWasm = (async function () {
  try {
    // The wasm files live at the playground ROOT (xiom_wasm.js + xiom_wasm_bg.wasm),
    // while this loader lives in js/ -- import one level up.
    var mod = await import('../xiom_wasm.js');
    var init = mod.default;
    var wasmUrl = new URL('../xiom_wasm_bg.wasm', document.baseURI).href;
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
