// Automated test suite for ChessEngine
load('static/js/engine.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

print('Running ChessEngine unit tests...');

// 1. Initial State
var game = new ChessEngine();
assert(game.turn === 'w', 'White starts');
assert(game.getLegalMoves('w').length === 20, 'White has 20 opening moves (16 pawn + 4 knight)');
print('Test 1: Initial state passed (20 legal moves).');

// 2. Scholar's Mate (1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#)
var game2 = new ChessEngine();
var m1 = game2.makeMove('e2', 'e4');
assert(m1 && m1.san === 'e4', 'e4 move san check');
var m2 = game2.makeMove('e7', 'e5');
assert(m2 && m2.san === 'e5', 'e5 move san check');
var m3 = game2.makeMove('d1', 'h5');
assert(m3 && m3.san === 'Qh5', 'Qh5 move san check');
var m4 = game2.makeMove('b8', 'c6');
assert(m4 && m4.san === 'Nc6', 'Nc6 move san check');
var m5 = game2.makeMove('f1', 'c4');
assert(m5 && m5.san === 'Bc4', 'Bc4 move san check');
var m6 = game2.makeMove('g8', 'f6');
assert(m6 && m6.san === 'Nf6', 'Nf6 move san check');
var m7 = game2.makeMove('h5', 'f7');
assert(m7 && m7.san === 'Qxf7#', 'Qxf7# move checkmate');
assert(game2.isCheckmate(), 'Should be checkmate');
assert(game2.getGameStatus().winner === 'white', 'White won by checkmate');
print('Test 2: Scholar\'s mate passed.');

// 3. En Passant
var epGame = new ChessEngine();
epGame.makeMove('e2', 'e4');
epGame.makeMove('a7', 'a6');
epGame.makeMove('e4', 'e5');
epGame.makeMove('d7', 'd5'); // black double pawn move
assert(epGame.enPassant !== null, 'En passant square is set');
var epCap = epGame.makeMove('e5', 'd6');
assert(epCap !== null, 'En passant capture was legal');
assert(epCap.san === 'exd6', 'En passant san notation');
assert(epGame.board[3][3] === null, 'Captured black pawn at d5 removed');
print('Test 3: En Passant passed.');

// 4. Castling Kingside & Queenside
var castleGame = new ChessEngine();
castleGame.loadFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
assert(castleGame.getLegalMoves('w').some(function(m) { return m.isCastle === 'k'; }), 'White can castle kingside');
assert(castleGame.getLegalMoves('w').some(function(m) { return m.isCastle === 'q'; }), 'White can castle queenside');
var cm = castleGame.makeMove('e1', 'g1');
assert(cm && cm.san === 'O-O', 'White castled kingside');
assert(castleGame.board[7][5] && castleGame.board[7][5].type === 'r', 'Rook moved to f1');
assert(castleGame.board[7][6] && castleGame.board[7][6].type === 'k', 'King moved to g1');
print('Test 4: Castling passed.');

// 5. Pawn Promotion
var promoGame = new ChessEngine();
// White pawn at e7, Black King at e1 (same file) -> will be check!
promoGame.loadFEN('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
var pm = promoGame.makeMove('e7', 'e8', 'q');
assert(pm && pm.san === 'e8=Q', 'Pawn promoted to Queen without check (King at h1)');
assert(promoGame.board[0][4].type === 'q', 'Promoted piece is queen');
print('Test 5: Pawn Promotion passed.');

// 5b. Promotion with check
var promoCheckGame = new ChessEngine();
promoCheckGame.loadFEN('7k/4P3/8/8/8/8/8/4K3 w - - 0 1'); // King at h8
var pmCheck = promoCheckGame.makeMove('e7', 'e8', 'q');
assert(pmCheck && pmCheck.san === 'e8=Q+', 'Pawn promoted to Queen with check (King at h8 on same rank)');
print('Test 5b: Pawn Promotion with check passed.');

// 6. Undo Move
promoGame.undo();
assert(promoGame.board[1][4].type === 'p', 'Pawn restored to e7 after undo');
assert(promoGame.board[0][4] === null, 'e8 empty after undo');
print('Test 6: Undo passed.');

print('All ChessEngine unit tests PASSED successfully!');
