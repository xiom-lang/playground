// Radix Sort (LSD) -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Three stable counting-sort passes, one per digit (ones, tens, hundreds).
// Each pass rebuilds the array; the bars animate the write-back.
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
  v.push(170); v.push(45); v.push(75); v.push(90);
  v.push(802); v.push(24); v.push(2); v.push(66);
  io.println("v1|init|vals=" + join_ints(&v) + "|step=init"); // @step init

  var exp = 1;
  while exp <= 100 {
    if exp == 1 {
      io.println("v1|mark|i=0|role=key|step=ones"); // @step ones
    } else {
      if exp == 10 {
        io.println("v1|mark|i=1|role=key|step=tens"); // @step tens
      } else {
        io.println("v1|mark|i=2|role=key|step=hundreds"); // @step hundreds
      };
    };

    var counts: Vec[Int] = Vec[Int].new();
    var k = 0;
    while k < 10 { counts.push(0); k += 1; };

    var i = 0;
    while i < v.len() {
      let digit = (v.get(i).unwrap() / exp) % 10;
      counts.set(digit, counts.get(digit).unwrap() + 1);
      i += 1;
    };

    var prefix = 0;
    var d = 0;
    while d < 10 {
      let c = counts.get(d).unwrap();
      counts.set(d, prefix);
      prefix += c;
      d += 1;
    };

    var out: Vec[Int] = Vec[Int].new();
    i = 0;
    while i < v.len() { out.push(0); i += 1; };
    i = 0;
    while i < v.len() {
      let value = v.get(i).unwrap();
      let digit = (value / exp) % 10;
      let at = counts.get(digit).unwrap();
      out.set(at, value);
      counts.set(digit, at + 1);
      i += 1;
    };

    i = 0;
    while i < out.len() {
      let value = out.get(i).unwrap();
      v.set(i, value);
      io.println("v1|set|i=" + i.to_str() + "|v=" + value.to_str() + "|step=pass"); // @step pass
      i += 1;
    };
    exp = exp * 10;
  };
  io.println("v1|done|result=" + join_ints(&v) + "|step=done"); // @step done
}
