// Dijkstra -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Grow the set of settled nodes from the source; every relaxation lowers a
// neighbour's distance label (the numbers on the nodes) until nothing can
// be improved.
use xiom.io;

fn main() {
  let nodes = 6;
  var fromV: Vec[Int] = Vec[Int].new();
  var toV: Vec[Int] = Vec[Int].new();
  var weightV: Vec[Int] = Vec[Int].new();

  fromV.push(0); toV.push(1); weightV.push(7);
  fromV.push(1); toV.push(0); weightV.push(7);
  fromV.push(0); toV.push(2); weightV.push(9);
  fromV.push(2); toV.push(0); weightV.push(9);
  fromV.push(0); toV.push(5); weightV.push(14);
  fromV.push(5); toV.push(0); weightV.push(14);
  fromV.push(1); toV.push(2); weightV.push(10);
  fromV.push(2); toV.push(1); weightV.push(10);
  fromV.push(1); toV.push(3); weightV.push(15);
  fromV.push(3); toV.push(1); weightV.push(15);
  fromV.push(2); toV.push(3); weightV.push(11);
  fromV.push(3); toV.push(2); weightV.push(11);
  fromV.push(2); toV.push(5); weightV.push(2);
  fromV.push(5); toV.push(2); weightV.push(2);
  fromV.push(3); toV.push(4); weightV.push(6);
  fromV.push(4); toV.push(3); weightV.push(6);
  fromV.push(4); toV.push(5); weightV.push(9);
  fromV.push(5); toV.push(4); weightV.push(9);

  io.println("v1|init|n=6|edges=0-1-7,0-2-9,0-5-14,1-2-10,1-3-15,2-3-11,2-5-2,3-4-6,4-5-9|step=init"); // @step init

  var dist: Vec[Int] = Vec[Int].new();
  var visited: Vec[Int] = Vec[Int].new();
  var parent: Vec[Int] = Vec[Int].new();
  var i = 0;
  while i < nodes {
    dist.push(999);
    visited.push(0);
    parent.push(-1);
    i += 1;
  };
  dist.set(0, 0);
  io.println("v1|set|id=0|v=0|step=start"); // @step start
  io.println("v1|mark|id=0|role=start|step=start"); // @step start
  io.println("v1|mark|id=5|role=target|step=goal"); // @step goal

  var settled = 0;
  while settled < nodes {
    var u = -1;
    var best = 1000;
    i = 0;
    while i < nodes {
      if visited.get(i).unwrap() == 0 && dist.get(i).unwrap() < best {
        best = dist.get(i).unwrap();
        u = i;
      };
      i += 1;
    };
    if u < 0 {
      settled = nodes;
    } else {
      visited.set(u, 1);
      io.println("v1|mark|id=" + u.to_str() + "|role=sorted|step=visit"); // @step visit
      if parent.get(u).unwrap() >= 0 {
        io.println("v1|edge|a=" + parent.get(u).unwrap().to_str() + "|b=" + u.to_str() + "|role=tree|step=visit"); // @step visit
      };
      var e = 0;
      while e < fromV.len() {
        if fromV.get(e).unwrap() == u {
          let v = toV.get(e).unwrap();
          let w = weightV.get(e).unwrap();
          if visited.get(v).unwrap() == 0 {
            let candidate = dist.get(u).unwrap() + w;
            if candidate < dist.get(v).unwrap() {
              dist.set(v, candidate);
              parent.set(v, u);
              io.println("v1|set|id=" + v.to_str() + "|v=" + candidate.to_str() + "|step=relax"); // @step relax
              io.println("v1|edge|a=" + u.to_str() + "|b=" + v.to_str() + "|role=relax|step=relax"); // @step relax
            };
          };
        };
        e += 1;
      };
      settled += 1;
    };
  };
  io.println("v1|done|result=" + dist.get(5).unwrap().to_str() + "|step=done"); // @step done
}
