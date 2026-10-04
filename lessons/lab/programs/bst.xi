// Binary Search Tree -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Insert each value by walking left or right from the root, then walk the
// tree in order: the marks light up the values in sorted order.
use xiom.io;

fn inorder(id: Int, lefts: &Vec[Int], rights: &Vec[Int]) {
  if id >= 0 {
    inorder(lefts.get(id).unwrap(), lefts, rights);
    io.println("v1|mark|id=" + id.to_str() + "|role=sorted|step=sorted"); // @step sorted
    inorder(rights.get(id).unwrap(), lefts, rights);
  };
}

fn main() {
  var vals: Vec[Int] = Vec[Int].new();
  var lefts: Vec[Int] = Vec[Int].new();
  var rights: Vec[Int] = Vec[Int].new();

  vals.push(50); lefts.push(-1); rights.push(-1);
  io.println("v1|init|n=7|step=init"); // @step init
  io.println("v1|node|id=0|parent=-1|v=50|step=insert"); // @step insert

  var inputs: Vec[Int] = Vec[Int].new();
  inputs.push(30); inputs.push(70); inputs.push(20);
  inputs.push(40); inputs.push(60); inputs.push(80);

  var next = 1;
  var k = 0;
  while k < inputs.len() {
    let value = inputs.get(k).unwrap();
    var cur = 0;
    var parent = -1;
    var placed = false;
    while !placed {
      parent = cur;
      io.println("v1|mark|id=" + cur.to_str() + "|role=cursor|step=walk"); // @step walk
      let here = vals.get(cur).unwrap();
      if value < here {
        let nextLeft = lefts.get(cur).unwrap();
        if nextLeft < 0 {
          lefts.set(cur, next);
          placed = true;
        } else {
          cur = nextLeft;
        };
      } else {
        let nextRight = rights.get(cur).unwrap();
        if nextRight < 0 {
          rights.set(cur, next);
          placed = true;
        } else {
          cur = nextRight;
        };
      };
    };
    vals.push(value); lefts.push(-1); rights.push(-1);
    io.println("v1|node|id=" + next.to_str() + "|parent=" + parent.to_str() + "|v=" + value.to_str() + "|step=insert"); // @step insert
    next += 1;
    k += 1;
  };

  inorder(0, &lefts, &rights);
  io.println("v1|done|result=" + next.to_str() + "|step=done"); // @step done
}
