// Automated test for ChessAI
load('static/js/engine.js');
load('static/js/ai.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

print('Testing ChessAI...');

var game = new ChessEngine();

// Test Easy AI move selection
var easyResult = ChessAI.getBestMove(game, 'easy');
assert(easyResult && easyResult.move, 'Easy AI returned a move');
print('Easy AI move: ' + ChessEngine.coordToSquare(easyResult.move.from.r, easyResult.move.from.c) + ' -> ' +
      ChessEngine.coordToSquare(easyResult.move.to.r, easyResult.move.to.c) + ' (' + easyResult.comment + ')');

// Test Medium AI move selection
var medResult = ChessAI.getBestMove(game, 'medium');
assert(medResult && medResult.move, 'Medium AI returned a move');
print('Medium AI move: ' + ChessEngine.coordToSquare(medResult.move.from.r, medResult.move.from.c) + ' -> ' +
      ChessEngine.coordToSquare(medResult.move.to.r, medResult.move.to.c) + ' (' + medResult.nodes + ' nodes evaluated)');

// Test Hard AI move selection
var hardResult = ChessAI.getBestMove(game, 'hard');
assert(hardResult && hardResult.move, 'Hard AI returned a move');
print('Hard AI move: ' + ChessEngine.coordToSquare(hardResult.move.from.r, hardResult.move.from.c) + ' -> ' +
      ChessEngine.coordToSquare(hardResult.move.to.r, hardResult.move.to.c) + ' (' + hardResult.nodes + ' nodes evaluated)');

// Test Tactical Capture: White queen can capture undefended black queen
var tacticalGame = new ChessEngine();
tacticalGame.loadFEN('4k3/8/8/3q4/3Q4/8/8/4K3 w - - 0 1');
var bestTactical = ChessAI.getBestMove(tacticalGame, 'hard');
var fromSq = ChessEngine.coordToSquare(bestTactical.move.from.r, bestTactical.move.from.c);
var toSq = ChessEngine.coordToSquare(bestTactical.move.to.r, bestTactical.move.to.c);
assert(fromSq === 'd4' && toSq === 'd5', 'White AI captured free black queen at d5');
print('Tactical capture test passed: White Queen correctly captured at d5!');

print('All ChessAI tests PASSED successfully!');

