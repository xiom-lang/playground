// Collatz trajectory -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// From n: if even halve it, if odd triple it and add one. The timeline shows
// every value until the sequence reaches 1.
use xiom.io;

fn main() {
  var x = 27;
  io.println("v1|init|n=" + x.to_str() + "|step=init"); // @step init

  var steps = 0;
  var peak = x;
  io.println("v1|point|v=" + x.to_str() + "|step=point"); // @step point
  while x != 1 {
    if x % 2 == 0 {
      x = x / 2;
    } else {
      x = 3 * x + 1;
    };
    steps += 1;
    if x > peak { peak = x; };
    io.println("v1|point|v=" + x.to_str() + "|step=point"); // @step point
  };
  io.println("v1|done|result=" + steps.to_str() + "|peak=" + peak.to_str() + "|step=done"); // @step done
}
