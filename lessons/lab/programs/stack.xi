// Stack (LIFO) -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Push a list of values onto a stack, then pop them off: the output order is
// the reverse of the input order, which is the whole point of last-in-first-out.
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
  v.push(5); v.push(3); v.push(8); v.push(1); v.push(9);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init

  var i = 0;
  while i < v.len() {
    let x = v.get(i).unwrap();
    io.println("v1|push|v=" + x.to_str() + "|step=push"); // @step push
    i += 1;
  };

  var out: Vec[Int] = Vec[Int].new();
  var k = 0;
  while k < v.len() {
    let x = v.get(v.len() - 1 - k).unwrap();
    out.push(x);
    io.println("v1|pop|v=" + x.to_str() + "|step=pop"); // @step pop
    k += 1;
  };
  io.println("v1|done|result=" + join_ints(&out) + "|step=done"); // @step done
}
