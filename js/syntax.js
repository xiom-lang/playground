var concepts = [
  {
    id: "program",
    name: "What is a Program?",
    icon: "📝",
    section: "getting-started",
    metaphor: "A program is like a recipe. You write steps, the computer follows them in order.",
    example: '// A program runs from top to bottom\nio.println("Step 1: Hello!");\nio.println("Step 2: Goodbye!");',
    keywords: ["io.println", "comments"]
  },
  {
    id: "output",
    name: "Showing Output",
    icon: "💬",
    section: "getting-started",
    metaphor: "`io.println` is how your program talks to you. It prints text on the screen, like writing a note.",
    example: 'io.println("I can print anything!");\nio.println("Numbers too:");\nio.println(42);',
    keywords: ["io.println", "Str"]
  },
  {
    id: "variables",
    name: "Named Boxes",
    icon: "📦",
    section: "getting-started",
    metaphor: "A variable is like a labeled box. `let` creates a box and puts something inside. The name helps you find it later.",
    example: 'let myName = "Alex";\nlet myAge = 25;\nio.println(myName);\nio.println(myAge);',
    keywords: ["let", "Str", "Int"]
  },
  {
    id: "numbers",
    name: "Working with Numbers",
    icon: "🔢",
    section: "getting-started",
    metaphor: "Computers are number-crunching machines. You can add, subtract, multiply, and divide with ease.",
    example: 'let price = 10;\nlet quantity = 3;\nlet total = price * quantity;\nio.println(total);',
    keywords: ["Int", "+", "-", "*", "/"]
  },
  {
    id: "text",
    name: "Working with Text",
    icon: "📝",
    section: "making-decisions",
    metaphor: "Text in programming is called a 'string' — like beads on a string of letters. Wrap text in double quotes.",
    example: 'let greeting = "Hello";\nlet name = "World";\nio.println(greeting + " " + name + "!");',
    keywords: ["Str", "+"]
  },
  {
    id: "booleans",
    name: "True or False",
    icon: "💡",
    section: "making-decisions",
    metaphor: "Computers think in true and false — like a light switch that is either on or off. XIOM calls this a `Bool`.",
    example: 'let isRaining = true;\nlet isSunny = false;\nio.println(isRaining);\nio.println(5 > 3);\nio.println(2 == 3);',
    keywords: ["Bool", "true", "false", "==", ">"]
  },
  {
    id: "decisions",
    name: "Making Decisions",
    icon: "🔀",
    section: "making-decisions",
    metaphor: "Your program can make choices. 'If it is raining, take an umbrella.' In code: `if` and `else`.",
    example: 'let temperature = 30;\nif temperature > 25 {\n  io.println("It is hot!");\n} else {\n  io.println("It is cool.");\n}',
    keywords: ["if", "else", "Bool", ">"]
  },
  {
    id: "repetition",
    name: "Doing Things Repeatedly",
    icon: "🔁",
    section: "making-decisions",
    metaphor: "Need something done 10 times? Use a `while` loop. It is like saying 'while there is coffee, keep drinking.'",
    example: 'var count = 1;\nwhile count <= 5 {\n  io.println(count);\n  count += 1;\n}',
    keywords: ["while", "var", "+="]
  },
  {
    id: "functions",
    name: "Reusable Recipes",
    icon: "📋",
    section: "building-blocks",
    metaphor: "A function is a named recipe. Write it once, use it many times. Feed it ingredients (parameters) and it does the work.",
    example: 'fn greet(name: Str) {\n  io.println("Hello, " + name + "!");\n}\n\ngreet("Alice");\ngreet("Bob");',
    keywords: ["fn", "parameters"]
  },
  {
    id: "return-values",
    name: "Functions That Return Values",
    icon: "📤",
    section: "building-blocks",
    metaphor: "Functions can cook up a result and hand it back. The `return` keyword sends a value back to whoever called the function.",
    example: 'fn double(x: Int) -> Int {\n  return x * 2;\n}\n\nlet result = double(5);\nio.println(result);',
    keywords: ["fn", "return", "->"]
  },
  {
    id: "type-annotations",
    name: "Type Labels",
    icon: "🏷️",
    section: "building-blocks",
    metaphor: "Every box has a label saying what kind of thing belongs inside. `let name: Str` means 'this box holds text'. The compiler double-checks you.",
    example: 'let name: Str = "XIOM";\nlet year: Int = 2026;\nlet pi: Float64 = 3.14159;\nlet active: Bool = true;\nio.println(name);',
    keywords: ["Str", "Int", "Bool", "Float64", "type"]
  },
  {
    id: "lists",
    name: "Lists of Things",
    icon: "📋",
    section: "building-blocks",
    metaphor: "A `Vec` is like a shopping list. You can add items, remove them, and walk through them one by one.",
    example: 'var fruits: Vec[Str] = Vec[Str].new();\nfruits.push("Apple");\nfruits.push("Banana");\nfor fruit in fruits {\n  io.println(fruit);\n}',
    keywords: ["Vec", "push", "for", "in"]
  },
  {
    id: "structs",
    name: "Custom Blueprints",
    icon: "🏗️",
    section: "building-blocks",
    metaphor: "A `struct` is a blueprint for a custom box. You decide what goes inside. A Point has an x and a y.",
    example: 'struct Point {\n  x: Int,\n  y: Int,\n}\n\nlet p = Point { x: 10, y: 20 };\nio.println(p.x);',
    keywords: ["struct", "let"]
  },
  {
    id: "enums",
    name: "This or That",
    icon: "🎯",
    section: "building-blocks",
    metaphor: "An `enum` lets you pick from a fixed set of choices. A traffic light is Red, Yellow, or Green — nothing else.",
    example: 'enum Color {\n  Red,\n  Green,\n  Blue,\n}\n\nlet favorite = Color.Blue;',
    keywords: ["enum", "let"]
  },
  {
    id: "errors",
    name: "When Things Go Wrong",
    icon: "⚠️",
    section: "handling-complexity",
    metaphor: "Sometimes things fail — a file is missing, a number cannot be parsed. XIOM's `Result` lets you handle failure gracefully instead of crashing.",
    example: 'let result = string.str_to_int("abc");\nmatch result {\n  Ok(value) => io.println(value),\n  Err(msg) => io.println("Error: " + msg),\n}',
    keywords: ["Result", "Ok", "Err", "match"]
  },
  {
    id: "pattern-matching",
    name: "Pattern Matching",
    icon: "🔍",
    section: "handling-complexity",
    metaphor: "`match` is like a multi-way fork in the road. You describe each possible pattern and the code to run for it.",
    example: 'let score = 85;\nmatch score {\n  s if s >= 90 => io.println("A"),\n  s if s >= 80 => io.println("B"),\n  _ => io.println("Keep trying!"),\n}',
    keywords: ["match", "=>", "_"]
  },
  {
    id: "option",
    name: "Something or Nothing",
    icon: "🎁",
    section: "handling-complexity",
    metaphor: "`Option` answers 'do you have one?' — `Some(value)` means 'yes, here it is', `None` means 'no, sorry'. No more null crashes.",
    example: 'let found: Option[Int] = Some(42);\nmatch found {\n  Some(x) => io.println("Got: "),\n  None => io.println("Nothing there"),\n}',
    keywords: ["Option", "Some", "None", "match"]
  },
  {
    id: "modules",
    name: "Organizing Code",
    icon: "📁",
    section: "handling-complexity",
    metaphor: "As your program grows, split it into modules like chapters in a book. Each module has its own purpose.",
    example: 'module math {\n  pub fn add(a: Int, b: Int) -> Int {\n    return a + b;\n  }\n}\n\nuse math;\nio.println(math.add(3, 4));',
    keywords: ["module", "pub", "use"]
  },
  {
    id: "references",
    name: "Borrowing, Not Copying",
    icon: "🔗",
    section: "handling-complexity",
    metaphor: "Instead of photocopying a whole book, just point to it. `&` creates a reference — you borrow access without making a copy.",
    example: 'fn print_name(name: &Str) {\n  io.println(name);\n}\n\nlet myName = "XIOM";\nprint_name(&myName);',
    keywords: ["&", "fn", "references"]
  },
  {
    id: "contracts",
    name: "Promises to the Compiler",
    icon: "📜",
    section: "handling-complexity",
    metaphor: "`requires` and `ensures` are promises you make. 'I need b not to be zero' and 'I guarantee the result is correct.' The compiler holds you to them.",
    example: 'fn divide(a: Int, b: Int) -> Int\n  requires: b != 0\n{\n  return a / b;\n}\n\nio.println(divide(10, 2));',
    keywords: ["requires", "ensures", "fn"]
  }
];

