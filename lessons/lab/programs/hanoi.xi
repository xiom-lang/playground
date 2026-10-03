// Towers of Hanoi -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// The recursion tree: every call is a node, and a node's move happens between
// its two child subtrees. Move disk n from peg "from" to peg "to" using the
// spare peg.
use xiom.io;

type Builder = {
  next: Int;
}

fn hanoi(b: &mut Builder, n: Int, from: Int, to: Int, via: Int, parent: Int) {
  let id = b.next;
  b.next += 1;
  io.println("v1|node|id=" + id.to_str() + "|parent=" + parent.to_str() +
             "|v=" + n.to_str() + "|from=" + from.to_str() + "|to=" + to.to_str() +
             "|step=node"); // @step node
  if n > 1 {
    hanoi(b, n - 1, from, via, to, id);
    io.println("v1|mark|id=" + id.to_str() + "|role=move|from=" + from.to_str() +
               "|to=" + to.to_str() + "|step=move"); // @step move
    hanoi(b, n - 1, via, to, from, id);
  } else {
    if n == 1 {
      io.println("v1|mark|id=" + id.to_str() + "|role=move|from=" + from.to_str() +
                 "|to=" + to.to_str() + "|step=move"); // @step move
    };
  };
}

fn main() {
  var b = Builder{ next: 0 };
  io.println("v1|init|n=3|step=init"); // @step init
  hanoi(&mut b, 3, 1, 3, 2, -1);
  io.println("v1|done|result=" + b.next.to_str() + "|step=done"); // @step done
}
