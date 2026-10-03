// Linked List traversal -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// A list of nodes where each node stores the index of the next one. The
// traversal follows those links from the head until it finds the target.
use xiom.io;

fn edges_str(nexts: &Vec[Int]) -> Str {
  var out = "";
  var i = 0;
  while i < nexts.len() {
    let nxt = nexts.get(i).unwrap();
    if nxt != -1 {
      if out.len() > 0 { out = out + ","; };
      out = out + i.to_str() + "-" + nxt.to_str();
    };
    i += 1;
  };
  out
}

fn main() {
  var values: Vec[Int] = Vec[Int].new();
  values.push(10); values.push(20); values.push(30);
  values.push(40); values.push(50);
  var nexts: Vec[Int] = Vec[Int].new();
  nexts.push(1); nexts.push(2); nexts.push(3); nexts.push(4); nexts.push(-1);

  io.println("v1|init|n=" + values.len().to_str() + "|edges=" + edges_str(&nexts) + "|step=init"); // @step init

  let target = 40;
  var cur = 0;
  var found = false;
  var index = -1;
  var step = 0;
  while cur != -1 && !found {
    io.println("v1|mark|id=" + cur.to_str() + "|role=cursor|step=cursor"); // @step cursor
    io.println("v1|visit|id=" + cur.to_str() + "|step=visit"); // @step visit
    let value = values.get(cur).unwrap();
    io.println("v1|compare|a=" + value.to_str() + "|b=" + target.to_str() + "|step=compare"); // @step compare
    if value == target {
      found = true;
      index = cur;
      io.println("v1|mark|id=" + cur.to_str() + "|role=found|step=found"); // @step found
    } else {
      cur = nexts.get(cur).unwrap();
      step += 1;
    };
  };
  io.println("v1|done|result=" + index.to_str() + "|step=done"); // @step done
}