var conceptSections = [
  { id: "getting-started", title: "Getting Started", icon: "🚀" },
  { id: "making-decisions", title: "Making Decisions", icon: "🧠" },
  { id: "building-blocks", title: "Building Blocks", icon: "🧱" },
  { id: "handling-complexity", title: "Handling Complexity", icon: "🔧" }
];

var expandedCardId = null;

function populateSyntaxPanel() {
  var container = document.querySelector('.syntax-content');
  if (!container) return;

  container.innerHTML = '';

  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'concept-search';
  searchInput.placeholder = 'Search concepts...';
  searchInput.addEventListener('input', function () {
    filterConcepts(this.value);
  });
  container.appendChild(searchInput);

  var grid = document.createElement('div');
  grid.className = 'concept-grid';
  grid.id = 'conceptGrid';

  conceptSections.forEach(function (section) {
    var sectionConcepts = concepts.filter(function (c) { return c.section === section.id; });
    if (sectionConcepts.length === 0) return;

    var secTitle = document.createElement('div');
    secTitle.className = 'concept-section-title';
    secTitle.innerHTML = '<span class="section-icon">' + section.icon + '</span>' + section.title;
    grid.appendChild(secTitle);

    sectionConcepts.forEach(function (concept) {
      var card = buildConceptCard(concept);
      grid.appendChild(card);
    });
  });

  container.appendChild(grid);
}

