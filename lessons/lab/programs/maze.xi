// Maze generation -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// The grid starts as solid wall. A depth-first carve walks two cells at a
// time, opening the wall in between, until every room is connected.
use xiom.io;

fn idx(r: Int, c: Int, cols: Int) -> Int {
  r * cols + c
}

fn open_cell(r: Int, c: Int) {
  io.println("v1|mark|r=" + r.to_str() + "|c=" + c.to_str() + "|role=open|step=carve"); // @step carve
}

fn carve(maze: &mut Vec[Int], r: Int, c: Int, rows: Int, cols: Int) {
  maze.set(idx(r, c, cols), 1);
  open_cell(r, c);
  io.println("v1|visit|r=" + r.to_str() + "|c=" + c.to_str() + "|step=carve"); // @step carve

  var nr = r - 2;
  if nr >= 1 && maze.get(idx(nr, c, cols)).unwrap() == 0 {
    open_cell(r - 1, c);
    carve(maze, nr, c, rows, cols);
  };
  var nc = c + 2;
  if nc <= cols - 2 && maze.get(idx(r, nc, cols)).unwrap() == 0 {
    open_cell(r, c + 1);
    carve(maze, r, nc, rows, cols);
  };
  nr = r + 2;
  if nr <= rows - 2 && maze.get(idx(nr, c, cols)).unwrap() == 0 {
    open_cell(r + 1, c);
    carve(maze, nr, c, rows, cols);
  };
  nc = c - 2;
  if nc >= 1 && maze.get(idx(r, nc, cols)).unwrap() == 0 {
    open_cell(r, c - 1);
    carve(maze, r, nc, rows, cols);
  };
}

fn main() {
  let rows = 7;
  let cols = 9;
  io.println("v1|init|rows=7|cols=9|walls=all|step=init"); // @step init

  var maze: Vec[Int] = Vec[Int].new();
  var i = 0;
  while i < rows * cols { maze.push(0); i += 1; };

  carve(&mut maze, 1, 1, rows, cols);

  var opened = 0;
  i = 0;
  while i < rows * cols {
    if maze.get(i).unwrap() == 1 { opened += 1; };
    i += 1;
  };
  io.println("v1|done|result=" + opened.to_str() + "|step=done"); // @step done
}
