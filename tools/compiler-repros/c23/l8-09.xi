use xiom.io;
type RecipeCard = {
  name: Str;
  servings: Int;
  cook_time: Int;
}

type RecipeBox = {
  cards: Vec[RecipeCard];
}

fn add_recipe(box: &mut RecipeBox, name: Str, servings: Int, cook_time: Int) {
  box.cards.push(RecipeCard{ name: name, servings: servings, cook_time: cook_time });
}

fn find_quick_meals(box: &RecipeBox, max_time: Int) -> Vec[RecipeCard] {
  var results: Vec[RecipeCard] = Vec[RecipeCard].new();
  var i = 0;
  while i < box.cards.len() {
    let card = box.cards.get(i).unwrap();
    if card.cook_time <= max_time {
      results.push(RecipeCard{ name: card.name, servings: card.servings, cook_time: card.cook_time });
    };
    i += 1;
  };
  results
}

fn main() -> Int {
  var box = RecipeBox{ cards: Vec[RecipeCard].new() };
  add_recipe(&mut box, "Pasta", 4, 25);
  add_recipe(&mut box, "Roast", 6, 120);
  add_recipe(&mut box, "Salad", 2, 10);
  let quick = find_quick_meals(&box, 30);
  io.println(quick.len().to_str());
  return 0;
}
