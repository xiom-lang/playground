// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
/**
 * Content patches for lessons that need more than mechanical transforms:
 * contracts moved onto signatures, Str.get -> char_at, HashSet API, modules
 * requiring pub, and a handful of rewritten solutions with missing returns.
 *
 * Applied by tools/migrate-lessons.js to `solution` and `code_template`.
 */
'use strict';

module.exports = {
  patches: {
    // Modules: functions must be pub to be callable through the module path.
    'L6-08': [
      ['  fn hello(name: Str) -> Str {', '  pub fn hello(name: Str) -> Str {'],
      ['  fn goodbye(name: Str) -> Str {', '  pub fn goodbye(name: Str) -> Str {'],
    ],

    // Re-exports are not supported by the current compiler: call nested modules.
    'L6-20': [
      ['  // TODO: re-export trim_spaces and count_chars\n  pub use cleaner::trim_spaces;\n  pub use counter::count_chars;\n', '  // Re-exports are not supported by the current compiler; call through the nested modules.\n'],
      ['  pub use cleaner::trim_spaces;\n  pub use counter::count_chars;\n', '  // Re-exports are not supported by the current compiler; call through the nested modules.\n'],
      ['  let count = text_tools.count_chars("Hello");\n  io.println(count.to_str());', '  let trimmed = text_tools.cleaner.trim_spaces("  Hello  ");\n  let count = text_tools.counter.count_chars("Hello");\n  io.println(trimmed.to_str());\n  io.println(count.to_str());'],
    ],

    // Contracts belong on the function signature.
    'L6-22': [
      ['  // TODO: fn fibonacci that returns the nth fibonacci number\n  requires { n >= 0; }\n  pub fn fibonacci(n: Int) -> Int {', '  // TODO: fn fibonacci that returns the nth fibonacci number\n  pub fn fibonacci(n: Int) -> Int\n    requires: n >= 0\n  {'],
      ['  requires { n >= 0; }\n  pub fn fibonacci(n: Int) -> Int {', '  pub fn fibonacci(n: Int) -> Int\n    requires: n >= 0\n  {'],
    ],
    'L6-24': [
      ['requires { n >= 1; }\nfn is_even(n: Int) -> Bool {', 'fn is_even(n: Int) -> Bool\n  requires: n >= 1\n{'],
    ],
    'L7-05': [
      ['requires { n >= 0; }\nfn factorial(n: Int) -> Int {', 'fn factorial(n: Int) -> Int\n  requires: n >= 0\n{'],
      ['  // TODO: compute n! iteratively\n  // Hint: result starts at 1, multiply by 2,3,4...n\n}', '  // TODO: compute n! iteratively\n  // Hint: result starts at 1, multiply by 2,3,4...n\n  return 1;\n}'],
    ],
    'L8-06': [
      ['requires { amount > 0; }\nfn deposit(acc: &mut Account, amount: Int) {', 'fn deposit(acc: &mut Account, amount: Int)\n  requires: amount > 0\n{'],
      ['requires { amount > 0; }\nrequires { acc.balance >= amount; }\nfn withdraw(acc: &mut Account, amount: Int) -> Bool {', 'fn withdraw(acc: &mut Account, amount: Int) -> Bool\n  requires: amount > 0\n  requires: acc.balance >= amount\n{'],
    ],
    'L8-13': [
      ['requires { subtotal >= 0; }\nfn apply_discount(subtotal: Int) -> Int {', 'fn apply_discount(subtotal: Int) -> Int\n  requires: subtotal >= 0\n{'],
      ['fn calculate_total(cart: &Cart) -> Int {\n  // TODO: sum all item prices in the cart\n}', 'fn calculate_total(cart: &Cart) -> Int {\n  // TODO: sum all item prices in the cart\n  return 0;\n}'],
      ['fn apply_discount(subtotal: Int) -> Int\n  requires: subtotal >= 0\n{\n  // TODO: if subtotal >= 5000 (cents, i.e. $50), return 10% off\n}', 'fn apply_discount(subtotal: Int) -> Int\n  requires: subtotal >= 0\n{\n  // TODO: if subtotal >= 5000 (cents, i.e. $50), return 10% off\n  return 0;\n}'],
    ],

    // Fixed array type syntax: [Str; 3] -> [3]Str; str_to_float -> to_float_from_str.
    'L3-46': [
      ['fn cart_total(prices: [Str; 3]) -> Result[Float64, Str] {', 'fn cart_total(prices: [3]Str) -> Result[Float64, Str] {'],
      ['string.str_to_float(', 'to_float_from_str('],
    ],

    // Invariant placement and Str containment.
    'L4-30': [
      ['type Account = {\n  owner: Str;\n  balance: Float64;\n}\n  invariant: this.balance >= 0.0;', 'type Account = {\n  owner: Str;\n  balance: Float64;\n  invariant: balance >= 0.0;\n}'],
    ],
    'L4-43': [
      ['type PositiveInt = Int\n  invariant: this > 0;', 'type PositiveInt = {\n  value: Int;\n  invariant: value > 0;\n}'],
      ['invariant: address.contains("@");', 'invariant: string.str_index_of(address, "@") != None;'],
      ['invariant: address.contains(".");', 'invariant: string.str_index_of(address, ".") != None;'],
    ],

    // Vec/Str access and Option constructors.
    'L6-07': [
      ['use xiom.io;\ninterface Validator {', 'use xiom.io;\nuse xiom.string;\ninterface Validator {'],
      ['return self.address.contains("@") & self.address.contains(".");', 'return string.str_index_of(self.address, "@") != None and string.str_index_of(self.address, ".") != None;'],
    ],
    'L6-40': [
      ['var runner: plugin_runner.Runner[EchoPlugin] = plugin_runner.create();', 'var runner = plugin_runner.create();'],
    ],

    // clone() on Str fields currently yields the wrong type; pass the value.
    'L7-39': [
      ['text: item.text.clone(), done: true', 'text: item.text, done: true'],
    ],
    'L8-03': [
      ['fn look(rooms: &Vec[Room], player: &AdventurePlayer) -> Str {\n  let room = rooms.get(player.room_id).unwrap();\n  room.name.clone()\n}', 'fn look(rooms: &Vec[Room], player: &AdventurePlayer) -> Str {\n  let room = rooms.get(player.room_id).unwrap();\n  room.name\n}'],
    ],
    'L8-07': [
      ['title: book.title.clone(), is_available: false', 'title: book.title, is_available: false'],
      ['title: book.title.clone(), is_available: true', 'title: book.title, is_available: true'],
    ],
    'L8-09': [
      ['results.push(RecipeCard{ name: card.name.clone(), servings: card.servings, cook_time: card.cook_time });', 'results.push(RecipeCard{ name: card.name, servings: card.servings, cook_time: card.cook_time });'],
    ],

    // Random range via the math module; if-expression braces.
    'L8-11': [
      ['  let d1 = random.range(1, 7);\n  let d2 = random.range(1, 7);\n  let d3 = random.range(1, 7);', '  let d1 = math.random_range(1, 7);\n  let d2 = math.random_range(1, 7);\n  let d3 = math.random_range(1, 7);'],
      ['use xiom.io;\nenum CharacterClass {', 'use xiom.io;\nuse xiom.math;\nenum CharacterClass {'],
    ],
    'L8-12': [
      ['  let high = base_temp + random.range(-5, 6);\n  let low = high - random.range(3, 9);\n  let cond = if high > 25\n    { Weather.Sunny }\n    else if high > 15\n    { Weather.Cloudy }\n    else if high > 5\n    { Weather.Rainy }\n    else { Weather.Snowy };', '  let high = base_temp + math.random_range(-5, 6);\n  let low = high - math.random_range(3, 9);\n  let cond = if high > 25 { Weather.Sunny }\n    else if high > 15 { Weather.Cloudy }\n    else if high > 5 { Weather.Rainy }\n    else { Weather.Snowy };'],
      ['use xiom.io;\nenum Weather {', 'use xiom.io;\nuse xiom.math;\nenum Weather {'],
    ],

    // Numeric conversions and streaming prints.
    'L1-26': [
      ['use xiom.io;\nfn item_total', 'use xiom.io;\nuse xiom.convert;\nfn item_total'],
      ['return price * qty;', 'return price * (qty as Float64);'],
      ['return "$" + amount;', 'return "$" + convert.float_to_string(amount);'],
    ],
    'L3-38': [
      ['let a = math.random_int(1, 10);\n  let b = math.random_int(1, 10);', 'let a = math.random_range(1, 11);\n  let b = math.random_range(1, 11);'],
      ['return Err("Wrong, the answer was " + correct);', 'return Err("Wrong, the answer was " + to_string(correct));'],
    ],
    'L7-04': [
      ['io.print(product);', 'io.print(to_string(product));'],
    ],

    // Result-returning main for the ? operator.
    'L3-33': [
      ['fn main() -> Int {\n  let db = get_required("db_url")?;\n  let api = get_required("api_key")?;\n  match get_required("missing_key") {\n    Ok(_) => { return 500; }\n    Err(_) => { return 200; }\n  }\n}', 'fn main() -> Result[Int, Str] {\n  let db = get_required("db_url")?;\n  let api = get_required("api_key")?;\n  match get_required("missing_key") {\n    Ok(_) => { return Ok(500); }\n    Err(_) => { return Ok(200); }\n  }\n}'],
    ],

    // `continue` is a statement in current XIOM; the None arm is unreachable
    // while the index is in range, but keep the loop safe if it is ever hit.
    'L5-34': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L5-40': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L5-41': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L5-42': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L5-44': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L5-50': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L6-05': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L6-14': [['None => continue', 'None => { i = i + 1; continue; }']],
    'L6-15': [['None => continue', 'None => { i = i + 1; continue; }']],

    // Str has no get(); char_at returns Char directly.
    'L6-23': [['s.get(i).unwrap()', 's.char_at(i)']],
    'L6-25': [['s.get(i).unwrap()', 's.char_at(i)']],
    'L7-11': [['s.get(left).unwrap()', 's.char_at(left)'], ['s.get(right).unwrap()', 's.char_at(right)']],
    'L7-12': [['text.get(i).unwrap()', 'text.char_at(i)']],
    'L7-13': [['text.get(i).unwrap()', 'text.char_at(i)']],
    'L7-14': [['game.display.get(i).unwrap()', 'game.display.char_at(i)']],
    'L7-16': [['text.get(j).unwrap()', 'text.char_at(j)']],
    'L7-17': [['text.get(i + j).unwrap()', 'text.char_at(i + j)'], ['pattern.get(j).unwrap()', 'pattern.char_at(j)']],
    'L7-18': [['phrase.get(i).unwrap()', 'phrase.char_at(i)'], ['current.get(0).unwrap()', 'current.char_at(0)']],
    'L7-19': [['pool.get(idx).unwrap()', 'pool.char_at(idx)']],
    'L7-28': [['word.get(j).unwrap()', 'word.char_at(j)']],
    'L8-04': [['game.word.get(i).unwrap()', 'game.word.char_at(i)'], ['game.display.get(i).unwrap()', 'game.display.char_at(i)']],
    'L8-14': [
      ['letters.get(i).unwrap()', 'letters.char_at(i)'],
      ['word.get(i).unwrap()', 'word.char_at(i)'],
      ['morse_str.get(i).unwrap()', 'morse_str.char_at(i)'],
      ['morse.get(ch)', 'morse.get(to_string_char(ch))'],
      ['use xiom.io;\nfn build_morse_map', 'use xiom.io;\nuse xiom.convert.tostring;\nfn build_morse_map'],
    ],
    'L8-17': [['word.get(i).unwrap()', 'word.char_at(i)'], ['word.get(0).unwrap()', 'word.char_at(0)']],

    // Unicode escape and Float64/Str mixing in the data showcase.
    'L2-40': [
      ['use xiom.io;\n\ntype Song', 'use xiom.io;\nuse xiom.convert;\n\ntype Song'],
      ['return (duration_secs as Float64) / 60.0;', 'return (self.duration_secs as Float64) / 60.0;'],
      ['return "Sunny, " + temp + "\\u00b0C";', 'return "Sunny, " + convert.float_to_string(temp) + "\\u{00B0}C";'],
      ['return "Cloudy, " + cov + "% coverage";', 'return "Cloudy, " + to_string(cov) + "% coverage";'],
      ['return "Rain, " + mm + "mm/hr";', 'return "Rain, " + convert.float_to_string(mm) + "mm/hr";'],
    ],

    // Nested module types need a constructor (qualified struct literals do not
    // unify with the module-local type in the current compiler).
    'L6-31': [
      ['    pub fn promote(s: &mut Student) {\n      s.grade += 1;\n    }', '    pub fn new_student(name: Str, grade: Int) -> Student {\n      Student{ name: name, grade: grade }\n    }\n\n    pub fn promote(s: &mut Student) {\n      s.grade += 1;\n    }', 'pub fn new_student'],
      ['    pub fn is_full(c: &Course) -> Bool {\n      c.enrolled >= c.capacity\n    }', '    pub fn new_course(name: Str, enrolled: Int, capacity: Int) -> Course {\n      Course{ name: name, enrolled: enrolled, capacity: capacity }\n    }\n\n    pub fn is_full(c: &Course) -> Bool {\n      c.enrolled >= c.capacity\n    }', 'pub fn new_course'],
      ['var s = school.students.Student{ name: "Alex", grade: 9 };', 'var s = school.students.new_student("Alex", 9);'],
      ['let c = school.courses.Course{ name: "Math", enrolled: 25, capacity: 30 };', 'let c = school.courses.new_course("Math", 25, 30);'],
    ],

    // Re-exports are unsupported; call through the nested module paths.
    'L6-32': [
      ['  pub use player::play_track as play;\n  pub use player::pause;\n  pub use library::add_song as library_add;\n', '  // Re-exports are not supported by the current compiler; call through the nested modules.\n'],
      ['  music.play("Bohemian Rhapsody");\n  music.pause();\n  music.library_add("New Song");', '  music.player.play_track("Bohemian Rhapsody");\n  music.player.pause();\n  music.library.add_song("New Song");'],
    ],

    // clone() on struct values currently yields the wrong type; index copies.
    'L7-23': [
      ['let card = deck.get(last).unwrap().clone();', 'let card = deck[last];'],
    ],

    // else-if chains in expressions use elif.
    'L8-12': [
      ['    else if high > 15 { Weather.Cloudy }\n    else if high > 5 { Weather.Rainy }', '    elif high > 15 { Weather.Cloudy }\n    elif high > 5 { Weather.Rainy }'],
    ],

    // The None arm in main is not inside a loop; fall back to an empty group.
    'L5-40': [
      ['  let age_25 = match groups.get(&25) { Some(g) => g, None => { i = i + 1; continue; } };', '  let age_25 = match groups.get(&25) { Some(g) => g, None => Vec[Str].new() };'],
    ],

    // Builtin generic type aliases break method resolution; use Map directly.
    'L5-50': [
      ['type Row = Map[Str, Str];\n\n', ''],
      ['rows: Vec[Row];', 'rows: Vec[Map[Str, Str]];'],
      ['return Table{ name: name, rows: Vec[Row].new() };', 'return Table{ name: name, rows: Vec[Map[Str, Str]].new() };'],
      ['fn Table.insert(t: &mut Table, row: Row) {', 'fn Table.insert(t: &mut Table, row: Map[Str, Str]) {'],
      ['fn Table.find_by(t: &Table, column: Str, value: Str) -> Vec[Row] {', 'fn Table.find_by(t: &Table, column: Str, value: Str) -> Vec[Map[Str, Str]] {'],
      ['  let matched: Vec[Row] = Vec[Row].new();', '  let matched: Vec[Map[Str, Str]] = Vec[Map[Str, Str]].new();'],
      ['    let row = match t.rows.get(i) { Some(r) => r, None => { i = i + 1; continue; } };', '    let row = t.rows[i];'],
      ['    let cell = match row.get(&column) { Some(v) => v, None => "" };', '    let cell = match row.get(column) { Some(v) => v, None => "" };'],
      ['  let r1: Row = Map[Str, Str].new();', '  var r1: Map[Str, Str] = Map[Str, Str].new();'],
      ['  let r2: Row = Map[Str, Str].new();', '  var r2: Map[Str, Str] = Map[Str, Str].new();'],
      ['  db.insert(&mut db, r1);', '  db.insert(r1);'],
      ['  db.insert(&mut db, r2);', '  db.insert(r2);'],
      ['  let apples = db.find_by(&db, "item", "apple");', '  let apples = db.find_by("item", "apple");'],
      ['  io.println(to_string(db.count(&db)));', '  io.println(to_string(db.count()));'],
    ],

    // Generic total(): unwrap the first element instead of returning an
    // undefined result, and mutate the accumulator.
    'L6-05': [
      ['  let result = match items.get(0) { Some(v) => v, None => return result };', '  var result = items.get(0).unwrap();'],
    ],

    // Vec of Str values: char_at does not apply; decode compares Char.
    'L8-14': [
      ['    let ch = letters.char_at(i);', '    let ch = letters.get(i).unwrap();'],
      ['    let code = morse.get(to_string_char(ch)).unwrap();', '    let code = morse.get(ch).unwrap();'],
      ['    if ch == " " {', "    if ch == ' ' {"],
      ['      token = token + ch;', '      token = token + to_string_char(ch);'],
    ],

    // Random range and Char to Str conversions.
    'L8-17': [
      ['use xiom.io;\nfn build_word_list', 'use xiom.io;\nuse xiom.math;\nuse xiom.convert.tostring;\nfn build_word_list'],
      ['random.range(', 'math.random_range('],
      ['    chars.push(word.char_at(i));', '    chars.push(to_string_char(word.char_at(i)));'],
      ['  hint = hint + word.char_at(0);', '  hint = hint + to_string_char(word.char_at(0));'],
    ],
  },

  // Solutions that needed a full rewrite (missing returns, char handling).
  solutions: {
    'L1-39': `use xiom.io;
use xiom.string;
use xiom.convert.tostring;

fn encrypt(ch: Char) -> Char {
  if ch == 'z' {
    return 'a';
  } elif ch == 'Z' {
    return 'A';
  } elif ch >= 'a' and ch <= 'y' {
    return to_char((ch as Int) + 1);
  } elif ch >= 'A' and ch <= 'Y' {
    return to_char((ch as Int) + 1);
  } else {
    return ch;
  }
}

fn encrypt_word(word: Str) -> Str {
  let len = string.str_len(word);
  var result = "";
  var i = 0;
  while i < len {
    let shifted = encrypt(word[i]);
    result = string.str_concat(result, to_string_char(shifted));
    i = i + 1;
  }
  return result;
}

fn main() {
  let secret = encrypt_word("hello");
  io.println(secret);
}
`,
    'L1-40': `use xiom.io;
use xiom.string;
use xiom.convert.tostring;

fn display_word(word: Str, guessed: Str) -> Str {
  let len = string.str_len(word);
  var result = "";
  var i = 0;
  while i < len {
    let ch = word[i];
    var found = false;
    var j = 0;
    let guess_len = string.str_len(guessed);
    while j < guess_len {
      if ch == guessed[j] {
        found = true;
      }
      j = j + 1;
    }
    if found {
      result = string.str_concat(result, to_string_char(ch));
    } else {
      result = string.str_concat(result, "_");
    }
    i = i + 1;
  }
  return result;
}

fn main() {
  let word = "python";
  let display1 = display_word(word, "");
  let display2 = display_word(word, "o");
  let display3 = display_word(word, "op");
  io.println(display1);
  io.println(display2);
  io.println(display3);
}
`,
    'L1-47': `use xiom.io;
use xiom.string;
use xiom.convert.tostring;

fn count_char(text: Str, ch: Char) -> Int {
  let len = string.str_len(text);
  var count = 0;
  var i = 0;
  while i < len {
    if text[i] == ch {
      count = count + 1;
    }
    i = i + 1;
  }
  return count;
}

fn reverse(text: Str) -> Str {
  let len = string.str_len(text);
  var result = "";
  var i = len - 1;
  while i >= 0 {
    result = string.str_concat(result, to_string_char(text[i]));
    i = i - 1;
  }
  return result;
}

fn is_blank(text: Str) -> Bool {
  let len = string.str_len(text);
  var i = 0;
  while i < len {
    if text[i] != ' ' {
      return false;
    }
    i = i + 1;
  }
  return true;
}

fn starts_with_hello(text: Str) -> Bool {
  let len = string.str_len(text);
  if len < 5 {
    return false;
  }
  return text[0] == 'H' and text[1] == 'e' and text[2] == 'l' and text[3] == 'l' and text[4] == 'o';
}

fn remove_spaces(text: Str) -> Str {
  let len = string.str_len(text);
  var result = "";
  var i = 0;
  while i < len {
    if text[i] != ' ' {
      result = string.str_concat(result, to_string_char(text[i]));
    }
    i = i + 1;
  }
  return result;
}

fn main() {
  let sample = "Hello World";
  let count_l = count_char(sample, 'l');
  let rev = reverse(sample);
  let blank = is_blank("   ");
  let starts = starts_with_hello(sample);
  let no_spaces = remove_spaces(sample);
  io.println("String library tested!");
}
`,
    'L1-50': `use xiom.io;
use xiom.math;
use xiom.string;
use xiom.convert.tostring;

fn factorial(n: Int) -> Int {
  if n < 0 {
    return 0;
  }
  var result = 1;
  var i = 1;
  while i <= n {
    result = result * i;
    i = i + 1;
  }
  return result;
}

fn sum_to(n: Int) -> Int {
  if n < 1 {
    return 0;
  }
  var total = 0;
  var i = 1;
  while i <= n {
    total = total + i;
    i = i + 1;
  }
  return total;
}

fn reverse(text: Str) -> Str {
  let len = string.str_len(text);
  var result = "";
  var i = len - 1;
  while i >= 0 {
    result = string.str_concat(result, to_string_char(text[i]));
    i = i - 1;
  }
  return result;
}

fn count_vowels(text: Str) -> Int {
  let len = string.str_len(text);
  var count = 0;
  var i = 0;
  while i < len {
    let ch = text[i];
    if ch == 'a' or ch == 'e' or ch == 'i' or ch == 'o' or ch == 'u' {
      count = count + 1;
    }
    i = i + 1;
  }
  return count;
}

fn is_palindrome(text: Str) -> Bool {
  let len = string.str_len(text);
  var left = 0;
  var right = len - 1;
  while left < right {
    if text[left] != text[right] {
      return false;
    }
    left = left + 1;
    right = right - 1;
  }
  return true;
}

fn is_leap_year(year: Int) -> Bool {
  if year % 400 == 0 {
    return true;
  }
  if year % 100 == 0 {
    return false;
  }
  if year % 4 == 0 {
    return true;
  }
  return false;
}

fn roll_dice() -> Int {
  return math.random_range(1, 7);
}

fn random_fortune() -> Str {
  let fortunes = ["Good luck!", "Stay curious.", "Keep coding!", "You will succeed.", "Adventure awaits."];
  let idx = math.random_range(0, 5);
  return fortunes[idx];
}

fn main() {
  io.println("========================================");
  io.println("  L1 CAPSTONE: MY PERSONAL TOOLBOX");
  io.println("========================================");
  io.println("--- Math Tools ---");
  let fact5 = factorial(5);
  let sum100 = sum_to(100);
  io.println("--- String Tools ---");
  let rev = reverse("XIOM");
  let vowels = count_vowels("education");
  io.println("--- Boolean Tools ---");
  let pal = is_palindrome("racecar");
  let leap = is_leap_year(2024);
  io.println("--- Random Tools ---");
  let dice = roll_dice();
  let fortune = random_fortune();
  io.println("========================================");
  io.println("  TOOLBOX SHOWCASE COMPLETE!");
  io.println("========================================");
}
`,
    'L5-14': `use xiom.io;
use xiom.collect.hashset;

fn main() -> Int {
  var lucky_numbers = hashset_new();
  hashset_insert(&mut lucky_numbers, 7);
  hashset_insert(&mut lucky_numbers, 13);
  hashset_insert(&mut lucky_numbers, 7);
  hashset_insert(&mut lucky_numbers, 42);

  io.println(hashset_contains(&lucky_numbers, 7).to_str());
  io.println(hashset_contains(&lucky_numbers, 8).to_str());

  hashset_remove(&mut lucky_numbers, 13);
  io.println(hashset_contains(&lucky_numbers, 13).to_str());

  return 0;
}
`,
    'L6-15': `use xiom.io;
module models {
  pub type Note = {
    content: Str;
    category: Str;
  }

  pub fn new_note(content: Str, category: Str) -> Note {
    return Note{ content: content, category: category };
  }
}

module storage {
  pub type Notebook = {
    notes: Vec[models.Note];
  }

  pub fn new_notebook() -> Notebook {
    return Notebook{ notes: Vec[models.Note].new() };
  }

  pub fn Notebook.add_note(&mut self, content: Str, category: Str) {
    self.notes.push(models.new_note(content, category));
  }

  pub fn Notebook.count(self) -> Int {
    return self.notes.len();
  }

  pub fn count_by_category(notebook: &Notebook, cat: Str) -> Int {
    var count = 0;
    var i = 0;
    while i < notebook.notes.len() {
      let note = notebook.notes[i];
      if note.category == cat {
        count = count + 1;
      }
      i = i + 1;
    }
    return count;
  }
}

fn main() -> Int {
  var nb = storage.new_notebook();
  nb.add_note("Buy milk", "personal");
  nb.add_note("Fix bug", "work");
  nb.add_note("Call mom", "personal");

  io.println(to_string(storage.count_by_category(&nb, "personal")));
  return 0;
}
`,
  },
};
