var compilerRefData = {
  sections: [
    {
      title: "Basic Commands",
      icon: "\uD83D\uDDA5",
      entries: [
        { cmd: "xiom run file.xi", desc: "Compile and run a XIOM source file" },
        { cmd: "xiom build file.xi", desc: "Compile to a native binary" },
        { cmd: "xiom check file.xi", desc: "Type-check without compiling" },
        { cmd: "xiom fmt file.xi", desc: "Format source code" },
      ]
    },
    {
      title: "Compiler Flags",
      icon: "\u2699",
      entries: [
        { cmd: "--emit-ir", desc: "Output LLVM IR (Intermediate Representation)" },
        { cmd: "--emit-tokens", desc: "Output the token stream from the lexer" },
        { cmd: "--diagnostics-json", desc: "Machine-readable diagnostic output" },
        { cmd: "--verify", desc: "Run Z3 SMT solver to statically verify contracts" },
        { cmd: "--no-contracts", desc: "Strip all contract checks from the binary" },
        { cmd: "--target native", desc: "Compile for the host platform" },
        { cmd: "--target wasm", desc: "Compile to WebAssembly" },
      ]
    },
    {
      title: "Package Management",
      icon: "\uD83D\uDCE6",
      entries: [
        { cmd: "xiom init", desc: "Create a new XIOM package with package.xi" },
        { cmd: "xiom add <package>", desc: "Add a dependency to your project" },
        { cmd: "xiom test", desc: "Run all tests in the project" },
        { cmd: "xiom doc", desc: "Generate documentation from source" },
      ]
    },
    {
      title: "Debugging",
      icon: "\uD83D\uDD0D",
      entries: [
        { cmd: "--verbose", desc: "Show detailed compilation steps" },
        { cmd: "--time", desc: "Show timing for each compiler phase" },
        { cmd: "--stats", desc: "Show compilation statistics" },
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
  intro.textContent = 'The XIOM compiler (xiom) provides a command-line interface for building, checking, and running XIOM programs. Below is a reference of the most common commands and flags.';
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
