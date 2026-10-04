// Min-Heap build -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Every new value arrives as the last leaf and bubbles up while it is
// smaller than its parent: the tree shape follows the array indices, so
// the smallest value always ends up at the root.
use xiom.io;

fn main() {
  var inputs: Vec[Int] = Vec[Int].new();
  inputs.push(9); inputs.push(4); inputs.push(7);
  inputs.push(1); inputs.push(8); inputs.push(2);

  io.println("v1|init|n=6|step=init"); // @step init

  var vals: Vec[Int] = Vec[Int].new();
  var i = 0;
  while i < inputs.len() {
    let value = inputs.get(i).unwrap();
    vals.push(value);
    if i == 0 {
      io.println("v1|node|id=0|parent=-1|v=" + value.to_str() + "|step=insert"); // @step insert
    } else {
      let parent = (i - 1) / 2;
      io.println("v1|node|id=" + i.to_str() + "|parent=" + parent.to_str() + "|v=" + value.to_str() + "|step=insert"); // @step insert
      var child = i;
      var bubbling = true;
      while bubbling && child > 0 {
        let up = (child - 1) / 2;
        let childValue = vals.get(child).unwrap();
        let parentValue = vals.get(up).unwrap();
        io.println("v1|compare|i=" + child.to_str() + "|j=" + up.to_str() + "|step=compare"); // @step compare
        if childValue < parentValue {
          vals.set(child, parentValue);
          vals.set(up, childValue);
          io.println("v1|node|id=" + child.to_str() + "|parent=" + up.to_str() + "|v=" + parentValue.to_str() + "|step=swap"); // @step swap
          io.println("v1|node|id=" + up.to_str() + "|parent=" + ((up - 1) / 2).to_str() + "|v=" + childValue.to_str() + "|step=swap"); // @step swap
          child = up;
        } else {
          bubbling = false;
        };
      };
    };
    i += 1;
  };

  io.println("v1|mark|id=0|role=found|step=root"); // @step root
  io.println("v1|done|result=" + vals.get(0).unwrap().to_str() + "|step=done"); // @step done
}
