// Flood Fill -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Paint the region connected to the start cell: every reachable open cell is
// visited exactly once and the walls stop the spread.
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

fn push_cell(r: Int, c: Int, rows: Int, cols: Int, walls: &Vec[Int],
             seen: &mut Vec[Int], sr: &mut Vec[Int], sc: &mut Vec[Int]) {
  if r >= 0 && r < rows && c >= 0 && c < cols {
    let flat = idx(r, c, cols);
    if walls.get(flat).unwrap() == 0 && seen.get(flat).unwrap() == 0 {
      seen.set(flat, 1);
      sr.push(r);
      sc.push(c);
      io.println("v1|frontier|r=" + r.to_str() + "|c=" + c.to_str() + "|step=frontier"); // @step frontier
    };
  };
}

fn main() {
  let rows = 6;
  let cols = 8;

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
  io.println("v1|mark|r=0|c=0|role=start|step=start"); // @step start

  var seen: Vec[Int] = Vec[Int].new();
  k = 0;
  while k < rows * cols { seen.push(0); k += 1; };

  var sr: Vec[Int] = Vec[Int].new();
  var sc: Vec[Int] = Vec[Int].new();
  sr.push(0);
  sc.push(0);
  seen.set(0, 1);
  io.println("v1|frontier|r=0|c=0|step=frontier"); // @step frontier

  var filled = 0;
  while sr.len() > 0 {
    let r = sr.get(sr.len() - 1).unwrap();
    sr.remove(sr.len() - 1);
    let c = sc.get(sc.len() - 1).unwrap();
    sc.remove(sc.len() - 1);
    filled += 1;
    io.println("v1|visit|r=" + r.to_str() + "|c=" + c.to_str() + "|step=visit"); // @step visit
    push_cell(r - 1, c, rows, cols, &walls, &mut seen, &mut sr, &mut sc);
    push_cell(r, c + 1, rows, cols, &walls, &mut seen, &mut sr, &mut sc);
    push_cell(r + 1, c, rows, cols, &walls, &mut seen, &mut sr, &mut sc);
    push_cell(r, c - 1, rows, cols, &walls, &mut seen, &mut sr, &mut sc);
  };
  io.println("v1|done|result=" + filled.to_str() + "|step=done"); // @step done
}