function buildConceptCard(concept) {
  var card = document.createElement('div');
  card.className = 'concept-card';
  card.id = 'concept-' + concept.id;
  card.setAttribute('data-search', (concept.name + ' ' + concept.metaphor + ' ' + concept.keywords.join(' ')).toLowerCase());

  var header = document.createElement('div');
  header.className = 'concept-card-header';
  header.addEventListener('click', function () {
    toggleCard(concept.id);
  });

  var icon = document.createElement('span');
  icon.className = 'concept-card-icon';
  icon.textContent = concept.icon;

  var textCol = document.createElement('div');
  textCol.className = 'concept-card-text';

  var name = document.createElement('div');
  name.className = 'concept-card-name';
  name.textContent = concept.name;

  var metaphor = document.createElement('div');
  metaphor.className = 'concept-card-metaphor-short';
  metaphor.textContent = concept.metaphor;

  textCol.appendChild(name);
  textCol.appendChild(metaphor);

  header.appendChild(icon);
  header.appendChild(textCol);

  var body = document.createElement('div');
  body.className = 'concept-card-body';

  var fullMetaphor = document.createElement('p');
  fullMetaphor.className = 'concept-card-metaphor-full';
  fullMetaphor.textContent = concept.metaphor;
  body.appendChild(fullMetaphor);

  var codeBlock = document.createElement('pre');
  codeBlock.className = 'concept-card-code';
  codeBlock.innerHTML = highlightCode(concept.example);
  body.appendChild(codeBlock);

  var tags = document.createElement('div');
  tags.className = 'concept-card-tags';
  concept.keywords.forEach(function (kw) {
    var tag = document.createElement('span');
    tag.className = 'concept-tag';
    tag.textContent = kw;
    tags.appendChild(tag);
  });
  body.appendChild(tags);

  var tryBtn = document.createElement('button');
  tryBtn.className = 'concept-card-try';
  tryBtn.textContent = 'Try It →';
  tryBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    loadExample(concept);
  });
  body.appendChild(tryBtn);

  card.appendChild(header);
  card.appendChild(body);

  return card;
}

function toggleCard(conceptId) {
  var card = document.getElementById('concept-' + conceptId);
  if (!card) return;

  var isExpanding = !card.classList.contains('expanded');

  var allCards = document.querySelectorAll('.concept-card.expanded');
  allCards.forEach(function (c) {
    c.classList.remove('expanded');
  });

  if (isExpanding) {
    card.classList.add('expanded');
    expandedCardId = conceptId;
  } else {
    expandedCardId = null;
  }
}

function loadExample(concept) {
  var ed = getActiveEditor();
  if (ed) {
    ed.setValue(concept.example);
  }
  toggleSyntax();
}

function filterConcepts(query) {
  var q = query.toLowerCase().trim();
  var grid = document.getElementById('conceptGrid');
  if (!grid) return;

  var cards = grid.querySelectorAll('.concept-card');
  var titles = grid.querySelectorAll('.concept-section-title');
  var anyVisible = false;

  cards.forEach(function (card) {
    var search = card.getAttribute('data-search') || '';
    if (q === '' || search.indexOf(q) >= 0) {
      card.style.display = '';
      anyVisible = true;
    } else {
      card.style.display = 'none';
    }
  });

  titles.forEach(function (title) {
    var next = title.nextElementSibling;
    var hasVisible = false;
    var sibling = next;
    while (sibling && !sibling.classList.contains('concept-section-title')) {
      if (sibling.classList.contains('concept-card') && sibling.style.display !== 'none') {
        hasVisible = true;
      }
      sibling = sibling.nextElementSibling;
    }
    title.style.display = hasVisible ? '' : 'none';
  });
}

function highlightCode(code) {
  var escaped = String(code)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  escaped = escaped.replace(/(\/\/.*$)/gm, '<span class="code-comment">$1</span>');

  escaped = escaped.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="code-string">$1</span>');

  var keywords = /\b(fn|return|let|var|const|if|elif|else|match|while|for|in|type|enum|struct|interface|derive|module|use|pub|as|unsafe|extern|requires|ensures|invariant|spawn|async|await|comptime|true|false|self|Some|None|Ok|Err|is|and|or|not|where|Option|Result|Vec|Str|Int|Bool|Float64)\b/g;
  escaped = escaped.replace(keywords, '<span class="code-keyword">$1</span>');

  escaped = escaped.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-number">$1</span>');

  escaped = escaped.replace(/(&&|[|]{2}|[+\-*/%=<>!]=?|->|=>|::|\.|\?|&|[|^~]|<<|>>)/g, '<span class="code-operator">$1</span>');

  return escaped;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
