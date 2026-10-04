// Trie -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// Insert words letter by letter: shared prefixes reuse nodes, new letters
// become children. Node labels are the letters; found marks the word ends.
use xiom.io;
use xiom.string;

fn find_child(labels: &Vec[Str], parents: &Vec[Int], parent: Int, label: Str) -> Int {
  var i = 0;
  var found = -1;
  while i < labels.len() {
    if parents.get(i).unwrap() == parent {
      let here = labels.get(i).unwrap();
      if here == label { found = i; };
    };
    i += 1;
  };
  found
}

fn main() {
  var words: Vec[Str] = Vec[Str].new();
  words.push("cat"); words.push("car"); words.push("dog");

  var labels: Vec[Str] = Vec[Str].new();
  var parents: Vec[Int] = Vec[Int].new();
  labels.push("_");
  parents.push(-1);

  io.println("v1|init|n=8|step=init"); // @step init
  io.println("v1|node|id=0|parent=-1|v=0|label=_|step=init"); // @step init

  var next = 1;
  var w = 0;
  while w < words.len() {
    let word = words.get(w).unwrap();
    var cur = 0;
    var pos = 0;
    while pos < str_len(word) {
      let ch = str_slice(word, pos, pos + 1);
      io.println("v1|mark|id=" + cur.to_str() + "|role=cursor|step=walk"); // @step walk
      let child = find_child(&labels, &parents, cur, ch);
      if child >= 0 {
        cur = child;
      } else {
        labels.push(ch);
        parents.push(cur);
        io.println("v1|node|id=" + next.to_str() + "|parent=" + cur.to_str() + "|v=0|label=" + ch + "|step=add"); // @step add
        cur = next;
        next += 1;
      };
      pos += 1;
    };
    io.println("v1|mark|id=" + cur.to_str() + "|role=found|step=word"); // @step word
    w += 1;
  };
  io.println("v1|done|result=" + next.to_str() + "|step=done"); // @step done
}
