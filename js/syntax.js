// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
var concepts = [
  // -- First Steps --
  { id: "program", name: "What is a Program?", icon: "\uD83D\uDCDD", section: "first-steps", metaphor: "A program is like a recipe. You write steps, the computer follows them in order.", example: "fn main() {\n  io.println(\"Step 1: Hello!\");\n  io.println(\"Step 2: Goodbye!\");\n}", keywords: ["fn", "main", "io.println"], lessonId: "L0-01" },
  { id: "printing", name: "Showing Output", icon: "\uD83D\uDDA8\uFE0F", section: "first-steps", metaphor: "`io.println` is how your program talks to you -- like writing a note on the screen.", example: "fn main() {\n  io.println(\"Welcome!\");\n  io.println(42);\n  io.println(\"Nice to meet you!\");\n}", keywords: ["io.println", "io.print", "strings"], lessonId: "L0-02" },
  { id: "variables", name: "Named Boxes", icon: "\uD83D\uDCE6", section: "first-steps", metaphor: "A variable is like a labeled box -- `let` creates it, you put something inside, and the name helps you find it later.", example: "fn main() {\n  let name = \"Alex\";\n  let age = 14;\n  io.println(name);\n  io.println(age);\n}", keywords: ["let", "var", "type inference"], lessonId: "L0-04" },
  { id: "numbers", name: "Working with Numbers", icon: "\uD83D\uDD22", section: "first-steps", metaphor: "The computer is a super-fast calculator -- you can add, subtract, multiply, and divide with ease.", example: "fn main() {\n  let price = 12;\n  let quantity = 3;\n  let total = price * quantity;\n  io.println(total);\n}", keywords: ["Int", "Float64", "arithmetic"], lessonId: "L0-03" },
  { id: "booleans", name: "True or False", icon: "\uD83D\uDCA1", section: "first-steps", metaphor: "A boolean is like a light switch -- it is either ON (true) or OFF (false), nothing in between.", example: "fn main() {\n  let is_raining = true;\n  let age = 14;\n  io.println(age > 10);\n  io.println(is_raining);\n}", keywords: ["Bool", "true", "false", "=="], lessonId: "L0-07" },
  { id: "strings", name: "Working with Text", icon: "\uD83D\uDD24", section: "first-steps", metaphor: "Text in programming is called a string -- like beads on a string of letters. Use quotes to wrap them.", example: "fn main() {\n  let greeting = \"Hello\";\n  let name = \"World\";\n  let message = string.str_concat(greeting, \" \");\n  message = string.str_concat(message, name);\n  io.println(message);\n}", keywords: ["Str", "string.str_len", "string.str_concat"], lessonId: "L0-06" },

  // -- Functions --
  { id: "functions", name: "Reusable Recipes", icon: "\uD83C\uDF73", section: "functions", metaphor: "A function is a named recipe -- write it once, call it many times with different ingredients (parameters).", example: "fn greet(name: Str) {\n  io.println(\"Hi, \" + name + \"!\");\n}\nfn main() {\n  greet(\"Alice\");\n  greet(\"Bob\");\n}", keywords: ["fn", "parameters", "call"], lessonId: "L1-01" },
  { id: "return-values", name: "Functions That Return", icon: "\uD83C\uDF6A", section: "functions", metaphor: "A function with a return value is like a vending machine -- you put something in (parameters), it gives something back.", example: "fn double(x: Int) -> Int {\n  return x * 2;\n}\nfn main() {\n  let result = double(5);\n  io.println(result);\n}", keywords: ["return", "->", "Int"], lessonId: "L1-03" },
  { id: "void-functions", name: "Functions With No Return", icon: "\uD83D\uDCE3", section: "functions", metaphor: "Some functions just do things without handing back a value -- like a bell that rings but doesn't give you anything.", example: "fn announce(message: Str) {\n  io.println(\"ANNOUNCEMENT: \" + string.str_upper(message));\n}\nfn main() {\n  announce(\"lunch time\");\n}", keywords: ["void", "side effect", "fn"], lessonId: "L1-07" },
  { id: "composition", name: "Calling Functions from Functions", icon: "\uD83D\uDD17", section: "functions", metaphor: "Functions can call other functions -- like a head chef delegating tasks to sous chefs.", example: "fn add(a: Int, b: Int) -> Int { return a + b; }\nfn double_sum(x: Int, y: Int) -> Int { return add(x, y) * 2; }\nfn main() { io.println(double_sum(3, 4)); }", keywords: ["composition", "delegation", "helper"], lessonId: "L1-08" },
  { id: "function-patterns", name: "Common Function Patterns", icon: "\uD83E\uDDE9", section: "functions", metaphor: "Function patterns are like kitchen techniques -- once you know them, you can cook anything.", example: "fn is_even(n: Int) -> Bool { return n % 2 == 0; }\nfn classify(n: Int) -> Str {\n  if n > 0 { return \"positive\"; }\n  elif n < 0 { return \"negative\"; }\n  else { return \"zero\"; }\n}\nfn main() { io.println(classify(-5)); }", keywords: ["patterns", "Bool return", "classification"], lessonId: "L1-37" },

  // -- Data & Types --
  { id: "structs", name: "Custom Blueprints", icon: "\uD83C\uDFD7\uFE0F", section: "data-types", metaphor: "A struct is a blueprint for a custom box -- you decide what fields go inside, like designing a form.", example: "type Person = {\n  name: Str;\n  age: Int;\n}\nfn main() {\n  let me = Person{ name: \"Alex\"; age: 14; };\n  io.println(me.name);\n}", keywords: ["type", "struct", "fields"], lessonId: "L2-01" },
  { id: "enums", name: "This or That", icon: "\uD83D\uDEA6", section: "data-types", metaphor: "An enum lets you pick from a fixed set of choices -- like a traffic light that can only be Red, Yellow, or Green.", example: "enum TrafficLight { Red, Yellow, Green }\nfn describe(light: TrafficLight) -> Str {\n  if light == TrafficLight.Red { return \"Stop!\"; }\n  elif light == TrafficLight.Green { return \"Go!\"; }\n  else { return \"Slow down.\"; }\n}\nfn main() { io.println(describe(TrafficLight.Green)); }", keywords: ["enum", "variant", "choice"], lessonId: "L2-11" },
  { id: "option", name: "Something or Nothing", icon: "\uD83C\uDF81", section: "data-types", metaphor: "Option is like looking in a drawer -- either you find something (Some) or it is empty (None). No more null.", example: "fn divide_safely(a: Int, b: Int) -> Option[Int] {\n  if b == 0 { return None; }\n  else { return Some(a / b); }\n}\nfn main() {\n  let result = divide_safely(10, 2).unwrap_or(0);\n  io.println(result);\n}", keywords: ["Option", "Some", "None", "unwrap_or"], lessonId: "L3-01" },
  { id: "result", name: "Success or Failure", icon: "\uD83C\uDFC6", section: "data-types", metaphor: "Result is like a delivery -- either you get the package (Ok) or an explanation of why not (Err).", example: "fn parse_age(s: Str) -> Result[Int, Str] {\n  let val = string.str_to_int(s);\n  match val {\n    Ok(n) => { return Ok(n); },\n    Err(_) => { return Err(\"Not a number!\"); },\n  }\n}\nfn main() {\n  let age = parse_age(\"14\").unwrap_or(0);\n  io.println(age);\n}", keywords: ["Result", "Ok", "Err", "?"], lessonId: "L3-07" },
  { id: "vec", name: "Lists of Things", icon: "\uD83D\uDCD1", section: "data-types", metaphor: "A Vec is like a shopping list that can grow -- you add items one by one, and it expands to fit.", example: "fn main() {\n  let items: Vec[Str] = Vec[Str].new();\n  items.push(\"apples\");\n  items.push(\"bananas\");\n  io.println(items.len());\n}", keywords: ["Vec", "push", "pop", "len"], lessonId: "L5-01" },
  { id: "map-set", name: "Dictionaries & Sets", icon: "\uD83D\uDCC7", section: "data-types", metaphor: "A Map is like a phone book (name -> number). A Set is like a stamp collection (no duplicates allowed).", example: "fn main() {\n  let scores: Map[Str,Int] = Map[Str,Int].new();\n  scores.insert(\"Alice\", 95);\n  let alice_score = scores.get(&\"Alice\").unwrap_or(0);\n  io.println(alice_score);\n}", keywords: ["Map", "Set", "insert", "get"], lessonId: "L5-09" },

  // -- Pattern Power --
  { id: "match", name: "Pattern Matching", icon: "\uD83D\uDD0E", section: "pattern-power", metaphor: "Match is like a multi-way fork in the road -- you describe each possible path, and the compiler makes sure you covered them all.", example: "fn grade(score: Int) -> Str {\n  match score {\n    s if s >= 90 => \"A\",\n    s if s >= 80 => \"B\",\n    s if s >= 70 => \"C\",\n    _ => \"F\",\n  }\n}\nfn main() { io.println(grade(85)); }", keywords: ["match", "=>", "exhaustive", "guard"], lessonId: "L3-20" },
  { id: "if-let", name: "If Let Pattern", icon: "\uD83C\uDFAF", section: "pattern-power", metaphor: "If let is a shortcut -- 'if this box has something inside, use it, otherwise do something else.'", example: "fn main() {\n  let maybe_name: Option[Str] = Some(\"Alex\");\n  if let Some(name) = maybe_name {\n    io.println(\"Hello, \" + name);\n  } else {\n    io.println(\"No name found.\");\n  }\n}", keywords: ["if let", "Some", "pattern"], lessonId: "L3-04" },
  { id: "error-handling", name: "Handling Errors Gracefully", icon: "\uD83D\uDEE0\uFE0F", section: "pattern-power", metaphor: "The ? operator is like a trapdoor -- if something goes wrong, you exit immediately with the error instead of crashing.", example: "fn process(value: Str) -> Result[Int, Str] {\n  let num = string.str_to_int(value)?;\n  if num < 0 { return Err(\"Negative numbers not allowed.\"); }\n  return Ok(num * 2);\n}\nfn main() {\n  let result = process(\"5\").unwrap_or(0);\n  io.println(result);\n}", keywords: ["?", "Result", "error propagation"], lessonId: "L3-12" },
  { id: "decisions", name: "Making Decisions", icon: "\uD83E\uDDE0", section: "pattern-power", metaphor: "if/elif/else is like choosing what to wear -- check the weather, pick the right outfit.", example: "fn main() {\n  let temperature = 15;\n  let is_raining = false;\n  if temperature > 25 { io.println(\"Wear shorts!\"); }\n  elif temperature > 10 { io.println(\"Wear a jacket.\"); }\n  else { io.println(\"Wear a coat!\"); }\n}", keywords: ["if", "elif", "else", "while"], lessonId: "L0-08" },

  // -- XIOM Magic --
  { id: "contracts", name: "Promises to the Compiler", icon: "\uD83E\uDD1D", section: "xiom-magic", metaphor: "Contracts are pinky promises to the compiler -- 'I need b not to be zero' and 'I guarantee the result is correct.' The compiler holds you to them.", example: "fn divide(a: Float64, b: Float64) -> Float64\n  requires: b != 0.0\n  ensures: result * b == a\n{\n  return a / b;\n}\nfn main() { io.println(divide(12.0, 4.0)); }", keywords: ["requires", "ensures", "contract"], lessonId: "L4-01" },
  { id: "invariants", name: "Rules That Never Break", icon: "\uD83D\uDEE1\uFE0F", section: "xiom-magic", metaphor: "An invariant is like a safety railing -- no matter what happens to your data, this rule must always be true.", example: "type Health = {\n  current: Int;\n  maximum: Int;\n  invariant: current >= 0;\n  invariant: current <= maximum;\n}\nfn main() { let hp = Health{ current: 100; maximum: 100; }; io.println(hp.current); }", keywords: ["invariant", "type", "safety"], lessonId: "L4-06" },
  { id: "ownership", name: "Who Owns What", icon: "\uD83D\uDCD6", section: "xiom-magic", metaphor: "Ownership is like a library book -- only one person can have it at a time. When you give it away, you no longer have it.", example: "fn consume(v: Vec[Int]) { /* v is gone after this */ }\nfn main() {\n  let a = 42;\n  let b = a;  // a moves to b\n  io.println(b);\n}", keywords: ["ownership", "move", "scope"], lessonId: "L4-11" },
  { id: "borrowing", name: "Borrowing, Not Copying", icon: "\uD83D\uDC49", section: "xiom-magic", metaphor: "Instead of photocopying a whole book, just point to it. & creates a reference -- you borrow access without making a copy.", example: "fn print_vec(v: &Vec[Int]) {\n  io.println(v.len());\n}\nfn main() {\n  let numbers: Vec[Int] = Vec[Int].new();\n  numbers.push(1);\n  print_vec(&numbers);\n  io.println(numbers.len());\n}", keywords: ["&", "&mut", "borrow", "reference"], lessonId: "L4-15" },
  { id: "safety", name: "Why XIOM is Safe", icon: "\uD83D\uDEE1\uFE0F", section: "xiom-magic", metaphor: "XIOM catches bugs at compile time -- no null crashes, no use-after-free, no data races. Fast AND safe, with zero runtime cost.", example: "fn main() {\n  // XIOM prevents:\n  // - Using a variable after it was moved\n  // - Writing to borrowed data\n  // - Breaking your contracts\n  // All checked before the program runs!\n  io.println(\"Safety by design.\");\n}", keywords: ["safety", "compile-time", "no-gc"], lessonId: "L4-21" },

  // -- Advanced --
  { id: "generics", name: "Write Once, Use Any Type", icon: "\uD83D\uDD04", section: "advanced", metaphor: "A generic is like a universal charger -- write one function that works with any type, not a different one for each.", example: "fn first[T](items: &Vec[T]) -> Option[T] {\n  if items.len() > 0 { return items.get(0); }\n  return None;\n}\nfn main() {\n  let names: Vec[Str] = Vec[Str].new();\n  names.push(\"Alice\");\n  io.println(first(&names).unwrap_or(\"None\"));\n}", keywords: ["generics", "[T]", "type parameter"], lessonId: "L5-18" },
  { id: "interfaces", name: "What a Type Can Do", icon: "\uD83E\uDD1D", section: "advanced", metaphor: "An interface is like a job description -- any type that can do the job qualifies, no matter what it actually is.", example: "interface Greetable { fn greet() -> Str; }\ntype Person = { name: Str; }\nfn Person.greet(self) -> Str { return \"Hi, I'm \" + name; }\nfn say_hello[T: Greetable](thing: &T) { io.println(thing.greet()); }\nfn main() { let p = Person{ name: \"Alex\"; }; say_hello(&p); }", keywords: ["interface", "trait", "implementation"], lessonId: "L6-01" },
  { id: "modules", name: "Organizing Code", icon: "\uD83D\uDCC2", section: "advanced", metaphor: "As your program grows, split it into modules -- like chapters in a book, each with its own purpose.", example: "module math_utils {\n  pub fn add(a: Int, b: Int) -> Int { return a + b; }\n}\nfn main() {\n  let result = math_utils.add(3, 4);\n  io.println(result);\n}", keywords: ["module", "pub", "use"], lessonId: "L6-08" },
  { id: "collections-advanced", name: "Advanced Collections", icon: "\uD83D\uDCCA", section: "advanced", metaphor: "With Vec, Map, and Set together, you can build almost any data structure -- like having a full workshop of tools.", example: "fn main() {\n  let scores: Map[Str,Int] = Map[Str,Int].new();\n  scores.insert(\"math\", 90);\n  scores.insert(\"science\", 85);\n  let tags: Set[Str] = Set[Str].new();\n  tags.insert(\"reviewed\");\n  io.println(scores.get(&\"math\").unwrap_or(0));\n}", keywords: ["Vec", "Map", "Set", "generics"], lessonId: "L5-17" }
];

