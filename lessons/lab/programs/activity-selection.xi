// Activity Selection -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Intervals sorted by finish time: take an activity whenever it starts at or
// after the last one ends. Row 2 records the choice.
use xiom.io;

fn main() {
  let n = 11;
  var starts: Vec[Int] = Vec[Int].new();
  starts.push(1); starts.push(3); starts.push(0); starts.push(5);
  starts.push(3); starts.push(5); starts.push(6); starts.push(8);
  starts.push(8); starts.push(2); starts.push(12);
  var ends: Vec[Int] = Vec[Int].new();
  ends.push(4); ends.push(5); ends.push(6); ends.push(7);
  ends.push(9); ends.push(9); ends.push(10); ends.push(11);
  ends.push(12); ends.push(14); ends.push(16);

  io.println("v1|init|rows=3|cols=11|rowlabels=start,end,selected|labels=0,1,2,3,4,5,6,7,8,9,10|step=init"); // @step init

  var i = 0;
  while i < n {
    io.println("v1|set|r=0|c=" + i.to_str() + "|v=" + starts.get(i).unwrap().to_str() + "|step=table"); // @step table
    io.println("v1|set|r=1|c=" + i.to_str() + "|v=" + ends.get(i).unwrap().to_str() + "|step=table"); // @step table
    i += 1;
  };

  var lastEnd = 0;
  var count = 0;
  i = 0;
  while i < n {
    io.println("v1|mark|r=0|c=" + i.to_str() + "|role=current|step=scan"); // @step scan
    let start = starts.get(i).unwrap();
    let end = ends.get(i).unwrap();
    if start >= lastEnd {
      lastEnd = end;
      count += 1;
      io.println("v1|set|r=2|c=" + i.to_str() + "|v=1|step=take"); // @step take
      io.println("v1|mark|r=2|c=" + i.to_str() + "|role=path|step=take"); // @step take
    } else {
      io.println("v1|set|r=2|c=" + i.to_str() + "|v=0|step=skip"); // @step skip
    };
    i += 1;
  };
  io.println("v1|done|result=" + count.to_str() + "|step=done"); // @step done
}
