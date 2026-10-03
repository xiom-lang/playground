// Euclid's GCD -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Write each division step as a table row: a, b, and a mod b. The last
// non-zero remainder is the greatest common divisor.
use xiom.io;

fn main() {
  var a = 1071;
  var b = 462;
  io.println("v1|init|rows=0|cols=3|labels=a,b,remainder|step=init"); // @step init

  var r = 0;
  while b != 0 {
    let rem = a % b;
    io.println("v1|set|r=" + r.to_str() + "|c=0|v=" + a.to_str() + "|step=show"); // @step show
    io.println("v1|set|r=" + r.to_str() + "|c=1|v=" + b.to_str() + "|step=show"); // @step show
    io.println("v1|set|r=" + r.to_str() + "|c=2|v=" + rem.to_str() + "|step=compute"); // @step compute
    io.println("v1|mark|r=" + r.to_str() + "|c=2|role=current|step=compute"); // @step compute
    a = b;
    b = rem;
    r += 1;
  };
  io.println("v1|set|r=" + r.to_str() + "|c=0|v=" + a.to_str() + "|step=result"); // @step result
  io.println("v1|set|r=" + r.to_str() + "|c=1|v=0|step=result"); // @step result
  io.println("v1|done|result=" + a.to_str() + "|step=done"); // @step done
}
