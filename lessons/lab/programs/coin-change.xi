// Coin Change -- Algorithm Lab program (docs/LAB_PROTOCOL.md).
//
// One row of the table, one cell per amount: the fewest coins that make that
// amount. Each cell is the best over every coin that fits.
use xiom.io;

fn main() {
  let amount = 11;
  var coins: Vec[Int] = Vec[Int].new();
  coins.push(1); coins.push(2); coins.push(5);
  let cols = amount + 1;

  io.println("v1|init|rows=1|cols=" + cols.to_str() +
             "|rowlabels=min_coins|labels=0,1,2,3,4,5,6,7,8,9,10,11|step=init"); // @step init

  var dp: Vec[Int] = Vec[Int].new();
  var z = 0;
  while z <= amount { dp.push(0); z += 1; };

  io.println("v1|set|r=0|c=0|v=0|step=base"); // @step base

  var target = 1;
  while target <= amount {
    var best = amount + 1;
    var ci = 0;
    while ci < coins.len() {
      let coin = coins.get(ci).unwrap();
      if coin <= target {
        let candidate = dp.get(target - coin).unwrap() + 1;
        io.println("v1|compare|c=" + target.to_str() + "|v=" + coin.to_str() + "|step=try"); // @step try
        if candidate < best { best = candidate; };
      };
      ci += 1;
    };
    dp.set(target, best);
    io.println("v1|set|r=0|c=" + target.to_str() + "|v=" + best.to_str() + "|step=fill"); // @step fill
    target += 1;
  };
  io.println("v1|mark|r=0|c=" + amount.to_str() + "|role=found|step=result"); // @step result
  io.println("v1|done|result=" + dp.get(amount).unwrap().to_str() + "|step=done"); // @step done
}
