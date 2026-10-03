// Linear Search -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Check every cell from left to right until the target value is found.
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
  v.push(1); v.push(3); v.push(5); v.push(7);
  v.push(9); v.push(11); v.push(13); v.push(15);
  v.push(17); v.push(19); v.push(21); v.push(23);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init
  io.println("v1|mark|i=6|role=target|step=target"); // @step target

  let target = 13;
  let n = v.len();
  var i = 0;
  var found = false;
  while i < n && !found {
    io.println("v1|mark|i=" + i.to_str() + "|role=cursor|step=cursor"); // @step cursor
    let x = v.get(i).unwrap();
    io.println("v1|compare|a=" + x.to_str() + "|b=" + target.to_str() + "|step=compare"); // @step compare
    if x == target {
      io.println("v1|mark|i=" + i.to_str() + "|role=found|step=found"); // @step found
      found = true;
    } else {
      i += 1;
    };
  };
  if found {
    io.println("v1|done|result=" + i.to_str() + "|step=done"); // @step done
  } else {
    io.println("v1|done|result=-1|step=done"); // @step done
  };
}
