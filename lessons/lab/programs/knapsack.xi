// 0/1 Knapsack -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Fill a table: rows are the items considered so far, columns are capacities.
// Each cell holds the best value reachable; the traceback marks the items
// that make up the optimal set.
use xiom.io;

fn main() {
  let capacity = 6;
  let cols = capacity + 1;
  var weights: Vec[Int] = Vec[Int].new();
  weights.push(1); weights.push(3); weights.push(4); weights.push(5);
  var values: Vec[Int] = Vec[Int].new();
  values.push(1); values.push(4); values.push(5); values.push(7);
  let items = weights.len();
  let rows = items + 1;

  io.println("v1|init|rows=" + rows.to_str() + "|cols=" + cols.to_str() +
             "|rowlabels=item0,item1,item2,item3,item4|labels=0,1,2,3,4,5,6|step=init"); // @step init

  var table: Vec[Int] = Vec[Int].new();
  var z = 0;
  while z < rows * cols { table.push(0); z += 1; };

  var i = 1;
  while i <= items {
    let weight = weights.get(i - 1).unwrap();
    let value = values.get(i - 1).unwrap();
    var cap = 0;
    while cap <= capacity {
      var best = table.get((i - 1) * cols + cap).unwrap();
      if weight <= cap {
        let take = table.get((i - 1) * cols + (cap - weight)).unwrap() + value;
        if take > best { best = take; };
      };
      table.set(i * cols + cap, best);
      io.println("v1|set|r=" + i.to_str() + "|c=" + cap.to_str() + "|v=" + best.to_str() + "|step=fill"); // @step fill
      cap += 1;
    };
    i += 1;
  };

  var r = items;
  var c = capacity;
  while r > 0 {
    let cur = table.get(r * cols + c).unwrap();
    let above = table.get((r - 1) * cols + c).unwrap();
    if cur != above {
      io.println("v1|mark|r=" + r.to_str() + "|c=" + c.to_str() + "|role=path|step=take"); // @step take
      c = c - weights.get(r - 1).unwrap();
    };
    r -= 1;
  };
  io.println("v1|done|result=" + table.get(items * cols + capacity).unwrap().to_str() + "|step=done"); // @step done
}
