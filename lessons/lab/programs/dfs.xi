// Depth-First Search on a grid -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// A stack drives the search: dive as deep as possible along one branch before
// backing up. The path it finds is a valid path, not necessarily shortest.
use xiom.io;

fn idx(r: Int, c: Int, cols: Int) -> Int {
  r * cols + c
}

fn walls_str(walls: &Vec[Int], rows: Int, cols: Int) -> Str {
  var out = "";
  var i = 0;
  while i < rows {
    var j = 0;
    while j < cols {
      if walls.get(idx(i, j, cols)).unwrap() == 1 {
        if out.len() > 0 { out = out + ","; };
        out = out + i.to_str() + "-" + j.to_str();
      };
      j += 1;
    };
    i += 1;
  };
  out
}

fn push_node(r: Int, c: Int, parent_flat: Int, rows: Int, cols: Int,
             walls: &Vec[Int], seen: &mut Vec[Int], parent: &mut Vec[Int],
             sr: &mut Vec[Int], sc: &mut Vec[Int]) {
  if r >= 0 && r < rows && c >= 0 && c < cols {
    let flat = idx(r, c, cols);
    if walls.get(flat).unwrap() == 0 && seen.get(flat).unwrap() == 0 {
      seen.set(flat, 1);
      parent.set(flat, parent_flat);
      sr.push(r);
      sc.push(c);
      io.println("v1|frontier|r=" + r.to_str() + "|c=" + c.to_str() + "|step=frontier"); // @step frontier
    };
  };
}

fn main() {
  let rows = 6;
  let cols = 8;
  let goal_r = 5;
  let goal_c = 7;

  var walls: Vec[Int] = Vec[Int].new();
  var k = 0;
  while k < rows * cols { walls.push(0); k += 1; };
  walls.set(idx(0, 3, cols), 1);
  walls.set(idx(1, 1, cols), 1);
  walls.set(idx(1, 3, cols), 1);
  walls.set(idx(1, 5, cols), 1);
  walls.set(idx(2, 1, cols), 1);
  walls.set(idx(2, 5, cols), 1);
  walls.set(idx(3, 1, cols), 1);
  walls.set(idx(3, 2, cols), 1);
  walls.set(idx(3, 3, cols), 1);
  walls.set(idx(3, 5, cols), 1);
  walls.set(idx(4, 3, cols), 1);
  walls.set(idx(4, 5, cols), 1);
  walls.set(idx(5, 0, cols), 1);
  walls.set(idx(5, 1, cols), 1);

  io.println("v1|init|rows=" + rows.to_str() + "|cols=" + cols.to_str() +
             "|walls=" + walls_str(&walls, rows, cols) + "|step=init"); // @step init

  var seen: Vec[Int] = Vec[Int].new();
  var parent: Vec[Int] = Vec[Int].new();
  k = 0;
  while k < rows * cols {
    seen.push(0);
    parent.push(-1);
    k += 1;
  };

  var sr: Vec[Int] = Vec[Int].new();
  var sc: Vec[Int] = Vec[Int].new();
  sr.push(0);
  sc.push(0);
  seen.set(0, 1);
  io.println("v1|frontier|r=0|c=0|step=frontier"); // @step frontier

  var goal = false;
  var visits = 0;
  while sr.len() > 0 && !goal {
    let r = sr.get(sr.len() - 1).unwrap();
    sr.remove(sr.len() - 1);
    let c = sc.get(sc.len() - 1).unwrap();
    sc.remove(sc.len() - 1);
    visits += 1;
    io.println("v1|visit|r=" + r.to_str() + "|c=" + c.to_str() + "|step=visit"); // @step visit
    if r == goal_r && c == goal_c {
      goal = true;
    } else {
      // Push in reverse preference order so the pop order is up, right, down,
      // left -- deterministic, and visually a proper depth-first dive.
      let flat = idx(r, c, cols);
      push_node(r, c - 1, flat, rows, cols, &walls, &mut seen, &mut parent, &mut sr, &mut sc);
      push_node(r + 1, c, flat, rows, cols, &walls, &mut seen, &mut parent, &mut sr, &mut sc);
      push_node(r, c + 1, flat, rows, cols, &walls, &mut seen, &mut parent, &mut sr, &mut sc);
      push_node(r - 1, c, flat, rows, cols, &walls, &mut seen, &mut parent, &mut sr, &mut sc);
    };
  };

  if goal {
    var path: Vec[Int] = Vec[Int].new();
    var cur = idx(goal_r, goal_c, cols);
    while cur != -1 {
      path.push(cur);
      cur = parent.get(cur).unwrap();
    };
    var p = path.len() - 1;
    while p >= 0 {
      let flat = path.get(p).unwrap();
      io.println("v1|path|r=" + (flat / cols).to_str() + "|c=" + (flat % cols).to_str() + "|step=path"); // @step path
      p -= 1;
    };
  };
  io.println("v1|done|result=" + visits.to_str() + "|step=done"); // @step done
}
