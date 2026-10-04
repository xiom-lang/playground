// Topological Sort (Kahn) -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Repeatedly take a node with no remaining incoming edges, emit it, and
// drop its outgoing edges. If every node comes out, the graph has no cycle.
use xiom.io;

fn main() {
  let nodes = 6;
  var fromV: Vec[Int] = Vec[Int].new();
  var toV: Vec[Int] = Vec[Int].new();
  fromV.push(5); toV.push(2);
  fromV.push(5); toV.push(0);
  fromV.push(4); toV.push(0);
  fromV.push(4); toV.push(1);
  fromV.push(2); toV.push(3);
  fromV.push(3); toV.push(1);

  io.println("v1|init|n=6|edges=5-2,5-0,4-0,4-1,2-3,3-1|step=init"); // @step init

  var indeg: Vec[Int] = Vec[Int].new();
  var emitted: Vec[Int] = Vec[Int].new();
  var i = 0;
  while i < nodes { indeg.push(0); emitted.push(0); i += 1; };

  var e = 0;
  while e < fromV.len() {
    let target = toV.get(e).unwrap();
    indeg.set(target, indeg.get(target).unwrap() + 1);
    e += 1;
  };

  var count = 0;
  while count < nodes {
    var u = -1;
    i = 0;
    while i < nodes {
      if emitted.get(i).unwrap() == 0 && indeg.get(i).unwrap() == 0 && u < 0 {
        u = i;
      };
      i += 1;
    };
    if u < 0 {
      count = nodes;
    } else {
      emitted.set(u, 1);
      count += 1;
      io.println("v1|mark|id=" + u.to_str() + "|role=sorted|step=emit"); // @step emit
      e = 0;
      while e < fromV.len() {
        if fromV.get(e).unwrap() == u {
          let v = toV.get(e).unwrap();
          indeg.set(v, indeg.get(v).unwrap() - 1);
          io.println("v1|edge|a=" + u.to_str() + "|b=" + v.to_str() + "|role=tree|step=drop"); // @step drop
        };
        e += 1;
      };
    };
  };
  io.println("v1|done|result=" + count.to_str() + "|step=done"); // @step done
}
