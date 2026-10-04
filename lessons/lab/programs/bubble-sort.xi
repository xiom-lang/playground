// Bubble Sort -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// The program prints one trace event per line; each event carries the name of
// the @step annotation that the player highlights while it is on screen.
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
  v.push(6); v.push(3); v.push(9); v.push(1);
  v.push(8); v.push(2); v.push(7); v.push(4);
  v.push(10); v.push(5);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init

  let n = v.len();
  var i = 0;
  while i < n - 1 {
    var j = 0;
    while j < n - 1 - i {
      let a = v.get(j).unwrap();
      let b = v.get(j + 1).unwrap();
      io.println("v1|compare|i=" + j.to_str() + "|j=" + (j + 1).to_str() + "|step=compare"); // @step compare
      if a > b {
        v.set(j, b);
        v.set(j + 1, a);
        io.println("v1|swap|i=" + j.to_str() + "|j=" + (j + 1).to_str() + "|step=swap"); // @step swap
      };
      j += 1;
    };
    io.println("v1|mark|i=" + (n - 1 - i).to_str() + "|role=sorted|step=sorted"); // @step sorted
    i += 1;
  };
  io.println("v1|mark|i=0|role=sorted|step=sorted"); // @step sorted
  io.println("v1|done|result=" + join_ints(&v) + "|step=done"); // @step done
}
