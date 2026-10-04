// Insertion Sort -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Grow a sorted left region one item at a time: take the next key, shift the
// larger items right, then drop the key into the gap.
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
  io.println("v1|mark|i=0|role=sorted|step=sorted"); // @step sorted
  var i = 1;
  while i < n {
    let key = v.get(i).unwrap();
    io.println("v1|mark|i=" + i.to_str() + "|role=key|step=key"); // @step key
    var j = i - 1;
    var placed = false;
    while j >= 0 && !placed {
      let cur = v.get(j).unwrap();
      io.println("v1|compare|i=" + j.to_str() + "|j=" + i.to_str() + "|step=compare"); // @step compare
      if cur > key {
        v.set(j + 1, cur);
        io.println("v1|set|i=" + (j + 1).to_str() + "|v=" + cur.to_str() + "|step=shift"); // @step shift
        j -= 1;
      } else {
        placed = true;
      };
    };
    v.set(j + 1, key);
    io.println("v1|set|i=" + (j + 1).to_str() + "|v=" + key.to_str() + "|step=place"); // @step place
    io.println("v1|mark|i=" + i.to_str() + "|role=sorted|step=sorted"); // @step sorted
    i += 1;
  };
  io.println("v1|done|result=" + join_ints(&v) + "|step=done"); // @step done
}
