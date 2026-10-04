// Cycle Detection -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Depth-first search in three colours: white (unseen), grey (on the current
// path), black (done). An edge back to a grey node is a cycle.
use xiom.io;

fn dfs(u: Int, fromV: &Vec[Int], toV: &Vec[Int], color: &mut Vec[Int]) -> Bool {
  color.set(u, 1);
  io.println("v1|mark|id=" + u.to_str() + "|role=cursor|step=enter"); // @step enter
  var e = 0;
  var found = false;
  while e < fromV.len() && !found {
    if fromV.get(e).unwrap() == u {
      let v = toV.get(e).unwrap();
      io.println("v1|edge|a=" + u.to_str() + "|b=" + v.to_str() + "|role=relax|step=walk"); // @step walk
      if color.get(v).unwrap() == 1 {
        io.println("v1|edge|a=" + u.to_str() + "|b=" + v.to_str() + "|role=cycle|step=back"); // @step back
        found = true;
      } else {
        if color.get(v).unwrap() == 0 {
          if dfs(v, fromV, toV, color) { found = true; };
        };
      };
    };
    e += 1;
  };
  if !found {
    color.set(u, 2);
    io.println("v1|mark|id=" + u.to_str() + "|role=sorted|step=finish"); // @step finish
  };
  found
}

fn main() {
  var fromV: Vec[Int] = Vec[Int].new();
  var toV: Vec[Int] = Vec[Int].new();
  fromV.push(0); toV.push(1);
  fromV.push(0); toV.push(2);
  fromV.push(2); toV.push(3);
  fromV.push(3); toV.push(2);

  io.println("v1|init|n=4|edges=0-1,0-2,2-3,3-2|step=init"); // @step init

  var color: Vec[Int] = Vec[Int].new();
  var i = 0;
  while i < 4 { color.push(0); i += 1; };

  var cyclic = false;
  i = 0;
  while i < 4 && !cyclic {
    if color.get(i).unwrap() == 0 {
      if dfs(i, &fromV, &toV, &mut color) { cyclic = true; };
    };
    i += 1;
  };
  if cyclic {
    io.println("v1|done|result=1|step=result"); // @step result
  } else {
    io.println("v1|done|result=0|step=result"); // @step result
  };
}
