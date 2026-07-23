var syntaxData = {
  keywords: [
    { kw: 'fn', desc: 'Define a function' },
    { kw: 'return', desc: 'Return a value from a function' },
    { kw: 'let', desc: 'Immutable variable binding' },
    { kw: 'var', desc: 'Mutable variable declaration' },
    { kw: 'const', desc: 'Compile-time constant' },
    { kw: 'if', desc: 'Conditional branch' },
    { kw: 'elif', desc: 'Else-if branch (XIOM specific)' },
    { kw: 'else', desc: 'Fallback branch' },
    { kw: 'match', desc: 'Pattern matching expression' },
    { kw: 'while', desc: 'Conditional loop' },
    { kw: 'for', desc: 'Iterator loop' },
    { kw: 'in', desc: 'Membership / iteration target' },
    { kw: 'type', desc: 'Type alias definition' },
    { kw: 'enum', desc: 'Algebraic data type' },
    { kw: 'interface', desc: 'Define a trait/interface' },
    { kw: 'derive', desc: 'Auto-implement interface' },
    { kw: 'module', desc: 'Define a module' },
    { kw: 'use', desc: 'Import symbols' },
    { kw: 'pub', desc: 'Make item public' },
    { kw: 'as', desc: 'Type cast or alias' },
    { kw: 'unsafe', desc: 'Enter unsafe block' },
    { kw: 'extern', desc: 'FFI declaration' },
    { kw: 'requires', desc: 'Precondition contract' },
    { kw: 'ensures', desc: 'Postcondition contract' },
    { kw: 'invariant', desc: 'Type invariant contract' },
    { kw: 'spawn', desc: 'Spawn a task/coroutine' },
    { kw: 'async', desc: 'Async function marker' },
    { kw: 'await', desc: 'Await async result' },
    { kw: 'comptime', desc: 'Compile-time evaluation' },
    { kw: 'true', desc: 'Boolean true literal' },
    { kw: 'false', desc: 'Boolean false literal' },
    { kw: 'self', desc: 'Current instance reference' },
    { kw: 'result', desc: 'Result type context' },
    { kw: 'Some', desc: 'Option variant: has value' },
    { kw: 'None', desc: 'Option variant: no value' },
    { kw: 'Ok', desc: 'Result variant: success' },
    { kw: 'Err', desc: 'Result variant: error' },
    { kw: 'is', desc: 'Type check operator' },
    { kw: 'and', desc: 'Logical AND' },
    { kw: 'or', desc: 'Logical OR' },
    { kw: 'not', desc: 'Logical NOT' },
    { kw: 'where', desc: 'Generic constraint clause' }
  ],

  operators: [
    { op: '+', prec: 11, desc: 'Addition' },
    { op: '-', prec: 11, desc: 'Subtraction' },
    { op: '*', prec: 12, desc: 'Multiplication' },
    { op: '/', prec: 12, desc: 'Division' },
    { op: '%', prec: 12, desc: 'Remainder (modulo)' },
    { op: '==', prec: 7, desc: 'Equality comparison' },
    { op: '!=', prec: 7, desc: 'Inequality comparison' },
    { op: '<', prec: 8, desc: 'Less than' },
    { op: '>', prec: 8, desc: 'Greater than' },
    { op: '<=', prec: 8, desc: 'Less than or equal' },
    { op: '>=', prec: 8, desc: 'Greater than or equal' },
    { op: '&&', prec: 5, desc: 'Logical AND (short-circuit)' },
    { op: '||', prec: 4, desc: 'Logical OR (short-circuit)' },
    { op: '!', prec: 14, desc: 'Logical NOT (unary)' },
    { op: '&', prec: 9, desc: 'Bitwise AND / Reference' },
    { op: '|', prec: 7, desc: 'Bitwise OR / Pipe' },
    { op: '^', prec: 8, desc: 'Bitwise XOR' },
    { op: '~', prec: 14, desc: 'Bitwise NOT (unary)' },
    { op: '<<', prec: 10, desc: 'Left bit shift' },
    { op: '>>', prec: 10, desc: 'Right bit shift' },
    { op: '=', prec: 1, desc: 'Assignment' },
    { op: '+=', prec: 1, desc: 'Add and assign' },
    { op: '-=', prec: 1, desc: 'Subtract and assign' },
    { op: '*=', prec: 1, desc: 'Multiply and assign' },
    { op: '/=', prec: 1, desc: 'Divide and assign' },
    { op: '->', prec: 15, desc: 'Return type / arrow' },
    { op: '=>', prec: 15, desc: 'Fat arrow (match arm)' },
    { op: '::', prec: 15, desc: 'Path separator (module access)' },
    { op: '.', prec: 15, desc: 'Field access / method call' },
    { op: '?', prec: 15, desc: 'Option/Result unwrap propagation' }
  ],

  types: [
    { name: 'Int', desc: 'Default signed integer (i32)' },
    { name: 'Int8', desc: '8-bit signed integer' },
    { name: 'Int16', desc: '16-bit signed integer' },
    { name: 'Int32', desc: '32-bit signed integer' },
    { name: 'Int64', desc: '64-bit signed integer' },
    { name: 'U8', desc: '8-bit unsigned integer' },
    { name: 'U16', desc: '16-bit unsigned integer' },
    { name: 'U32', desc: '32-bit unsigned integer' },
    { name: 'U64', desc: '64-bit unsigned integer' },
    { name: 'Float32', desc: '32-bit IEEE 754 float' },
    { name: 'Float64', desc: '64-bit IEEE 754 double' },
    { name: 'Bool', desc: 'Boolean (true/false)' },
    { name: 'Str', desc: 'Immutable UTF-8 string' },
    { name: 'Char', desc: 'Unicode scalar value' },
    { name: 'Void', desc: 'No value (unit type)' },
    { name: 'Option&lt;T&gt;', desc: 'Maybe has value (Some/None)' },
    { name: 'Result&lt;T,E&gt;', desc: 'Success or error (Ok/Err)' },
    { name: 'Vec&lt;T&gt;', desc: 'Dynamic array' },
    { name: 'Map&lt;K,V&gt;', desc: 'Hash map / dictionary' },
    { name: 'Set&lt;T&gt;', desc: 'Hash set' },
    { name: 'Range', desc: 'Iterator range (start..end)' }
  ],

  patterns: [
    { name: 'Function', code: 'fn name(param: Type) -> ReturnType {\n  return value;\n}' },
    { name: 'Variable', code: 'let x: Int = 42;\nvar y: Int = 0;' },
    { name: 'If / Elif / Else', code: 'if condition {\n  // branch\n} elif other {\n  // branch\n} else {\n  // fallback\n}' },
    { name: 'Match', code: 'match value {\n  Pattern1 => result1,\n  Pattern2 => result2,\n  _ => default,\n}' },
    { name: 'While loop', code: 'while condition {\n  // body\n}' },
    { name: 'For loop', code: 'for item in iterable {\n  // body\n}' },
    { name: 'Enum', code: 'enum Color {\n  Red,\n  Green,\n  Blue(Int),\n}' },
    { name: 'Contracts', code: 'fn divide(a: Int, b: Int) -> Int\n  requires: b != 0\n  ensures: result * b == a\n{\n  return a / b;\n}' },
    { name: 'Interface', code: 'interface Display {\n  fn display(self) -> Str;\n}' },
    { name: 'Compile-time', code: 'comptime {\n  // evaluated during compilation\n}' }
  ]
};

