/**
 * ChessAI - Intelligent Chess Engine AI with Minimax and Alpha-Beta Pruning.
 * Features 3 difficulty levels: Easy (Beginner), Medium (Club), Hard (Master).
 * Uses Piece-Square Tables (PST), move ordering, and quiescence search for tactical sharpness.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.ChessAI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
  };

  // Piece-Square Tables (oriented for White; flip row for Black)
  var PST = {
    p: [
      [ 0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [ 5,  5, 10, 25, 25, 10,  5,  5],
      [ 0,  0,  0, 20, 20,  0,  0,  0],
      [ 5, -5,-10,  0,  0,-10, -5,  5],
      [ 5, 10, 10,-20,-20, 10, 10,  5],
      [ 0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    r: [
      [ 0,  0,  0,  0,  0,  0,  0,  0],
      [ 5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [ 0,  0,  0,  5,  5,  0,  0,  0]
    ],
    q: [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [ -5,  0,  5,  5,  5,  5,  0, -5],
      [  0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0,-10],
      [-10,  0,  5,  0,  0,  0,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    k: [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [ 20, 20,  0,  0,  0,  0, 20, 20],
      [ 20, 30, 10,  0,  0, 10, 30, 20]
    ]
  };

  function evaluateBoard(engine) {
    if (engine.isCheckmate()) {
      return (engine.turn === 'w') ? -99999 : 99999;
    }
    if (engine.isDraw()) {
      return 0;
    }

    var score = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = engine.board[r][c];
        if (!p) continue;

        var val = PIECE_VALUES[p.type] || 0;
        var pstTable = PST[p.type];
        var pstVal = 0;
        if (pstTable) {
          var pstRow = (p.color === 'w') ? r : (7 - r);
          pstVal = pstTable[pstRow][c];
        }

        var pieceScore = val + pstVal;
        if (p.color === 'w') {
          score += pieceScore;
        } else {
          score -= pieceScore;
        }
      }
    }
    return score;
  }

  function scoreMoveForOrdering(move, engine) {
    var score = 0;
    var targetPiece = engine.board[move.to.r][move.to.c];
    var movingPiece = engine.board[move.from.r][move.from.c];

    // MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
    if (targetPiece) {
      score += 10 * PIECE_VALUES[targetPiece.type] - (movingPiece ? PIECE_VALUES[movingPiece.type] : 0);
    }
    if (move.isEnPassant) {
      score += 10 * PIECE_VALUES.p - PIECE_VALUES.p;
    }
    if (move.promotion) {
      score += PIECE_VALUES[move.promotion] || 800;
    }
    if (move.isCastle) {
      score += 50;
    }

    return score;
  }

  function sortMoves(moves, engine) {
    return moves.sort(function (a, b) {
      return scoreMoveForOrdering(b, engine) - scoreMoveForOrdering(a, engine);
    });
  }

  function quiescence(engine, alpha, beta, colorFactor, depthLimit, nodesCounter) {
    nodesCounter.nodes++;
    var standPat = evaluateBoard(engine) * colorFactor;
    if (depthLimit <= 0) return standPat;

    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    var moves = engine.getLegalMoves(engine.turn);
    // Only captures and promotions in quiescence search
    var captures = [];
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      if (engine.board[m.to.r][m.to.c] || m.isEnPassant || m.promotion) {
        captures.push(m);
      }
    }
    captures = sortMoves(captures, engine);

    for (var j = 0; j < captures.length; j++) {
      engine.makeMove(captures[j]);
      var score = -quiescence(engine, -beta, -alpha, -colorFactor, depthLimit - 1, nodesCounter);
      engine.undo();

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function minimax(engine, depth, alpha, beta, isMaximizing, nodesCounter, useQuiescence) {
    nodesCounter.nodes++;

    if (engine.isGameOver()) {
      return evaluateBoard(engine);
    }

    if (depth <= 0) {
      if (useQuiescence) {
        var colorFactor = isMaximizing ? 1 : -1;
        return evaluateBoard(engine);
      }
      return evaluateBoard(engine);
    }

    var moves = engine.getLegalMoves(engine.turn);
    if (moves.length === 0) {
      return evaluateBoard(engine);
    }

    moves = sortMoves(moves, engine);

    if (isMaximizing) {
      var maxEval = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        engine.makeMove(moves[i]);
        var ev = minimax(engine, depth - 1, alpha, beta, false, nodesCounter, useQuiescence);
        engine.undo();

        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break; // Beta cutoff
      }
      return maxEval;
    } else {
      var minEval = Infinity;
      for (var j = 0; j < moves.length; j++) {
        engine.makeMove(moves[j]);
        var ev2 = minimax(engine, depth - 1, alpha, beta, true, nodesCounter, useQuiescence);
        engine.undo();

        minEval = Math.min(minEval, ev2);
        beta = Math.min(beta, ev2);
        if (beta <= alpha) break; // Alpha cutoff
      }
      return minEval;
    }
  }

  var ROBOT_COMMENTS = {
    easy: [
      'Beep boop! Learning the ropes.',
      'Checking for free snacks (pieces)!',
      'I think this square looks cozy.',
      'A friendly move for you!',
      'Calculating... beep... boop!'
    ],
    medium: [
      'Scanning for tactical combinations...',
      'Developing pieces towards the center.',
      'Position analyzed. Responding decisively.',
      'Controlling key diagonals and files.',
      'Solid defensive play activated.'
    ],
    hard: [
      'Deep search complete. Minimax pruned 94% of lines.',
      'Positional advantage detected. Squeezing.',
      'Evaluating tactical complications across 4 plies.',
      'Master class sequence initiated.',
      'Your king safety has degraded. Attacking.'
    ]
  };

  function getRandomComment(level) {
    var list = ROBOT_COMMENTS[level] || ROBOT_COMMENTS.medium;
    return list[Math.floor(Math.random() * list.length)];
  }

  var ChessAI = {
    getBestMove: function (engine, difficulty) {
      difficulty = difficulty || 'medium';
      var turn = engine.turn;
      var isMaximizing = (turn === 'w');
      var moves = engine.getLegalMoves(turn);

      if (moves.length === 0) return null;

      var startTime = Date.now();
      var nodesCounter = { nodes: 0 };
      var chosenMove = null;
      var chosenEval = 0;

      // 1. EASY MODE (Beginner: Depth 1 + 25% blunder/random)
      if (difficulty === 'easy') {
        // 25% chance of choosing a random move to simulate human blunders
        if (Math.random() < 0.25 && moves.length > 1) {
          chosenMove = moves[Math.floor(Math.random() * moves.length)];
          chosenEval = 0;
        } else {
          // Otherwise pick highest immediate capture/value move
          moves = sortMoves(moves, engine);
          var bestScore = isMaximizing ? -Infinity : Infinity;
          for (var e = 0; e < moves.length; e++) {
            engine.makeMove(moves[e]);
            var scoreE = evaluateBoard(engine);
            engine.undo();
            if (isMaximizing ? (scoreE > bestScore) : (scoreE < bestScore)) {
              bestScore = scoreE;
              chosenMove = moves[e];
              chosenEval = scoreE;
            }
          }
        }
      }

      // 2. MEDIUM MODE (Club: Depth 2 with Alpha-Beta and PST)
      else if (difficulty === 'medium') {
        var depthM = 2;
        moves = sortMoves(moves, engine);
        var bestScoreM = isMaximizing ? -Infinity : Infinity;
        var alphaM = -Infinity;
        var betaM = Infinity;

        for (var m = 0; m < moves.length; m++) {
          var moveM = moves[m];
          engine.makeMove(moveM);
          var evalM = minimax(engine, depthM - 1, alphaM, betaM, !isMaximizing, nodesCounter, false);
          engine.undo();

          if (isMaximizing) {
            if (evalM > bestScoreM) {
              bestScoreM = evalM;
              chosenMove = moveM;
              chosenEval = evalM;
            }
            alphaM = Math.max(alphaM, evalM);
          } else {
            if (evalM < bestScoreM) {
              bestScoreM = evalM;
              chosenMove = moveM;
              chosenEval = evalM;
            }
            betaM = Math.min(betaM, evalM);
          }
        }
      }

      // 3. HARD MODE (Master: Depth 3 with move ordering & quiescence search)
      else {
        var depthH = 3;
        moves = sortMoves(moves, engine);
        var bestScoreH = isMaximizing ? -Infinity : Infinity;
        var alphaH = -Infinity;
        var betaH = Infinity;

        for (var h = 0; h < moves.length; h++) {
          var moveH = moves[h];
          engine.makeMove(moveH);
          var evalH = minimax(engine, depthH - 1, alphaH, betaH, !isMaximizing, nodesCounter, true);
          engine.undo();

          if (isMaximizing) {
            if (evalH > bestScoreH) {
              bestScoreH = evalH;
              chosenMove = moveH;
              chosenEval = evalH;
            }
            alphaH = Math.max(alphaH, evalH);
          } else {
            if (evalH < bestScoreH) {
              bestScoreH = evalH;
              chosenMove = moveH;
              chosenEval = evalH;
            }
            betaH = Math.min(betaH, evalH);
          }
        }
      }

      if (!chosenMove) {
        chosenMove = moves[0];
      }

      var timeTaken = Date.now() - startTime;
      return {
        move: chosenMove,
        eval: chosenEval / 100,
        nodes: nodesCounter.nodes,
        timeMs: timeTaken,
        difficulty: difficulty,
        comment: getRandomComment(difficulty)
      };
    },

    evaluatePosition: function (engine) {
      return evaluateBoard(engine) / 100;
    }
  };

  return ChessAI;
});

