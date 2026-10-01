use xiom.io;
module models {
  pub type Note = {
    content: Str;
    category: Str;
  }

  pub fn new_note(content: Str, category: Str) -> Note {
    return Note{ content: content, category: category };
  }
}

module storage {
  pub type Notebook = {
    notes: Vec[models.Note];
  }

  pub fn new_notebook() -> Notebook {
    return Notebook{ notes: Vec[models.Note].new() };
  }

  pub fn Notebook.add_note(&mut self, content: Str, category: Str) {
    self.notes.push(models.new_note(content, category));
  }

  pub fn Notebook.count(self) -> Int {
    return self.notes.len();
  }

  pub fn count_by_category(notebook: &Notebook, cat: Str) -> Int {
    var count = 0;
    var i = 0;
    while i < notebook.notes.len() {
      let note = notebook.notes[i];
      if note.category == cat {
        count = count + 1;
      }
      i = i + 1;
    }
    return count;
  }
}

fn main() -> Int {
  var nb = storage.new_notebook();
  nb.add_note("Buy milk", "personal");
  nb.add_note("Fix bug", "work");
  nb.add_note("Call mom", "personal");

  io.println(to_string(storage.count_by_category(&nb, "personal")));
  return 0;
}