function populateSyntaxPanel() {
  var container = document.querySelector('.syntax-content');
  if (!container) return;

  container.innerHTML = '';

  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'syntax-search';
  searchInput.placeholder = 'Filter syntax...';
  searchInput.addEventListener('input', function () {
    filterSyntax(this.value);
  });
  container.appendChild(searchInput);

  buildSection(container, 'Keywords', syntaxData.keywords, 'keyword');
  buildSection(container, 'Operators', syntaxData.operators, 'operator');
  buildSection(container, 'Primitive Types', syntaxData.types, 'type');
  buildSection(container, 'Common Patterns', syntaxData.patterns, 'pattern');
}

function buildSection(container, title, items, kind) {
  var section = document.createElement('div');
  section.className = 'syntax-section';

  var header = document.createElement('div');
  header.className = 'syntax-section-header';
  header.innerHTML = title + ' <span class="arrow">&#x25BC;</span>';
  header.addEventListener('click', function () {
    var body = this.nextElementSibling;
    body.classList.toggle('hidden');
    var arrow = this.querySelector('.arrow');
    arrow.innerHTML = body.classList.contains('hidden') ? '&#x25B6;' : '&#x25BC;';
  });

  var body = document.createElement('div');
  body.className = 'syntax-section-body';

  if (kind === 'pattern') {
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'syntax-pattern syntax-item';
      div.setAttribute('data-search', item.name.toLowerCase() + ' ' + item.code.toLowerCase());
      div.innerHTML = '<span class="label">' + escapeHtml(item.name) + '</span><pre>' + escapeHtml(item.code) + '</pre>';
      body.appendChild(div);
    });
  } else if (kind === 'operator') {
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'syntax-entry syntax-item';
      div.setAttribute('data-search', item.op + ' ' + item.desc.toLowerCase());
      div.innerHTML = '<span class="operator">' + escapeHtml(item.op) + '</span><span class="precedence">prec ' + item.prec + '</span><span class="desc">' + escapeHtml(item.desc) + '</span>';
      body.appendChild(div);
    });
  } else if (kind === 'type') {
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'syntax-entry syntax-item';
      div.setAttribute('data-search', item.name.toLowerCase() + ' ' + item.desc.toLowerCase());
      div.innerHTML = '<span class="type-name">' + item.name + '</span><span class="desc">' + escapeHtml(item.desc) + '</span>';
      body.appendChild(div);
    });
  } else {
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'syntax-entry syntax-item';
      div.setAttribute('data-search', item.kw.toLowerCase() + ' ' + item.desc.toLowerCase());
      div.innerHTML = '<span class="keyword">' + escapeHtml(item.kw) + '</span><span class="desc">' + escapeHtml(item.desc) + '</span>';
      body.appendChild(div);
    });
  }

  section.appendChild(header);
  section.appendChild(body);
  container.appendChild(section);
}

function filterSyntax(query) {
  var q = query.toLowerCase();
  document.querySelectorAll('.syntax-item').forEach(function (item) {
    var search = item.getAttribute('data-search') || '';
    item.style.display = search.indexOf(q) >= 0 ? '' : 'none';
  });

  document.querySelectorAll('.syntax-section').forEach(function (section) {
    var body = section.querySelector('.syntax-section-body');
    if (!body) return;
    var visible = body.querySelectorAll('.syntax-item[style*="display: none"]').length;
    var total = body.querySelectorAll('.syntax-item').length;
    section.style.display = visible === total ? 'none' : '';
    if (q) {
      body.classList.remove('hidden');
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
