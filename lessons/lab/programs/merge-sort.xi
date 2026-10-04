// Merge Sort -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Split the range in half, sort each half recursively, then merge the two
// sorted halves back together. The merge writes are what the bars show.
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

fn merge(v: &mut Vec[Int], lo: Int, mid: Int, hi: Int) {
  var merged: Vec[Int] = Vec[Int].new();
  var i = lo;
  var j = mid + 1;
  while i <= mid && j <= hi {
    let a = v.get(i).unwrap();
    let b = v.get(j).unwrap();
    io.println("v1|compare|i=" + i.to_str() + "|j=" + j.to_str() + "|step=compare"); // @step compare
    if a <= b {
      merged.push(a);
      i += 1;
    } else {
      merged.push(b);
      j += 1;
    };
  };
  while i <= mid {
    merged.push(v.get(i).unwrap());
    i += 1;
  };
  while j <= hi {
    merged.push(v.get(j).unwrap());
    j += 1;
  };
  var t = 0;
  while t < merged.len() {
    let value = merged.get(t).unwrap();
    v.set(lo + t, value);
    io.println("v1|set|i=" + (lo + t).to_str() + "|v=" + value.to_str() + "|step=merge"); // @step merge
    t += 1;
  };
}

fn msort(v: &mut Vec[Int], lo: Int, hi: Int) {
  if lo < hi {
    let mid = (lo + hi) / 2;
    io.println("v1|mark|i=" + mid.to_str() + "|role=cursor|step=split"); // @step split
    msort(v, lo, mid);
    msort(v, mid + 1, hi);
    merge(v, lo, mid, hi);
  };
}

fn main() {
  var v: Vec[Int] = Vec[Int].new();
  v.push(6); v.push(3); v.push(9); v.push(1);
  v.push(8); v.push(2); v.push(7); v.push(4);
  v.push(10); v.push(5);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init

  let last = v.len() - 1;
  msort(&mut v, 0, last);

  var i = 0;
  while i < v.len() {
    io.println("v1|mark|i=" + i.to_str() + "|role=sorted|step=sorted"); // @step sorted
    i += 1;
  };
  io.println("v1|done|result=" + join_ints(&v) + "|step=done"); // @step done
}
