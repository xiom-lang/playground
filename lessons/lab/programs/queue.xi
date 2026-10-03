// Queue (FIFO) -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Enqueue jobs at the back and serve them from the front: first in, first out.
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
  var jobs: Vec[Int] = Vec[Int].new();
  jobs.push(5); jobs.push(3); jobs.push(8); jobs.push(1);
  io.println("v1|init|queue=1|vals=" + join_ints(&jobs) + "|step=init"); // @step init

  var i = 0;
  while i < jobs.len() {
    let x = jobs.get(i).unwrap();
    io.println("v1|enqueue|v=" + x.to_str() + "|step=enqueue"); // @step enqueue
    i += 1;
  };

  var out: Vec[Int] = Vec[Int].new();
  var k = 0;
  while k < jobs.len() {
    let x = jobs.get(k).unwrap();
    out.push(x);
    io.println("v1|dequeue|v=" + x.to_str() + "|step=dequeue"); // @step dequeue
    k += 1;
  };
  io.println("v1|done|result=" + join_ints(&out) + "|step=done"); // @step done
}
