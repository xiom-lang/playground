// Counting Sort -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Phase 1 counts how often each value occurs (the counts table is indexed by
// value). Phase 2 clears the table and rewrites the values in order. Same
// ten values as the other sorts, so it can race them in compare mode.
use xiom.io;

fn main() {
  var input: Vec[Int] = Vec[Int].new();
  input.push(6); input.push(3); input.push(9); input.push(1); input.push(8);
  input.push(2); input.push(7); input.push(4); input.push(10); input.push(5);

  var counts: Vec[Int] = Vec[Int].new();
  var k = 0;
  while k < 11 { counts.push(0); k += 1; };

  io.println("v1|init|rows=1|cols=11|rowlabels=counts|labels=0,1,2,3,4,5,6,7,8,9,10|step=init"); // @step init

  var i = 0;
  while i < input.len() {
    let value = input.get(i).unwrap();
    let seen = counts.get(value).unwrap() + 1;
    counts.set(value, seen);
    io.println("v1|set|r=0|c=" + value.to_str() + "|v=" + seen.to_str() + "|step=count"); // @step count
    i += 1;
  };

  io.println("v1|clear|step=rewrite"); // @step rewrite
  io.println("v1|init|rows=1|cols=10|rowlabels=sorted|labels=0,1,2,3,4,5,6,7,8,9|step=rewrite"); // @step rewrite

  var pos = 0;
  var value = 0;
  while value < 11 {
    var left = counts.get(value).unwrap();
    while left > 0 {
      io.println("v1|set|r=0|c=" + pos.to_str() + "|v=" + value.to_str() + "|step=place"); // @step place
      pos += 1;
      left -= 1;
    };
    value += 1;
  };
  io.println("v1|done|result=" + pos.to_str() + "|step=done"); // @step done
}
