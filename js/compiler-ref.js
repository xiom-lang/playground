// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
var compilerRefData = {
  sections: [
    {
      title: "Basic Commands",
      icon: "\uD83D\uDDA5",
      entries: [
        { cmd: "xiom run file.xi", desc: "Compile and run (scripting mode \u2014 auto-adds use xiom.io;)" },
        { cmd: "xiom build file.xi", desc: "Compile to native binary" },
        { cmd: "xiom check file.xi", desc: "Type-check only, no codegen" },
        { cmd: "xiom check --check-only file.xi", desc: "Parse + type-check only" },
        { cmd: "xiom fmt file.xi", desc: "Format source code (CLI support pending; the playground reports it as unavailable)" },
        { cmd: "xiom doc file.xi", desc: "Generate documentation" },
      ]
    },
    {
      title: "Compilation Flags",
      icon: "\u2699",
      entries: [
        { cmd: "--emit-ir", desc: "Output LLVM IR" },
        { cmd: "--emit-tokens", desc: "Output token stream from lexer" },
        { cmd: "--emit-ast", desc: "Output AST (Abstract Syntax Tree)" },
        { cmd: "--diagnostics-json", desc: "Machine-readable diagnostic output in JSON" },
        { cmd: "--opt level", desc: "Optimization level (0, 1, 2, 3)" },
        { cmd: "--debug", desc: "Include debug symbols" },
        { cmd: "--release", desc: "Release mode (optimized, no debug)" },
      ]
    },
    {
      title: "Target Flags",
      icon: "\uD83C\uDFAF",
      entries: [
        { cmd: "--target native", desc: "Compile for host platform (default)" },
        { cmd: "--target wasm", desc: "Compile to WebAssembly (.wasm)" },
        { cmd: "--target ir", desc: "Stop after IR generation, output .ll file" },
      ]
    },
    {
      title: "Contracts & Verification",
      icon: "\uD83D\uDEE1",
      entries: [
        { cmd: "--verify", desc: "Run Z3 SMT solver for static contract verification" },
        { cmd: "--no-contracts", desc: "Strip all contract checks from binary (for release)" },
        { cmd: "--contracts-only", desc: "Only check contracts, skip codegen" },
        { cmd: "--contracts-verbose", desc: "Show detailed contract check results" },
      ]
    },
    {
      title: "Diagnostics & Debugging",
      icon: "\uD83D\uDD0D",
      entries: [
        { cmd: "--verbose", desc: "Show detailed compilation steps (each phase)" },
        { cmd: "--time", desc: "Show timing for each compiler phase" },
        { cmd: "--stats", desc: "Show compilation statistics" },
        { cmd: "--json", desc: "Output all results as JSON" },
        { cmd: "--color", desc: "Force colored output" },
        { cmd: "--no-color", desc: "Disable colored output" },
        { cmd: "--warnings-as-errors", desc: "Treat warnings as errors" },
      ]
    },
    {
      title: "Package Management",
      icon: "\uD83D\uDCE6",
      entries: [
        { cmd: "xiom init", desc: "Create new XIOM package with package.xi" },
        { cmd: "xiom add <package>", desc: "Add dependency" },
        { cmd: "xiom remove <package>", desc: "Remove dependency" },
        { cmd: "xiom update", desc: "Update dependencies" },
        { cmd: "xiom test", desc: "Run all tests" },
        { cmd: "xiom bench", desc: "Run benchmarks" },
        { cmd: "xiom clean", desc: "Clean build artifacts" },
      ]
    }
  ]
};

function showCompilerRef() {
  var container = document.querySelector('.syntax-content');
  if (!container) return;

  var header = document.querySelector('.syntax-header h3');
  if (header) header.textContent = 'Compiler Reference';

  container.innerHTML = '';

  var intro = document.createElement('div');
  intro.style.cssText = 'margin-bottom:20px;font-size:13px;color:var(--mid);line-height:1.6;';
  intro.textContent = 'The XIOM compiler (xiom) provides a command-line interface for building, checking, and running XIOM programs. Below is a reference of all commands and flags.';
  container.appendChild(intro);

  compilerRefData.sections.forEach(function (section) {
    var secDiv = document.createElement('div');
    secDiv.className = 'compiler-ref-section';

    var secTitle = document.createElement('div');
    secTitle.className = 'compiler-ref-section-title';
    secTitle.innerHTML = '<span>' + section.icon + '</span>' + section.title;
    secDiv.appendChild(secTitle);

    section.entries.forEach(function (entry) {
      var entryDiv = document.createElement('div');
      entryDiv.className = 'compiler-ref-entry';
      entryDiv.innerHTML = '<code>' + escapeHtml(entry.cmd) + '</code><span>' + escapeHtml(entry.desc) + '</span>';
      secDiv.appendChild(entryDiv);
    });

    container.appendChild(secDiv);
  });

  var footer = document.createElement('div');
  footer.style.cssText = 'margin-top:20px;padding:12px 16px;background:var(--panel-2);border-radius:var(--radius-sm);border:1px solid var(--border-soft);font-size:12px;color:var(--low);line-height:1.6;';
  footer.innerHTML = 'Tip: Use <code style="color:var(--indigo);background:var(--void);padding:1px 5px;border-radius:3px;font-family:var(--mono);">xiom --help</code> to see all available options in your terminal.';
  container.appendChild(footer);
}

function hideCompilerRef() {
  var header = document.querySelector('.syntax-header h3');
  if (header) header.textContent = 'Concepts';
  if (typeof populateSyntaxPanel === 'function') {
    populateSyntaxPanel();
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
