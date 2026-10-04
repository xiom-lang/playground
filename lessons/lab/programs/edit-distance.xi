// Edit Distance -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// table[i][j] is the fewest edits (insert, delete, replace) that turn the
// first i characters of "cat" into the first j characters of "cut".
use xiom.io;
use xiom.string;

fn min3(a: Int, b: Int, c: Int) -> Int {
  var m = a;
  if b < m { m = b; };
  if c < m { m = c; };
  m
}

fn main() {
  let a = "cat";
  let b = "cut";
  let rows = 4;
  let cols = 4;
  let lenA = 3;
  let lenB = 3;

  io.println("v1|init|rows=4|cols=4|rowlabels=_,c,a,t|labels=_,c,u,t|step=init"); // @step init

  var table: Vec[Int] = Vec[Int].new();
  var z = 0;
  while z < rows * cols { table.push(0); z += 1; };

  var i = 0;
  while i <= lenA {
    table.set(i * cols, i);
    io.println("v1|set|r=" + i.to_str() + "|c=0|v=" + i.to_str() + "|step=base"); // @step base
    i += 1;
  };
  var j = 1;
  while j <= lenB {
    table.set(j, j);
    io.println("v1|set|r=0|c=" + j.to_str() + "|v=" + j.to_str() + "|step=base"); // @step base
    j += 1;
  };

  i = 1;
  while i <= lenA {
    j = 1;
    while j <= lenB {
      let ca = char_at(a, i - 1).unwrap();
      let cb = char_at(b, j - 1).unwrap();
      var cost = 1;
      if ca == cb { cost = 0; };
      let del = table.get((i - 1) * cols + j).unwrap() + 1;
      let ins = table.get(i * cols + (j - 1)).unwrap() + 1;
      let sub = table.get((i - 1) * cols + (j - 1)).unwrap() + cost;
      let best = min3(del, ins, sub);
      table.set(i * cols + j, best);
      io.println("v1|set|r=" + i.to_str() + "|c=" + j.to_str() + "|v=" + best.to_str() + "|step=fill"); // @step fill
      j += 1;
    };
    i += 1;
  };

  io.println("v1|mark|r=" + lenA.to_str() + "|c=" + lenB.to_str() + "|role=found|step=result"); // @step result
  io.println("v1|done|result=" + table.get(lenA * cols + lenB).unwrap().to_str() + "|step=done"); // @step done
}
