// Longest Common Subsequence -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// A table over the two strings: matching characters extend the diagonal,
// otherwise the best of "drop a character from A" and "drop one from B"
// wins. The traceback marks the shared characters.
use xiom.io;
use xiom.string;

fn main() {
  let a = "ABCB";
  let b = "BDC";
  let rows = 5;
  let cols = 4;
  let lenA = 4;
  let lenB = 3;

  io.println("v1|init|rows=5|cols=4|rowlabels=_,A,B,C,B|labels=_,B,D,C|step=init"); // @step init

  var table: Vec[Int] = Vec[Int].new();
  var z = 0;
  while z < rows * cols { table.push(0); z += 1; };

  var i = 1;
  while i <= lenA {
    var j = 1;
    while j <= lenB {
      let ca = char_at(a, i - 1).unwrap();
      let cb = char_at(b, j - 1).unwrap();
      var best = 0;
      if ca == cb {
        best = table.get((i - 1) * cols + (j - 1)).unwrap() + 1;
      } else {
        let up = table.get((i - 1) * cols + j).unwrap();
        let left = table.get(i * cols + (j - 1)).unwrap();
        if up >= left { best = up; } else { best = left; };
      };
      table.set(i * cols + j, best);
      io.println("v1|set|r=" + i.to_str() + "|c=" + j.to_str() + "|v=" + best.to_str() + "|step=fill"); // @step fill
      j += 1;
    };
    i += 1;
  };

  var r = lenA;
  var c = lenB;
  while r > 0 && c > 0 {
    let ca = char_at(a, r - 1).unwrap();
    let cb = char_at(b, c - 1).unwrap();
    if ca == cb {
      io.println("v1|mark|r=" + r.to_str() + "|c=" + c.to_str() + "|role=path|step=match"); // @step match
      r -= 1;
      c -= 1;
    } else {
      let up = table.get((r - 1) * cols + c).unwrap();
      let left = table.get(r * cols + (c - 1)).unwrap();
      if up >= left { r -= 1; } else { c -= 1; };
    };
  };
  io.println("v1|done|result=" + table.get(lenA * cols + lenB).unwrap().to_str() + "|step=done"); // @step done
}
