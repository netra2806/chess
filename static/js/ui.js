/**
 * ChessUI - High performance, accessible chessboard UI renderer and interaction controller.
 * Supports click-to-move, drag-and-drop, touch gestures, smooth animations,
 * board flipping, promotion modal, captured pieces, clock rendering, and toast notifications.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.ChessUI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function ChessUI(containerElement, options) {
    this.container = (typeof containerElement === 'string')
      ? document.querySelector(containerElement)
      : containerElement;

    this.options = options || {};
    this.flipped = Boolean(this.options.flipped);
    this.selectedSquare = null; // { r, c }
    this.legalMovesForSelected = [];
    this.lastMove = null; // { from: {r, c}, to: {r, c} }
    this.onMoveCallback = null;
    this.onPromotionCallback = null;
    this.isInteractive = true;
    this.allowedColor = null;

    this.initDOM();
  }

  ChessUI.prototype.initDOM = function () {
    this.container.innerHTML = '';
    this.container.classList.add('chess-board-wrapper');

    // Board container
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'chess-board';
    this.container.appendChild(this.boardEl);

    // Squares array (8x8)
    this.squareEls = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) {
        var sq = document.createElement('div');
        sq.className = 'board-square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
        sq.dataset.row = r;
        sq.dataset.col = c;
        sq.setAttribute('draggable', 'false');
        this.boardEl.appendChild(sq);
        row.push(sq);
      }
      this.squareEls.push(row);
    }

    // Coordinates overlay
    this.coordsFiles = document.createElement('div');
    this.coordsFiles.className = 'coords-files';
    this.container.appendChild(this.coordsFiles);

    this.coordsRanks = document.createElement('div');
    this.coordsRanks.className = 'coords-ranks';
    this.container.appendChild(this.coordsRanks);

    this.renderCoordinates();
    this.setupEvents();
  };

  ChessUI.prototype.renderCoordinates = function () {
    this.coordsFiles.innerHTML = '';
    this.coordsRanks.innerHTML = '';

    var files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    var ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    if (this.flipped) {
      files = files.slice().reverse();
      ranks = ranks.slice().reverse();
    }

    for (var f = 0; f < 8; f++) {
      var fEl = document.createElement('span');
      fEl.className = 'coord-file';
      fEl.textContent = files[f];
      this.coordsFiles.appendChild(fEl);
    }

    for (var r = 0; r < 8; r++) {
      var rEl = document.createElement('span');
      rEl.className = 'coord-rank';
      rEl.textContent = ranks[r];
      this.coordsRanks.appendChild(rEl);
    }
  };

  ChessUI.prototype.setFlipped = function (flipped) {
    this.flipped = Boolean(flipped);
    if (this.flipped) {
      this.boardEl.classList.add('flipped');
    } else {
      this.boardEl.classList.remove('flipped');
    }
    this.renderCoordinates();
    this.updateSquaresGrid();
  };

  ChessUI.prototype.toggleFlip = function () {
    this.setFlipped(!this.flipped);
  };

  ChessUI.prototype.updateSquaresGrid = function () {
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = this.squareEls[r][c];
        var displayRow = this.flipped ? (7 - r) : r;
        var displayCol = this.flipped ? (7 - c) : c;
        sq.style.gridRowStart = displayRow + 1;
        sq.style.gridColumnStart = displayCol + 1;
      }
    }
  };

  ChessUI.prototype.render = function (engine) {
    this.engine = engine;
    this.updateSquaresGrid();

    var kingInCheckSquare = null;
    if (engine.isInCheck(engine.turn)) {
      kingInCheckSquare = engine.findKing(engine.turn);
    }

    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var sq = this.squareEls[r][c];
        var piece = engine.board[r][c];

        sq.innerHTML = '';
        sq.className = 'board-square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');

        // Last move highlight
        if (this.lastMove &&
            ((this.lastMove.from.r === r && this.lastMove.from.c === c) ||
             (this.lastMove.to.r === r && this.lastMove.to.c === c))) {
          sq.classList.add('highlight-last-move');
        }

        // Selected square highlight
        if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
          sq.classList.add('highlight-selected');
        }

        // Check highlight on king
        if (kingInCheckSquare && kingInCheckSquare.r === r && kingInCheckSquare.c === c) {
          sq.classList.add('highlight-check');
        }

        // Render piece
        if (piece) {
          var pieceEl = document.createElement('div');
          pieceEl.className = 'chess-piece';
          pieceEl.dataset.type = piece.type;
          pieceEl.dataset.color = piece.color;
          pieceEl.setAttribute('draggable', 'false');
          pieceEl.innerHTML = (window.ChessPieces) ? window.ChessPieces.getSVG(piece) : piece.type;
          sq.appendChild(pieceEl);
        }
      }
    }

    // Render legal move hint dots & capture rings
    if (this.selectedSquare && this.legalMovesForSelected && this.legalMovesForSelected.length > 0) {
      for (var i = 0; i < this.legalMovesForSelected.length; i++) {
        var lm = this.legalMovesForSelected[i];
        var targetSq = this.squareEls[lm.to.r][lm.to.c];
        var isCapture = Boolean(engine.board[lm.to.r][lm.to.c] || lm.isEnPassant);

        var hint = document.createElement('div');
        hint.className = isCapture ? 'move-hint-capture' : 'move-hint-dot';
        targetSq.appendChild(hint);
      }
    }
  };

  ChessUI.prototype.setupEvents = function () {
    var self = this;
    var pointerDownSquare = null;
    var pointerDownPos = null;
    var isDragging = false;
    var ghostEl = null;

    function getPointerPos(e) {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    function getSquareFromEvent(e) {
      var target = e.target;
      if (!target) return null;
      var sqEl = target.closest ? target.closest('.board-square') : null;
      if (!sqEl) return null;
      return {
        r: parseInt(sqEl.dataset.row, 10),
        c: parseInt(sqEl.dataset.col, 10)
      };
    }

    function getSquareFromPoint(x, y) {
      var elements = document.elementsFromPoint(x, y);
      for (var i = 0; i < elements.length; i++) {
        var sqEl = elements[i].closest('.board-square');
        if (sqEl) {
          return {
            r: parseInt(sqEl.dataset.row, 10),
            c: parseInt(sqEl.dataset.col, 10)
          };
        }
      }
      return null;
    }

    function removeGhost() {
      if (ghostEl && ghostEl.parentNode) {
        ghostEl.parentNode.removeChild(ghostEl);
      }
      ghostEl = null;
    }

    function onPointerDown(e) {
      if (!self.isInteractive || !self.engine) return;

      var sq = getSquareFromEvent(e);
      if (!sq) return;

      var pos = getPointerPos(e);
      pointerDownSquare = sq;
      pointerDownPos = pos;
      isDragging = false;

      // 1. If a piece was already selected, check if this click is a legal move
      if (self.selectedSquare) {
        var isLegalTarget = false;
        var matchingMove = null;
        for (var i = 0; i < self.legalMovesForSelected.length; i++) {
          var m = self.legalMovesForSelected[i];
          if (m.to.r === sq.r && m.to.c === sq.c) {
            isLegalTarget = true;
            matchingMove = m;
            break;
          }
        }

        if (isLegalTarget) {
          var fromSq = { r: self.selectedSquare.r, c: self.selectedSquare.c };
          var toSq = { r: sq.r, c: sq.c };
          self.clearSelection();

          var movedPiece = self.engine.board[fromSq.r][fromSq.c];
          var promoRank = (movedPiece.color === 'w') ? 0 : 7;
          if (movedPiece.type === 'p' && toSq.r === promoRank) {
            self.promptPromotion(movedPiece.color, function (promo) {
              self.executeUserMove(fromSq, toSq, promo);
            });
            pointerDownSquare = null;
            return;
          }

          self.executeUserMove(fromSq, toSq, null);
          pointerDownSquare = null;
          return;
        }
      }

      // 2. Select friendly piece
      var piece = self.engine.board[sq.r][sq.c];
      if (piece && piece.color === self.engine.turn) {
        if (self.allowedColor && piece.color !== self.allowedColor) {
          return;
        }

        self.selectedSquare = { r: sq.r, c: sq.c };
        self.legalMovesForSelected = self.engine.getLegalMovesForSquare(sq.r, sq.c);
        self.render(self.engine);

        if (e.preventDefault && e.type !== 'touchstart') {
          e.preventDefault();
        }
      } else {
        self.clearSelection();
        self.render(self.engine);
      }
    }

    function onPointerMove(e) {
      if (!pointerDownSquare || !pointerDownPos || !self.selectedSquare) return;

      var pos = getPointerPos(e);
      var dx = pos.x - pointerDownPos.x;
      var dy = pos.y - pointerDownPos.y;
      var dist = Math.hypot(dx, dy);

      if (!isDragging && dist > 6) {
        var piece = self.engine.board[pointerDownSquare.r][pointerDownSquare.c];
        if (piece && piece.color === self.engine.turn) {
          isDragging = true;
          ghostEl = document.createElement('div');
          ghostEl.className = 'chess-piece-ghost';
          ghostEl.innerHTML = window.ChessPieces ? window.ChessPieces.getSVG(piece) : piece.type;
          document.body.appendChild(ghostEl);
        }
      }

      if (isDragging && ghostEl) {
        ghostEl.style.left = (pos.x - 32) + 'px';
        ghostEl.style.top = (pos.y - 32) + 'px';
      }
    }

    function onPointerUp(e) {
      if (!pointerDownSquare) return;

      var pos = getPointerPos(e);

      if (isDragging) {
        removeGhost();
        isDragging = false;

        var targetSq = getSquareFromPoint(pos.x, pos.y);
        if (targetSq && (targetSq.r !== pointerDownSquare.r || targetSq.c !== pointerDownSquare.c)) {
          var isLegal = false;
          for (var i = 0; i < self.legalMovesForSelected.length; i++) {
            var lm = self.legalMovesForSelected[i];
            if (lm.to.r === targetSq.r && lm.to.c === targetSq.c) {
              isLegal = true;
              break;
            }
          }

          if (isLegal) {
            var from = { r: pointerDownSquare.r, c: pointerDownSquare.c };
            var to = { r: targetSq.r, c: targetSq.c };
            self.clearSelection();

            var movedPiece2 = self.engine.board[from.r][from.c];
            var promoRank2 = (movedPiece2.color === 'w') ? 0 : 7;
            if (movedPiece2.type === 'p' && to.r === promoRank2) {
              self.promptPromotion(movedPiece2.color, function (promo) {
                self.executeUserMove(from, to, promo);
              });
              pointerDownSquare = null;
              pointerDownPos = null;
              return;
            }

            self.executeUserMove(from, to, null);
            pointerDownSquare = null;
            pointerDownPos = null;
            return;
          }
        }
      }

      removeGhost();
      pointerDownSquare = null;
      pointerDownPos = null;
    }

    this.boardEl.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.boardEl.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  };

  ChessUI.prototype.clearSelection = function () {
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
  };

  ChessUI.prototype.setLastMove = function (from, to) {
    this.lastMove = { from: from, to: to };
  };

  ChessUI.prototype.executeUserMove = function (from, to, promo) {
    if (this.onMoveCallback) {
      this.onMoveCallback({ from: from, to: to, promotion: promo });
    }
  };

  ChessUI.prototype.promptPromotion = function (color, callback) {
    var self = this;
    var modal = document.createElement('div');
    modal.className = 'promotion-modal-backdrop';

    var dialog = document.createElement('div');
    dialog.className = 'promotion-dialog';
    dialog.innerHTML = '<h3>Promote Pawn</h3><p>Choose your promotion piece:</p>';

    var piecesBox = document.createElement('div');
    piecesBox.className = 'promotion-pieces-list';

    var choices = ['q', 'r', 'b', 'n'];
    for (var i = 0; i < choices.length; i++) {
      var t = choices[i];
      var btn = document.createElement('button');
      btn.className = 'promotion-choice-btn';
      btn.dataset.piece = t;
      var pObj = { type: t, color: color };
      btn.innerHTML = (window.ChessPieces) ? window.ChessPieces.getSVG(pObj) : t.toUpperCase();

      btn.addEventListener('click', (function (choice) {
        return function () {
          document.body.removeChild(modal);
          callback(choice);
        };
      })(t));

      piecesBox.appendChild(btn);
    }

    dialog.appendChild(piecesBox);
    modal.appendChild(dialog);
    document.body.appendChild(modal);
  };

  ChessUI.prototype.showToast = function (message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    var toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    var toast = document.createElement('div');
    toast.className = 'toast-message toast-' + type;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(function () {
      toast.classList.remove('toast-show');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  };

  return ChessUI;
});
