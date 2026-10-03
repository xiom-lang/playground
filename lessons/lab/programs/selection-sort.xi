// Selection Sort -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Repeatedly scan the unsorted tail for the smallest value and swap it into
// the next sorted position.
use xiom.io;

fn join_ints(v: &Vec[Int]) -> Str {
  var out = "";
  var i = 0;
  while i < v.len() {
    if i > 0 { out = out + ","; };
    out = out + v.get(i).unwrap().to_str();
    i += 1;
  };
  out
}

fn main() {
  var v: Vec[Int] = Vec[Int].new();
  v.push(5); v.push(3); v.push(8); v.push(1);
  v.push(9); v.push(2); v.push(7); v.push(4);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init

  let n = v.len();
  var i = 0;
  while i < n - 1 {
    var minpos = i;
    io.println("v1|mark|i=" + minpos.to_str() + "|role=minpos|step=minpos"); // @step minpos
    var j = i + 1;
    while j < n {
      io.println("v1|compare|i=" + minpos.to_str() + "|j=" + j.to_str() + "|step=compare"); // @step compare
      let best = v.get(minpos).unwrap();
      let candidate = v.get(j).unwrap();
      if candidate < best {
        minpos = j;
        io.println("v1|mark|i=" + minpos.to_str() + "|role=minpos|step=minpos"); // @step minpos
      };
      j += 1;
    };
    if minpos != i {
      let a = v.get(i).unwrap();
      let b = v.get(minpos).unwrap();
      v.set(i, b);
      v.set(minpos, a);
      io.println("v1|swap|i=" + i.to_str() + "|j=" + minpos.to_str() + "|step=swap"); // @step swap
    };
    io.println("v1|mark|i=" + i.to_str() + "|role=sorted|step=sorted"); // @step sorted
    i += 1;
  };
  io.println("v1|mark|i=" + (n - 1).to_str() + "|role=sorted|step=sorted"); // @step sorted
  io.println("v1|done|result=" + join_ints(&v) + "|step=done"); // @step done
}
