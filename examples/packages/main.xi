// XIOM -- offline package example (C3)
//
// Uses two signed registry packages with no network access:
//   xiom.hello -> hello.greeting() / hello.greet(name)
//   xiom.csv   -> csv.csv_parse() / csv_write_row() / csv_is_rectangular()
//
// The playground copies the sources of every imported package into the
// submission's work directory; see packages/README.md and DEPLOY.md.

use xiom.io;
use xiom.hello;
use xiom.csv;

fn main() -> Int {
  io.println(hello.greeting());
  io.println(hello.greet("Playground"));

  let rows: Vec[Vec[Str]] = csv.csv_parse("name,age\nAda,36\nGrace,45\n");
  io.println("rows: " + rows.len().to_str());

  let i = 0;
  while i < rows.len() {
    let row = rows[i];
    io.println(csv.csv_write_row(&row));
    i = i + 1;
  }

  io.println("rectangular: " + (csv.csv_is_rectangular(&rows)).to_str());
  return 0;
}
