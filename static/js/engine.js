/**
 * ChessEngine - FIDE compliant chess game engine in vanilla JavaScript.
 * Supports complete chess rules: piece moves, castling, en passant, promotion,
 * check, checkmate, stalemate, insufficient material, 50-move rule, threefold repetition,
 * FEN and SAN generation/parsing.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.ChessEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  var PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
  };

  function cloneBoard(b) {
    var nb = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        row.push(p ? { type: p.type, color: p.color } : null);
      }
      nb.push(row);
    }
    return nb;
  }

  function coordToSquare(r, c) {
    var file = String.fromCharCode('a'.charCodeAt(0) + c);
    var rank = (8 - r).toString();
    return file + rank;
  }

  function squareToCoord(sq) {
    if (!sq || sq.length < 2) return null;
    var c = sq.charCodeAt(0) - 'a'.charCodeAt(0);
    var r = 8 - parseInt(sq[1], 10);
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return { r: r, c: c };
  }

  function ChessEngine(fen) {
    this.reset();
    if (fen) {
      this.loadFEN(fen);
    }
  }

  ChessEngine.prototype.reset = function () {
    this.board = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) {
        row.push(null);
      }
      this.board.push(row);
    }
    this.turn = 'w';
    this.castling = {
      w: { k: true, q: true },
      b: { k: true, q: true }
    };
    this.enPassant = null; // { r, c }
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.history = [];
    this.positionCounts = {};
    this.capturedPieces = { w: [], b: [] }; // w captures black pieces, b captures white pieces
    this.loadFEN(STARTING_FEN);
  };

  ChessEngine.prototype.loadFEN = function (fen) {
    fen = fen || STARTING_FEN;
    var parts = fen.trim().split(/\s+/);
    if (parts.length < 1) return false;

    var rows = parts[0].split('/');
    if (rows.length !== 8) return false;

    var newBoard = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      var line = rows[r];
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch >= '1' && ch <= '8') {
          var empties = parseInt(ch, 10);
          for (var e = 0; e < empties; e++) row.push(null);
        } else {
          var color = (ch === ch.toUpperCase()) ? 'w' : 'b';
          var type = ch.toLowerCase();
          row.push({ type: type, color: color });
        }
      }
      if (row.length !== 8) return false;
      newBoard.push(row);
    }

    this.board = newBoard;
    this.turn = (parts[1] && parts[1] === 'b') ? 'b' : 'w';

    this.castling = {
      w: { k: false, q: false },
      b: { k: false, q: false }
    };
    var castlingPart = parts[2] || '-';
    if (castlingPart.indexOf('K') !== -1) this.castling.w.k = true;
    if (castlingPart.indexOf('Q') !== -1) this.castling.w.q = true;
    if (castlingPart.indexOf('k') !== -1) this.castling.b.k = true;
    if (castlingPart.indexOf('q') !== -1) this.castling.b.q = true;

    var epPart = parts[3] || '-';
    this.enPassant = (epPart !== '-') ? squareToCoord(epPart) : null;

    this.halfmoveClock = parts[4] ? parseInt(parts[4], 10) : 0;
    this.fullmoveNumber = parts[5] ? parseInt(parts[5], 10) : 1;

    this.recalculateCaptured();
    this.updatePositionCount();
    return true;
  };

  ChessEngine.prototype.recalculateCaptured = function () {
    var counts = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
    };
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = this.board[r][c];
        if (p && p.type !== 'k') {
          counts[p.color][p.type]++;
        }
      }
    }
    var initial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    this.capturedPieces = { w: [], b: [] }; // pieces white captured (black pieces) & vice-versa
    var types = ['p', 'n', 'b', 'r', 'q'];
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var missingBlack = Math.max(0, initial[t] - counts.b[t]);
      for (var mb = 0; mb < missingBlack; mb++) {
        this.capturedPieces.w.push({ type: t, color: 'b' });
      }
      var missingWhite = Math.max(0, initial[t] - counts.w[t]);
      for (var mw = 0; mw < missingWhite; mw++) {
        this.capturedPieces.b.push({ type: t, color: 'w' });
      }
    }
  };

  ChessEngine.prototype.getMaterialAdvantage = function () {
    var scoreW = 0;
    var scoreB = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = this.board[r][c];
        if (p && p.type !== 'k') {
          var val = PIECE_VALUES[p.type] || 0;
          if (p.color === 'w') scoreW += val;
          else scoreB += val;
        }
      }
    }
    var diff = (scoreW - scoreB) / 100;
    return {
      white: scoreW / 100,
      black: scoreB / 100,
      diff: diff // positive if white is ahead, negative if black is ahead
    };
  };

  ChessEngine.prototype.toFEN = function (includeClocks) {
    var rows = [];
    for (var r = 0; r < 8; r++) {
      var empty = 0;
      var rowStr = '';
      for (var c = 0; c < 8; c++) {
        var p = this.board[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) {
            rowStr += empty;
            empty = 0;
          }
          var ch = (p.color === 'w') ? p.type.toUpperCase() : p.type.toLowerCase();
          rowStr += ch;
        }
      }
      if (empty > 0) rowStr += empty;
      rows.push(rowStr);
    }

    var castlingStr = '';
    if (this.castling.w.k) castlingStr += 'K';
    if (this.castling.w.q) castlingStr += 'Q';
    if (this.castling.b.k) castlingStr += 'k';
    if (this.castling.b.q) castlingStr += 'q';
    if (castlingStr === '') castlingStr = '-';

    var epStr = this.enPassant ? coordToSquare(this.enPassant.r, this.enPassant.c) : '-';

    if (includeClocks === false) {
      return [rows.join('/'), this.turn, castlingStr, epStr].join(' ');
    }
    return [rows.join('/'), this.turn, castlingStr, epStr, this.halfmoveClock, this.fullmoveNumber].join(' ');
  };

  ChessEngine.prototype.updatePositionCount = function () {
    var key = this.toFEN(false);
    this.positionCounts[key] = (this.positionCounts[key] || 0) + 1;
  };

  ChessEngine.prototype.getPiece = function (r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  };

  ChessEngine.prototype.findKing = function (color, board) {
    var b = board || this.board;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (p && p.type === 'k' && p.color === color) {
          return { r: r, c: c };
        }
      }
    }
    return null;
  };

  ChessEngine.prototype.isSquareAttacked = function (targetR, targetC, attackerColor, board) {
    var b = board || this.board;

    // 1. Pawn attacks
    if (attackerColor === 'w') {
      // White pawns attack from r + 1, c - 1 and r + 1, c + 1
      if (targetR + 1 <= 7) {
        if (targetC - 1 >= 0) {
          var p1 = b[targetR + 1][targetC - 1];
          if (p1 && p1.type === 'p' && p1.color === 'w') return true;
        }
        if (targetC + 1 <= 7) {
          var p2 = b[targetR + 1][targetC + 1];
          if (p2 && p2.type === 'p' && p2.color === 'w') return true;
        }
      }
    } else {
      // Black pawns attack from r - 1, c - 1 and r - 1, c + 1
      if (targetR - 1 >= 0) {
        if (targetC - 1 >= 0) {
          var p1b = b[targetR - 1][targetC - 1];
          if (p1b && p1b.type === 'p' && p1b.color === 'b') return true;
        }
        if (targetC + 1 <= 7) {
          var p2b = b[targetR - 1][targetC + 1];
          if (p2b && p2b.type === 'p' && p2b.color === 'b') return true;
        }
      }
    }

    // 2. Knight attacks
    var knightDeltas = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (var i = 0; i < knightDeltas.length; i++) {
      var nr = targetR + knightDeltas[i][0];
      var nc = targetC + knightDeltas[i][1];
      if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
        var kn = b[nr][nc];
        if (kn && kn.type === 'n' && kn.color === attackerColor) return true;
      }
    }

    // 3. King attacks (adjacent 1 square)
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var kr = targetR + dr;
        var kc = targetC + dc;
        if (kr >= 0 && kr <= 7 && kc >= 0 && kc <= 7) {
          var kp = b[kr][kc];
          if (kp && kp.type === 'k' && kp.color === attackerColor) return true;
        }
      }
    }

    // 4. Straight rays (Rook / Queen)
    var rookDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var d = 0; d < rookDirs.length; d++) {
      var rStep = rookDirs[d][0];
      var cStep = rookDirs[d][1];
      var currR = targetR + rStep;
      var currC = targetC + cStep;
      while (currR >= 0 && currR <= 7 && currC >= 0 && currC <= 7) {
        var piece = b[currR][currC];
        if (piece) {
          if (piece.color === attackerColor && (piece.type === 'r' || piece.type === 'q')) {
            return true;
          }
          break;
        }
        currR += rStep;
        currC += cStep;
      }
    }

    // 5. Diagonal rays (Bishop / Queen)
    var bishopDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (var bd = 0; bd < bishopDirs.length; bd++) {
      var brStep = bishopDirs[bd][0];
      var bcStep = bishopDirs[bd][1];
      var bCurrR = targetR + brStep;
      var bCurrC = targetC + bcStep;
      while (bCurrR >= 0 && bCurrR <= 7 && bCurrC >= 0 && bCurrC <= 7) {
        var bPiece = b[bCurrR][bCurrC];
        if (bPiece) {
          if (bPiece.color === attackerColor && (bPiece.type === 'b' || bPiece.type === 'q')) {
            return true;
          }
          break;
        }
        bCurrR += brStep;
        bCurrC += bcStep;
      }
    }

    return false;
  };

  ChessEngine.prototype.isInCheck = function (color, board) {
    var c = color || this.turn;
    var king = this.findKing(c, board);
    if (!king) return false;
    var oppColor = (c === 'w') ? 'b' : 'w';
    return this.isSquareAttacked(king.r, king.c, oppColor, board);
  };

  ChessEngine.prototype.generatePseudoMoves = function (color) {
    var moves = [];
    var c = color || this.turn;
    var oppColor = (c === 'w') ? 'b' : 'w';

    for (var r = 0; r < 8; r++) {
      for (var col = 0; col < 8; col++) {
        var p = this.board[r][col];
        if (!p || p.color !== c) continue;

        if (p.type === 'p') {
          var forward = (c === 'w') ? -1 : 1;
          var startRank = (c === 'w') ? 6 : 1;
          var promoRank = (c === 'w') ? 0 : 7;

          // Single advance
          var rNext = r + forward;
          if (rNext >= 0 && rNext <= 7 && !this.board[rNext][col]) {
            if (rNext === promoRank) {
              var promos = ['q', 'r', 'b', 'n'];
              for (var pr = 0; pr < promos.length; pr++) {
                moves.push({
                  from: { r: r, c: col },
                  to: { r: rNext, c: col },
                  promotion: promos[pr]
                });
              }
            } else {
              moves.push({
                from: { r: r, c: col },
                to: { r: rNext, c: col }
              });

              // Double advance from starting rank
              var rDouble = r + forward * 2;
              if (r === startRank && !this.board[rDouble][col]) {
                moves.push({
                  from: { r: r, c: col },
                  to: { r: rDouble, c: col }
                });
              }
            }
          }

          // Diagonal captures
          var capCols = [col - 1, col + 1];
          for (var cc = 0; cc < capCols.length; cc++) {
            var cNext = capCols[cc];
            if (cNext >= 0 && cNext <= 7 && rNext >= 0 && rNext <= 7) {
              var targetPiece = this.board[rNext][cNext];
              if (targetPiece && targetPiece.color === oppColor) {
                if (rNext === promoRank) {
                  var promos2 = ['q', 'r', 'b', 'n'];
                  for (var pr2 = 0; pr2 < promos2.length; pr2++) {
                    moves.push({
                      from: { r: r, c: col },
                      to: { r: rNext, c: cNext },
                      captured: targetPiece,
                      promotion: promos2[pr2]
                    });
                  }
                } else {
                  moves.push({
                    from: { r: r, c: col },
                    to: { r: rNext, c: cNext },
                    captured: targetPiece
                  });
                }
              } else if (this.enPassant && this.enPassant.r === rNext && this.enPassant.c === cNext) {
                // En Passant capture
                moves.push({
                  from: { r: r, c: col },
                  to: { r: rNext, c: cNext },
                  captured: { type: 'p', color: oppColor },
                  isEnPassant: true
                });
              }
            }
          }
        } else if (p.type === 'n') {
          var knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
          ];
          for (var kn = 0; kn < knightOffsets.length; kn++) {
            var nr = r + knightOffsets[kn][0];
            var nc = col + knightOffsets[kn][1];
            if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
              var destP = this.board[nr][nc];
              if (!destP) {
                moves.push({ from: { r: r, c: col }, to: { r: nr, c: nc } });
              } else if (destP.color === oppColor) {
                moves.push({ from: { r: r, c: col }, to: { r: nr, c: nc }, captured: destP });
              }
            }
          }
        } else if (p.type === 'b' || p.type === 'r' || p.type === 'q') {
          var dirs = [];
          if (p.type === 'b' || p.type === 'q') {
            dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
          }
          if (p.type === 'r' || p.type === 'q') {
            dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
          }
          for (var di = 0; di < dirs.length; di++) {
            var dr = dirs[di][0];
            var dc = dirs[di][1];
            var curR = r + dr;
            var curC = col + dc;
            while (curR >= 0 && curR <= 7 && curC >= 0 && curC <= 7) {
              var pAt = this.board[curR][curC];
              if (!pAt) {
                moves.push({ from: { r: r, c: col }, to: { r: curR, c: curC } });
              } else {
                if (pAt.color === oppColor) {
                  moves.push({ from: { r: r, c: col }, to: { r: curR, c: curC }, captured: pAt });
                }
                break;
              }
              curR += dr;
              curC += dc;
            }
          }
        } else if (p.type === 'k') {
          for (var kdr = -1; kdr <= 1; kdr++) {
            for (var kdc = -1; kdc <= 1; kdc++) {
              if (kdr === 0 && kdc === 0) continue;
              var kr = r + kdr;
              var kc = col + kdc;
              if (kr >= 0 && kr <= 7 && kc >= 0 && kc <= 7) {
                var kdest = this.board[kr][kc];
                if (!kdest) {
                  moves.push({ from: { r: r, c: col }, to: { r: kr, c: kc } });
                } else if (kdest.color === oppColor) {
                  moves.push({ from: { r: r, c: col }, to: { r: kr, c: kc }, captured: kdest });
                }
              }
            }
          }

          // Castling
          var kingRank = (c === 'w') ? 7 : 0;
          if (r === kingRank && col === 4 && !this.isInCheck(c)) {
            // Kingside castling
            if (this.castling[c].k) {
              if (!this.board[kingRank][5] && !this.board[kingRank][6]) {
                var rookPieceK = this.board[kingRank][7];
                if (rookPieceK && rookPieceK.type === 'r' && rookPieceK.color === c) {
                  if (!this.isSquareAttacked(kingRank, 5, oppColor) &&
                      !this.isSquareAttacked(kingRank, 6, oppColor)) {
                    moves.push({
                      from: { r: kingRank, c: 4 },
                      to: { r: kingRank, c: 6 },
                      isCastle: 'k'
                    });
                  }
                }
              }
            }

            // Queenside castling
            if (this.castling[c].q) {
              if (!this.board[kingRank][1] && !this.board[kingRank][2] && !this.board[kingRank][3]) {
                var rookPieceQ = this.board[kingRank][0];
                if (rookPieceQ && rookPieceQ.type === 'r' && rookPieceQ.color === c) {
                  if (!this.isSquareAttacked(kingRank, 3, oppColor) &&
                      !this.isSquareAttacked(kingRank, 2, oppColor)) {
                    moves.push({
                      from: { r: kingRank, c: 4 },
                      to: { r: kingRank, c: 2 },
                      isCastle: 'q'
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    return moves;
  };

  ChessEngine.prototype.testMoveForCheck = function (move, color) {
    var c = color || this.turn;
    var tempBoard = cloneBoard(this.board);
    var piece = tempBoard[move.from.r][move.from.c];
    if (!piece) return true; // invalid

    // Apply move to tempBoard
    tempBoard[move.to.r][move.to.c] = piece;
    tempBoard[move.from.r][move.from.c] = null;

    // Handle en passant capture
    if (move.isEnPassant) {
      var epCapturedR = (c === 'w') ? move.to.r + 1 : move.to.r - 1;
      tempBoard[epCapturedR][move.to.c] = null;
    }

    // Handle castling rook movement
    if (move.isCastle === 'k') {
      var rookFromK = { r: move.to.r, c: 7 };
      var rookToK = { r: move.to.r, c: 5 };
      tempBoard[rookToK.r][rookToK.c] = tempBoard[rookFromK.r][rookFromK.c];
      tempBoard[rookFromK.r][rookFromK.c] = null;
    } else if (move.isCastle === 'q') {
      var rookFromQ = { r: move.to.r, c: 0 };
      var rookToQ = { r: move.to.r, c: 3 };
      tempBoard[rookToQ.r][rookToQ.c] = tempBoard[rookFromQ.r][rookFromQ.c];
      tempBoard[rookFromQ.r][rookFromQ.c] = null;
    }

    // Does this leave own king in check?
    return this.isInCheck(c, tempBoard);
  };

  ChessEngine.prototype.getLegalMoves = function (color) {
    var c = color || this.turn;
    var pseudo = this.generatePseudoMoves(c);
    var legal = [];
    for (var i = 0; i < pseudo.length; i++) {
      var m = pseudo[i];
      if (!this.testMoveForCheck(m, c)) {
        legal.push(m);
      }
    }
    return legal;
  };

  ChessEngine.prototype.getLegalMovesForSquare = function (r, c) {
    var all = this.getLegalMoves(this.turn);
    var filtered = [];
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (m.from.r === r && m.from.c === c) {
        filtered.push(m);
      }
    }
    return filtered;
  };

  ChessEngine.prototype.makeMove = function (moveOrFrom, maybeTo, maybePromo) {
    var move = null;
    if (typeof moveOrFrom === 'string' && typeof maybeTo === 'string') {
      var f = squareToCoord(moveOrFrom);
      var t = squareToCoord(maybeTo);
      if (!f || !t) return null;
      move = { from: f, to: t, promotion: maybePromo };
    } else if (typeof moveOrFrom === 'object' && moveOrFrom !== null && moveOrFrom.from && moveOrFrom.to) {
      move = moveOrFrom;
    } else if (typeof moveOrFrom === 'object' && moveOrFrom !== null && typeof maybeTo === 'object' && maybeTo !== null &&
               typeof moveOrFrom.r === 'number' && typeof moveOrFrom.c === 'number' &&
               typeof maybeTo.r === 'number' && typeof maybeTo.c === 'number') {
      move = { from: moveOrFrom, to: maybeTo, promotion: maybePromo };
    } else {
      return null;
    }

    // Find matching legal move
    var legalMoves = this.getLegalMoves(this.turn);
    var matched = null;
    for (var i = 0; i < legalMoves.length; i++) {
      var lm = legalMoves[i];
      if (lm.from.r === move.from.r && lm.from.c === move.from.c &&
          lm.to.r === move.to.r && lm.to.c === move.to.c) {
        if (lm.promotion) {
          var requestedPromo = (move.promotion || 'q').toLowerCase();
          if (lm.promotion === requestedPromo) {
            matched = lm;
            break;
          }
        } else {
          matched = lm;
          break;
        }
      }
    }

    if (!matched) return null;

    var piece = this.board[matched.from.r][matched.from.c];
    var captured = this.board[matched.to.r][matched.to.c];
    var fenBefore = this.toFEN(true);

    // Save history snapshot
    var snapshot = {
      from: { r: matched.from.r, c: matched.from.c },
      to: { r: matched.to.r, c: matched.to.c },
      piece: { type: piece.type, color: piece.color },
      captured: captured ? { type: captured.type, color: captured.color } : null,
      promotion: matched.promotion || null,
      isCastle: matched.isCastle || null,
      isEnPassant: matched.isEnPassant || false,
      castling: {
        w: { k: this.castling.w.k, q: this.castling.w.q },
        b: { k: this.castling.b.k, q: this.castling.b.q }
      },
      enPassant: this.enPassant ? { r: this.enPassant.r, c: this.enPassant.c } : null,
      halfmoveClock: this.halfmoveClock,
      fullmoveNumber: this.fullmoveNumber,
      turn: this.turn,
      fenBefore: fenBefore
    };

    // Update board
    this.board[matched.to.r][matched.to.c] = piece;
    this.board[matched.from.r][matched.from.c] = null;

    // Handle en passant capture
    if (matched.isEnPassant) {
      var epCapR = (this.turn === 'w') ? matched.to.r + 1 : matched.to.r - 1;
      var epCapPiece = this.board[epCapR][matched.to.c];
      snapshot.captured = epCapPiece ? { type: epCapPiece.type, color: epCapPiece.color } : { type: 'p', color: (this.turn === 'w' ? 'b' : 'w') };
      this.board[epCapR][matched.to.c] = null;
    }

    // Handle promotion
    if (matched.promotion) {
      this.board[matched.to.r][matched.to.c] = {
        type: matched.promotion.toLowerCase(),
        color: this.turn
      };
    }

    // Handle castling rook move
    if (matched.isCastle === 'k') {
      var rkr = matched.to.r;
      this.board[rkr][5] = this.board[rkr][7];
      this.board[rkr][7] = null;
    } else if (matched.isCastle === 'q') {
      var rqr = matched.to.r;
      this.board[rqr][3] = this.board[rqr][0];
      this.board[rqr][0] = null;
    }

    // Update castling rights
    if (piece.type === 'k') {
      this.castling[this.turn].k = false;
      this.castling[this.turn].q = false;
    } else if (piece.type === 'r') {
      if (matched.from.r === 7 && matched.from.c === 7) this.castling.w.k = false;
      if (matched.from.r === 7 && matched.from.c === 0) this.castling.w.q = false;
      if (matched.from.r === 0 && matched.from.c === 7) this.castling.b.k = false;
      if (matched.from.r === 0 && matched.from.c === 0) this.castling.b.q = false;
    }

    // If opponent rook captured on starting corner, invalidate their castling right
    if (captured && captured.type === 'r') {
      if (matched.to.r === 7 && matched.to.c === 7) this.castling.w.k = false;
      if (matched.to.r === 7 && matched.to.c === 0) this.castling.w.q = false;
      if (matched.to.r === 0 && matched.to.c === 7) this.castling.b.k = false;
      if (matched.to.r === 0 && matched.to.c === 0) this.castling.b.q = false;
    }

    // Update en passant square
    if (piece.type === 'p' && Math.abs(matched.to.r - matched.from.r) === 2) {
      this.enPassant = {
        r: (matched.from.r + matched.to.r) / 2,
        c: matched.from.c
      };
    } else {
      this.enPassant = null;
    }

    // Halfmove clock for 50-move rule
    if (piece.type === 'p' || captured || matched.isEnPassant) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    // Fullmove number
    if (this.turn === 'b') {
      this.fullmoveNumber++;
    }

    // Switch turn
    var prevTurn = this.turn;
    this.turn = (this.turn === 'w') ? 'b' : 'w';

    // Build SAN
    var san = this.moveToSAN(matched, piece, captured, legalMoves);
    snapshot.san = san;
    snapshot.fenAfter = this.toFEN(true);

    this.history.push(snapshot);
    this.updatePositionCount();
    this.recalculateCaptured();

    var nextInCheck = this.isInCheck(this.turn);
    var nextLegal = this.getLegalMoves(this.turn);
    var isMate = nextInCheck && nextLegal.length === 0;

    return {
      move: matched,
      san: san,
      captured: snapshot.captured,
      inCheck: nextInCheck,
      isCheckmate: isMate,
      isDraw: this.isDraw(),
      fen: snapshot.fenAfter,
      turn: this.turn
    };
  };

  ChessEngine.prototype.moveToSAN = function (move, piece, captured, legalMovesList) {
    if (move.isCastle === 'k') return 'O-O';
    if (move.isCastle === 'q') return 'O-O-O';

    var san = '';
    var destSq = coordToSquare(move.to.r, move.to.c);
    var isCap = Boolean(captured || move.isEnPassant);

    if (piece.type === 'p') {
      if (isCap) {
        var fromSq = coordToSquare(move.from.r, move.from.c);
        san += fromSq[0] + 'x' + destSq;
      } else {
        san += destSq;
      }
      if (move.promotion) {
        san += '=' + move.promotion.toUpperCase();
      }
    } else {
      san += piece.type.toUpperCase();

      // Disambiguation
      var sameTypeMoves = [];
      for (var i = 0; i < legalMovesList.length; i++) {
        var lm = legalMovesList[i];
        if (lm.to.r === move.to.r && lm.to.c === move.to.c &&
            (lm.from.r !== move.from.r || lm.from.c !== move.from.c)) {
          var otherPiece = this.board[lm.from.r][lm.from.c];
          if (otherPiece && otherPiece.type === piece.type && otherPiece.color === piece.color) {
            sameTypeMoves.push(lm);
          }
        }
      }

      if (sameTypeMoves.length > 0) {
        var diffCol = true;
        var diffRow = true;
        for (var j = 0; j < sameTypeMoves.length; j++) {
          if (sameTypeMoves[j].from.c === move.from.c) diffCol = false;
          if (sameTypeMoves[j].from.r === move.from.r) diffRow = false;
        }
        var fromSquare = coordToSquare(move.from.r, move.from.c);
        if (diffCol) {
          san += fromSquare[0];
        } else if (diffRow) {
          san += fromSquare[1];
        } else {
          san += fromSquare;
        }
      }

      if (isCap) san += 'x';
      san += destSq;
    }

    // Check / Checkmate suffix
    var oppColor = (piece.color === 'w') ? 'b' : 'w';
    if (this.isInCheck(oppColor)) {
      var nextMoves = this.getLegalMoves(oppColor);
      if (nextMoves.length === 0) {
        san += '#';
      } else {
        san += '+';
      }
    }

    return san;
  };

  ChessEngine.prototype.undo = function () {
    if (this.history.length === 0) return null;
    var last = this.history.pop();

    // Revert position count
    var key = this.toFEN(false);
    if (this.positionCounts[key]) {
      this.positionCounts[key]--;
      if (this.positionCounts[key] <= 0) delete this.positionCounts[key];
    }

    // Revert board state
    this.board[last.from.r][last.from.c] = last.piece;
    this.board[last.to.r][last.to.c] = last.captured;

    // If en passant, restore captured pawn to original square
    if (last.isEnPassant) {
      this.board[last.to.r][last.to.c] = null;
      var epCapR = (last.turn === 'w') ? last.to.r + 1 : last.to.r - 1;
      this.board[epCapR][last.to.c] = last.captured;
    }

    // If castling, restore rook
    if (last.isCastle === 'k') {
      var rkr = last.to.r;
      this.board[rkr][7] = this.board[rkr][5];
      this.board[rkr][5] = null;
    } else if (last.isCastle === 'q') {
      var rqr = last.to.r;
      this.board[rqr][0] = this.board[rqr][3];
      this.board[rqr][3] = null;
    }

    this.turn = last.turn;
    this.castling = last.castling;
    this.enPassant = last.enPassant;
    this.halfmoveClock = last.halfmoveClock;
    this.fullmoveNumber = last.fullmoveNumber;

    this.recalculateCaptured();
    return last;
  };

  ChessEngine.prototype.isCheckmate = function () {
    return this.isInCheck(this.turn) && this.getLegalMoves(this.turn).length === 0;
  };

  ChessEngine.prototype.isStalemate = function () {
    return !this.isInCheck(this.turn) && this.getLegalMoves(this.turn).length === 0;
  };

  ChessEngine.prototype.isInsufficientMaterial = function () {
    var pieces = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = this.board[r][c];
        if (p) pieces.push({ p: p, r: r, c: c });
      }
    }

    // King vs King
    if (pieces.length === 2) return true;

    // King + Bishop vs King or King + Knight vs King
    if (pieces.length === 3) {
      for (var i = 0; i < pieces.length; i++) {
        var t = pieces[i].p.type;
        if (t === 'b' || t === 'n') return true;
      }
    }

    // King + Bishop vs King + Bishop of the same square color
    if (pieces.length === 4) {
      var bishops = [];
      for (var j = 0; j < pieces.length; j++) {
        if (pieces[j].p.type === 'b') bishops.push(pieces[j]);
      }
      if (bishops.length === 2 && bishops[0].p.color !== bishops[1].p.color) {
        var sqColor1 = (bishops[0].r + bishops[0].c) % 2;
        var sqColor2 = (bishops[1].r + bishops[1].c) % 2;
        if (sqColor1 === sqColor2) return true;
      }
    }

    return false;
  };

  ChessEngine.prototype.isThreefoldRepetition = function () {
    var key = this.toFEN(false);
    return (this.positionCounts[key] || 0) >= 3;
  };

  ChessEngine.prototype.isFiftyMoveRule = function () {
    return this.halfmoveClock >= 100;
  };

  ChessEngine.prototype.isDraw = function () {
    return this.isStalemate() ||
           this.isInsufficientMaterial() ||
           this.isThreefoldRepetition() ||
           this.isFiftyMoveRule();
  };

  ChessEngine.prototype.isGameOver = function () {
    return this.isCheckmate() || this.isDraw();
  };

  ChessEngine.prototype.getGameStatus = function () {
    if (this.isCheckmate()) {
      var winner = (this.turn === 'w') ? 'black' : 'white';
      return {
        gameOver: true,
        result: 'checkmate',
        winner: winner,
        description: 'Checkmate! ' + (winner === 'white' ? 'White' : 'Black') + ' wins.'
      };
    }
    if (this.isStalemate()) {
      return {
        gameOver: true,
        result: 'stalemate',
        winner: null,
        description: 'Stalemate! Game drawn.'
      };
    }
    if (this.isInsufficientMaterial()) {
      return {
        gameOver: true,
        result: 'insufficient_material',
        winner: null,
        description: 'Draw by insufficient material.'
      };
    }
    if (this.isThreefoldRepetition()) {
      return {
        gameOver: true,
        result: 'threefold_repetition',
        winner: null,
        description: 'Draw by threefold repetition.'
      };
    }
    if (this.isFiftyMoveRule()) {
      return {
        gameOver: true,
        result: 'fifty_moves',
        winner: null,
        description: 'Draw by 50-move rule.'
      };
    }
    if (this.isInCheck(this.turn)) {
      return {
        gameOver: false,
        result: 'check',
        winner: null,
        description: (this.turn === 'w' ? 'White' : 'Black') + ' is in check!'
      };
    }
    return {
      gameOver: false,
      result: 'active',
      winner: null,
      description: (this.turn === 'w' ? 'White' : 'Black') + "'s turn."
    };
  };

  ChessEngine.prototype.toPGN = function (headers) {
    var pgn = '';
    headers = headers || {};
    var defaultHeaders = {
      Event: 'Casual Game',
      Site: 'Local Chess',
      Date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      Round: '1',
      White: headers.White || 'Player 1',
      Black: headers.Black || 'Player 2',
      Result: '*'
    };
    if (this.isCheckmate()) {
      defaultHeaders.Result = (this.turn === 'w') ? '0-1' : '1-0';
    } else if (this.isDraw()) {
      defaultHeaders.Result = '1/2-1/2';
    }

    for (var k in defaultHeaders) {
      if (defaultHeaders.hasOwnProperty(k)) {
        pgn += '[' + k + ' "' + defaultHeaders[k] + '"]\n';
      }
    }
    pgn += '\n';

    var movesStr = '';
    for (var i = 0; i < this.history.length; i++) {
      if (i % 2 === 0) {
        movesStr += ((i / 2) + 1) + '. ';
      }
      movesStr += this.history[i].san + ' ';
    }
    movesStr += defaultHeaders.Result;
    pgn += movesStr.trim() + '\n';
    return pgn;
  };

  ChessEngine.coordToSquare = coordToSquare;
  ChessEngine.squareToCoord = squareToCoord;

  return ChessEngine;
});

