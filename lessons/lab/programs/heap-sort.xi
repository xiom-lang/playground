// Heap Sort -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Build a max-heap in the array, then repeatedly move the root (the largest
// value) to the end and sift the new root back down.
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

fn sift(v: &mut Vec[Int], rootStart: Int, end: Int) {
  var root = rootStart;
  var done = false;
  while !done {
    let childBase = root * 2 + 1;
    if childBase <= end {
      var child = childBase;
      if child + 1 <= end {
        let left = v.get(child).unwrap();
        let right = v.get(child + 1).unwrap();
        if left < right { child = child + 1; };
      };
      let a = v.get(root).unwrap();
      let b = v.get(child).unwrap();
      io.println("v1|compare|i=" + root.to_str() + "|j=" + child.to_str() + "|step=compare"); // @step compare
      if a < b {
        v.set(root, b);
        v.set(child, a);
        io.println("v1|swap|i=" + root.to_str() + "|j=" + child.to_str() + "|step=swap"); // @step swap
        root = child;
      } else {
        done = true;
      };
    } else {
      done = true;
    };
  };
}

fn main() {
  var v: Vec[Int] = Vec[Int].new();
  v.push(6); v.push(3); v.push(9); v.push(1);
  v.push(8); v.push(2); v.push(7); v.push(4);
  v.push(10); v.push(5);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init

  let n = v.len();
  var start = (n - 2) / 2;
  while start >= 0 {
    sift(&mut v, start, n - 1);
    start -= 1;
  };

  var end = n - 1;
  while end > 0 {
    let a = v.get(0).unwrap();
    let b = v.get(end).unwrap();
    v.set(0, b);
    v.set(end, a);
    io.println("v1|swap|i=0|j=" + end.to_str() + "|step=extract"); // @step extract
    io.println("v1|mark|i=" + end.to_str() + "|role=sorted|step=sorted"); // @step sorted
    sift(&mut v, 0, end - 1);
    end -= 1;
  };
  io.println("v1|mark|i=0|role=sorted|step=sorted"); // @step sorted
  io.println("v1|done|result=" + join_ints(&v) + "|step=done"); // @step done
}
