// Sieve of Eratosthenes -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Mark every multiple of every prime, starting from p*p. What is left
// unmarked when p passes the square root is prime.
use xiom.io;

fn main() {
  let n = 50;
  let cols = 10;
  var vals = "";
  var v = 1;
  while v <= n {
    if v > 1 { vals = vals + ","; };
    vals = vals + v.to_str();
    v += 1;
  };

  var flags: Vec[Int] = Vec[Int].new();
  var k = 0;
  while k <= n { flags.push(0); k += 1; };

  io.println("v1|init|rows=5|cols=" + cols.to_str() + "|vals=" + vals + "|step=init"); // @step init

  var p = 2;
  while p <= n {
    if flags.get(p).unwrap() == 0 {
      let r = (p - 1) / cols;
      let c = (p - 1) % cols;
      io.println("v1|mark|r=" + r.to_str() + "|c=" + c.to_str() + "|role=prime|step=prime"); // @step prime
      if p * p <= n {
        var m = p * p;
        while m <= n {
          if flags.get(m).unwrap() == 0 {
            flags.set(m, 1);
            let mr = (m - 1) / cols;
            let mc = (m - 1) % cols;
            io.println("v1|mark|r=" + mr.to_str() + "|c=" + mc.to_str() + "|role=composite|step=composite"); // @step composite
          };
          m += p;
        };
      };
    };
    p += 1;
  };

  var primes = 0;
  var q = 2;
  while q <= n {
    if flags.get(q).unwrap() == 0 { primes += 1; };
    q += 1;
  };
  io.println("v1|done|result=" + primes.to_str() + "|step=done"); // @step done
}
