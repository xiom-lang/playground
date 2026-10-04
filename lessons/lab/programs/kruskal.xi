// Kruskal + Union-Find -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Sort the edges by weight and take each one whose endpoints are still in
// different sets; the union-find structure merges the sets as the minimum
// spanning tree grows. Rejected edges are dimmed.
use xiom.io;

fn find(parent: &Vec[Int], x: Int) -> Int {
  var cur = x;
  while parent.get(cur).unwrap() != cur {
    cur = parent.get(cur).unwrap();
  };
  cur
}

fn main() {
  let nodes = 6;
  var eu: Vec[Int] = Vec[Int].new();
  var ev: Vec[Int] = Vec[Int].new();
  var ew: Vec[Int] = Vec[Int].new();
  eu.push(0); ev.push(1); ew.push(4);
  eu.push(0); ev.push(2); ew.push(4);
  eu.push(1); ev.push(2); ew.push(2);
  eu.push(1); ev.push(3); ew.push(5);
  eu.push(2); ev.push(3); ew.push(5);
  eu.push(2); ev.push(4); ew.push(9);
  eu.push(3); ev.push(4); ew.push(4);
  eu.push(3); ev.push(5); ew.push(6);
  eu.push(4); ev.push(5); ew.push(7);

  io.println("v1|init|n=6|edges=0-1-4,0-2-4,1-2-2,1-3-5,2-3-5,2-4-9,3-4-4,3-5-6,4-5-7|step=init"); // @step init

  // Order the edge indices by weight (insertion sort, stable enough here).
  var order: Vec[Int] = Vec[Int].new();
  var i = 0;
  while i < ew.len() { order.push(i); i += 1; };
  i = 1;
  while i < order.len() {
    let current = order.get(i).unwrap();
    let currentWeight = ew.get(current).unwrap();
    var j = i - 1;
    var placed = false;
    while j >= 0 && !placed {
      let other = order.get(j).unwrap();
      if ew.get(other).unwrap() > currentWeight {
        order.set(j + 1, other);
        j -= 1;
      } else {
        placed = true;
      };
    };
    order.set(j + 1, current);
    i += 1;
  };

  var parent: Vec[Int] = Vec[Int].new();
  i = 0;
  while i < nodes { parent.push(i); i += 1; };

  var total = 0;
  var taken = 0;
  var k = 0;
  while k < order.len() {
    let edgeIndex = order.get(k).unwrap();
    let u = eu.get(edgeIndex).unwrap();
    let v = ev.get(edgeIndex).unwrap();
    let w = ew.get(edgeIndex).unwrap();
    let rootU = find(&parent, u);
    let rootV = find(&parent, v);
    if rootU != rootV {
      parent.set(rootU, rootV);
      total += w;
      taken += 1;
      io.println("v1|edge|a=" + u.to_str() + "|b=" + v.to_str() + "|role=tree|step=accept"); // @step accept
    } else {
      io.println("v1|edge|a=" + u.to_str() + "|b=" + v.to_str() + "|role=reject|step=skip"); // @step skip
    };
    k += 1;
  };
  io.println("v1|done|result=" + total.to_str() + "|step=done"); // @step done
}