var conceptSections = [
  { id: "first-steps", title: "First Steps", icon: "\uD83C\uDF31" },
  { id: "functions", title: "Functions", icon: "\uD83C\uDF7D\uFE0F" },
  { id: "data-types", title: "Data & Types", icon: "\uD83D\uDCE6" },
  { id: "pattern-power", title: "Pattern Power", icon: "\uD83D\uDD0D" },
  { id: "xiom-magic", title: "XIOM Magic", icon: "\uD83D\uDEE1\uFE0F" },
  { id: "advanced", title: "Advanced", icon: "\uD83D\uDD27" }
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

function renderMetaphor(text) {
  var escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  return escaped;
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
  metaphor.innerHTML = renderMetaphor(concept.metaphor);

  textCol.appendChild(name);
  textCol.appendChild(metaphor);

  header.appendChild(icon);
  header.appendChild(textCol);

  var body = document.createElement('div');
  body.className = 'concept-card-body';

  var fullMetaphor = document.createElement('p');
  fullMetaphor.className = 'concept-card-metaphor-full';
  fullMetaphor.innerHTML = renderMetaphor(concept.metaphor);
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
  tryBtn.textContent = 'Try It \u2192';
  tryBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    loadExample(concept);
  });
  body.appendChild(tryBtn);

  card.appendChild(header);
  card.appendChild(body);

  return card;
}

function loadExample(concept) {
  if (!window.editor && currentAppTheme === undefined) {
    // Not in lessons mode -- need to navigate there first
    if (typeof startLearning === 'function') startLearning();
    setTimeout(function () {
      _tryLoadExample(concept);
    }, 500);
    toggleSyntax();
    return;
  }
  _tryLoadExample(concept);
  toggleSyntax();
}

function _tryLoadExample(concept) {
  var ed = getActiveEditor();
  if (ed) {
    ed.setValue(concept.example);
    ed.focus();
    return;
  }
  if (window.setMobileCode) window.setMobileCode(concept.example);
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
