// KMP pattern search -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Build the failure table once, then scan the text without ever moving the
// text pointer backwards: on a mismatch the pattern falls back to its
// longest border. Letters are codes (A=1, B=2, C=3, D=4).
use xiom.io;

fn main() {
  var text: Vec[Int] = Vec[Int].new();
  text.push(1); text.push(2); text.push(1); text.push(2); text.push(4);
  text.push(1); text.push(2); text.push(1); text.push(3); text.push(4);
  text.push(1); text.push(2); text.push(1); text.push(2); text.push(3);

  var pattern: Vec[Int] = Vec[Int].new();
  pattern.push(1); pattern.push(2); pattern.push(1); pattern.push(2); pattern.push(3);
  let m = pattern.len();

  // Failure table: longest proper border of each prefix.
  var lps: Vec[Int] = Vec[Int].new();
  var z = 0;
  while z < m { lps.push(0); z += 1; };
  var len = 0;
  var k = 1;
  while k < m {
    if pattern.get(k).unwrap() == pattern.get(len).unwrap() {
      len += 1;
      lps.set(k, len);
      k += 1;
    } else {
      if len > 0 {
        len = lps.get(len - 1).unwrap();
      } else {
        lps.set(k, 0);
        k += 1;
      };
    };
  };

  var join = "";
  z = 0;
  while z < text.len() {
    if z > 0 { join = join + ","; };
    join = join + text.get(z).unwrap().to_str();
    z += 1;
  };
  io.println("v1|init|vals=" + join + "|step=init"); // @step init

  var i = 0;
  var j = 0;
  var foundAt = -1;
  var searching = true;
  while searching && i < text.len() {
    io.println("v1|mark|i=" + i.to_str() + "|role=i|step=align"); // @step align
    let a = text.get(i).unwrap();
    let b = pattern.get(j).unwrap();
    io.println("v1|compare|a=" + a.to_str() + "|b=" + b.to_str() + "|step=check"); // @step check
    if a == b {
      i += 1;
      j += 1;
      if j == m {
        foundAt = i - m;
        searching = false;
        io.println("v1|mark|i=" + foundAt.to_str() + "|role=found|step=found"); // @step found
      };
    } else {
      if j > 0 {
        j = lps.get(j - 1).unwrap();
        io.println("v1|mark|i=" + i.to_str() + "|role=fallback|step=fallback"); // @step fallback
      } else {
        i += 1;
      };
    };
  };
  io.println("v1|done|result=" + foundAt.to_str() + "|step=done"); // @step done
}
