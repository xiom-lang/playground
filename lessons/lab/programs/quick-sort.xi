// Quick Sort -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Lomuto partition: the last element is the pivot, smaller values move to
// the front, then the pivot lands in its final place and both sides recurse.
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

fn qsort(v: &mut Vec[Int], lo: Int, hi: Int) {
  if lo < hi {
    let pivot = v.get(hi).unwrap();
    io.println("v1|mark|i=" + hi.to_str() + "|role=pivot|step=pivot"); // @step pivot
    var i = lo;
    var j = lo;
    while j < hi {
      let a = v.get(j).unwrap();
      io.println("v1|compare|i=" + j.to_str() + "|j=" + hi.to_str() + "|step=compare"); // @step compare
      if a <= pivot {
        if i != j {
          let b = v.get(i).unwrap();
          v.set(i, a);
          v.set(j, b);
          io.println("v1|swap|i=" + i.to_str() + "|j=" + j.to_str() + "|step=swap"); // @step swap
        };
        i += 1;
      };
      j += 1;
    };
    let b = v.get(i).unwrap();
    v.set(i, pivot);
    v.set(hi, b);
    io.println("v1|swap|i=" + i.to_str() + "|j=" + hi.to_str() + "|step=place"); // @step place
    io.println("v1|mark|i=" + i.to_str() + "|role=sorted|step=sorted"); // @step sorted
    qsort(v, lo, i - 1);
    qsort(v, i + 1, hi);
  } else {
    if lo == hi {
      io.println("v1|mark|i=" + lo.to_str() + "|role=sorted|step=sorted"); // @step sorted
    };
  };
}

fn main() {
  var v: Vec[Int] = Vec[Int].new();
  v.push(6); v.push(3); v.push(9); v.push(1);
  v.push(8); v.push(2); v.push(7); v.push(4);
  v.push(10); v.push(5);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init

  let last = v.len() - 1;
  qsort(&mut v, 0, last);
  io.println("v1|done|result=" + join_ints(&v) + "|step=done"); // @step done
}
