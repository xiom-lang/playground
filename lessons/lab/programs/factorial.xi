// Factorial -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Recursion builds a call stack: every call pushes a frame, the base case
// returns 1, and each frame multiplies on the way back up.
use xiom.io;

fn fact(n: Int) -> Int {
  io.println("v1|call|fn=fact|n=" + n.to_str() + "|step=call"); // @step call
  if n <= 1 {
    io.println("v1|ret|fn=fact|v=1|step=base"); // @step base
    return 1;
  };
  let sub = fact(n - 1);
  let result = n * sub;
  io.println("v1|ret|fn=fact|v=" + result.to_str() + "|step=return"); // @step return
  result
}

fn main() {
  io.println("v1|init|n=6|step=init"); // @step init
  let r = fact(6);
  io.println("v1|done|result=" + r.to_str() + "|step=done"); // @step done
}
