// Huffman Coding -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Repeatedly merge the two lightest nodes; the tree that grows gives every
// letter a prefix code whose length follows its frequency. Leaves show the
// letter, internal nodes show the merged weight.
use xiom.io;

fn main() {
  var weights: Vec[Int] = Vec[Int].new();
  weights.push(5); weights.push(9); weights.push(12);
  weights.push(13); weights.push(16); weights.push(45);
  var letters: Vec[Str] = Vec[Str].new();
  letters.push("A"); letters.push("B"); letters.push("C");
  letters.push("D"); letters.push("E"); letters.push("F");
  let leaves = weights.len();

  var vals: Vec[Int] = Vec[Int].new();
  var lefts: Vec[Int] = Vec[Int].new();
  var rights: Vec[Int] = Vec[Int].new();
  var alive: Vec[Int] = Vec[Int].new();
  var labels: Vec[Str] = Vec[Str].new();
  var i = 0;
  while i < leaves {
    vals.push(weights.get(i).unwrap());
    lefts.push(-1);
    rights.push(-1);
    alive.push(1);
    labels.push(letters.get(i).unwrap());
    i += 1;
  };

  var next = leaves;
  var remaining = leaves;
  while remaining > 1 {
    var min1 = -1;
    var min2 = -1;
    i = 0;
    while i < next {
      if alive.get(i).unwrap() == 1 {
        if min1 < 0 || vals.get(i).unwrap() < vals.get(min1).unwrap() {
          min2 = min1;
          min1 = i;
        } else {
          if min2 < 0 || vals.get(i).unwrap() < vals.get(min2).unwrap() { min2 = i; };
        };
      };
      i += 1;
    };
    vals.push(vals.get(min1).unwrap() + vals.get(min2).unwrap());
    lefts.push(min1);
    rights.push(min2);
    alive.push(1);
    labels.push(vals.get(next).unwrap().to_str());
    alive.set(min1, 0);
    alive.set(min2, 0);
    next += 1;
    remaining -= 1;
  };

  var parents: Vec[Int] = Vec[Int].new();
  i = 0;
  while i < next { parents.push(-1); i += 1; };
  i = 0;
  while i < next {
    let l = lefts.get(i).unwrap();
    let r = rights.get(i).unwrap();
    if l >= 0 { parents.set(l, i); };
    if r >= 0 { parents.set(r, i); };
    i += 1;
  };

  var total = 0;
  i = 0;
  while i < leaves {
    var depth = 0;
    var cur = i;
    while parents.get(cur).unwrap() >= 0 {
      depth += 1;
      cur = parents.get(cur).unwrap();
    };
    total += weights.get(i).unwrap() * depth;
    i += 1;
  };

  io.println("v1|init|n=" + next.to_str() + "|step=init"); // @step init
  i = 0;
  while i < next {
    io.println("v1|node|id=" + i.to_str() + "|parent=" + parents.get(i).unwrap().to_str() +
               "|v=" + vals.get(i).unwrap().to_str() + "|label=" + labels.get(i).unwrap() + "|step=build"); // @step build
    i += 1;
  };
  io.println("v1|done|result=" + total.to_str() + "|step=done"); // @step done
}
