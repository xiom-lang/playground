// Binary Search -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Halve the search window on a sorted list: compare the middle cell, then
// keep the half that can still contain the target.
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
  var lo = 0;
  var hi = n - 1;
  var ans = -1;
  var found = false;
  while lo <= hi && !found {
    let mid = (lo + hi) / 2;
    io.println("v1|mark|i=" + lo.to_str() + "|role=lo|step=mark"); // @step mark
    io.println("v1|mark|i=" + hi.to_str() + "|role=hi|step=mark"); // @step mark
    io.println("v1|mark|i=" + mid.to_str() + "|role=mid|step=mark"); // @step mark
    let x = v.get(mid).unwrap();
    io.println("v1|compare|a=" + x.to_str() + "|b=" + target.to_str() + "|step=compare"); // @step compare
    if x == target {
      found = true;
      ans = mid;
      io.println("v1|mark|i=" + mid.to_str() + "|role=found|step=found"); // @step found
    } else {
      if x < target {
        lo = mid + 1;
        io.println("v1|mark|i=" + lo.to_str() + "|role=lo|step=narrow"); // @step narrow
      } else {
        hi = mid - 1;
        io.println("v1|mark|i=" + hi.to_str() + "|role=hi|step=narrow"); // @step narrow
      };
    };
  };
  io.println("v1|done|result=" + ans.to_str() + "|step=done"); // @step done
}
