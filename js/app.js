/**
 * App - Main Chess Application Controller.
 * Integrates ChessEngine, ChessUI, ChessAI, ChessSound, SimpleQR, and ChessOnline.
 */

(function () {
  'use strict';

  // Game configuration & state
  var state = {
    mode: 'local', // 'local' (2 Players), 'robot' (vs AI), 'online' (Share Link)
    theme: 'walnut', // 'walnut', 'emerald', 'midnight', 'ice'
    autoFlipLocal: false,
    soundEnabled: true,

    // Robot settings
    robotDifficulty: 'medium', // 'easy', 'medium', 'hard'
    playerColorVsBot: 'w', // 'w' or 'b'
    isBotThinking: false,

    // Time Control (seconds)
    timeControl: 600, // 10 min default, or null for unlimited
    clocks: { w: 600, b: 600 },
    clockTimer: null,
    activeClock: null,

    // Online game state
    onlineRoomId: null,
    onlinePlayerColor: 'w',
    onlineOpponentConnected: false
  };

  // Modules
  var engine = new ChessEngine();
  var ui = null;
  var online = null;

  // DOM Elements cache
  var elements = {};

  function initElements() {
    elements.boardWrapper = document.getElementById('boardWrapper');
    elements.topPlayerCard = document.getElementById('topPlayerCard');
    elements.bottomPlayerCard = document.getElementById('bottomPlayerCard');
    elements.topPlayerName = document.getElementById('topPlayerName');
    elements.bottomPlayerName = document.getElementById('bottomPlayerName');
    elements.topPlayerRole = document.getElementById('topPlayerRole');
    elements.bottomPlayerRole = document.getElementById('bottomPlayerRole');
    elements.topPlayerClock = document.getElementById('topPlayerClock');
    elements.bottomPlayerClock = document.getElementById('bottomPlayerClock');
    elements.topCaptured = document.getElementById('topCaptured');
    elements.bottomCaptured = document.getElementById('bottomCaptured');
    elements.statusText = document.getElementById('statusText');
    elements.statusDot = document.getElementById('statusDot');

    // Controls
    elements.btnUndo = document.getElementById('btnUndo');
    elements.btnFlip = document.getElementById('btnFlip');
    elements.btnDraw = document.getElementById('btnDraw');
    elements.btnResign = document.getElementById('btnResign');
    elements.btnNewGame = document.getElementById('btnNewGame');
    elements.btnSound = document.getElementById('btnSound');
    elements.btnTheme = document.getElementById('btnTheme');

    // Move history
    elements.movesList = document.getElementById('movesList');
    elements.btnCopyFEN = document.getElementById('btnCopyFEN');
    elements.btnExportPGN = document.getElementById('btnExportPGN');
    elements.btnNavStart = document.getElementById('btnNavStart');
    elements.btnNavPrev = document.getElementById('btnNavPrev');
    elements.btnNavNext = document.getElementById('btnNavNext');
    elements.btnNavEnd = document.getElementById('btnNavEnd');

    // Mode tabs
    elements.modeTabs = document.querySelectorAll('.mode-tab-btn');
    elements.modePanels = document.querySelectorAll('.mode-panel');

    // Robot panel elements
    elements.robotThinking = document.getElementById('robotThinking');
    elements.robotComment = document.getElementById('robotComment');

    // Online panel elements
    elements.btnCreateRoom = document.getElementById('btnCreateRoom');
    elements.onlineActiveBox = document.getElementById('onlineActiveBox');
    elements.onlineCreateBox = document.getElementById('onlineCreateBox');
    elements.shareLinkInput = document.getElementById('shareLinkInput');
    elements.btnCopyLink = document.getElementById('btnCopyLink');
    elements.roomCodeBadge = document.getElementById('roomCodeBadge');
    elements.qrCanvas = document.getElementById('qrCanvas');

    // Online Chat elements
    elements.chatCard = document.getElementById('chatCard');
    elements.chatMessages = document.getElementById('chatMessages');
    elements.chatInput = document.getElementById('chatInput');
    elements.btnSendChat = document.getElementById('btnSendChat');
    elements.reactionBtns = document.querySelectorAll('.reaction-btn');

    // Game Over Modal
    elements.gameOverModal = document.getElementById('gameOverModal');
    elements.gameOverTitle = document.getElementById('gameOverTitle');
    elements.gameOverDesc = document.getElementById('gameOverDesc');
    elements.btnModalRematch = document.getElementById('btnModalRematch');
    elements.btnModalClose = document.getElementById('btnModalClose');
  }

  function init() {
    initElements();

    // Initialize UI
    ui = new ChessUI(elements.boardWrapper, { flipped: false });
    ui.onMoveCallback = handleUserMove;

    // Apply board theme class
    applyTheme(state.theme);

    // Initialize Online Multiplayer Manager
    initOnlineManager();

    // Setup Event Listeners
    setupEventListeners();

    // Check URL parameters for shared room
    checkUrlForRoom();

    // Start fresh game
    startNewGame();
  }

  function applyTheme(themeName) {
    state.theme = themeName;
    elements.boardWrapper.className = 'chess-board-wrapper theme-' + themeName;
    try {
      localStorage.setItem('chess_theme', themeName);
    } catch (e) {}
  }

  function setupEventListeners() {
    // Mode Switcher Tabs
    elements.modeTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var targetMode = tab.dataset.mode;
        switchMode(targetMode);
      });
    });

    // Control buttons
    elements.btnUndo.addEventListener('click', handleUndo);
    elements.btnFlip.addEventListener('click', function () {
      ui.toggleFlip();
      updatePlayerCardsOrientation();
    });
    elements.btnNewGame.addEventListener('click', function () {
      if (confirm('Start a new game?')) {
        startNewGame();
      }
    });
    elements.btnResign.addEventListener('click', handleResign);

    if (elements.btnDraw) {
      elements.btnDraw.addEventListener('click', function () {
        if (engine.isGameOver()) return;
        if (state.mode === 'online' && online) {
          online.sendAction('draw_offer');
          ui.showToast('Draw offer sent to opponent', 'info');
        } else {
          if (confirm('Agree to a draw?')) {
            handleGameOver({
              gameOver: true,
              result: 'mutual_agreement',
              winner: null,
              description: 'Game drawn by mutual agreement.'
            });
          }
        }
      });
    }

    if (elements.btnCopyFEN) {
      elements.btnCopyFEN.addEventListener('click', function () {
        var fen = engine.toFEN(true);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fen).then(function () {
            ui.showToast('FEN copied to clipboard! 📋', 'success');
          });
        } else {
          prompt('Copy FEN:', fen);
        }
      });
    }

    if (elements.btnExportPGN) {
      elements.btnExportPGN.addEventListener('click', function () {
        var pgn = engine.toPGN({
          White: state.mode === 'robot' ? (state.playerColorVsBot === 'w' ? 'You' : 'Robot') : 'Player 1',
          Black: state.mode === 'robot' ? (state.playerColorVsBot === 'b' ? 'You' : 'Robot') : 'Player 2'
        });
        var blob = new Blob([pgn], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'chess_game_' + Date.now() + '.pgn';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        ui.showToast('PGN file downloaded! 📥', 'success');
      });
    }

    // Sound toggle
    elements.btnSound.addEventListener('click', function () {
      var muted = ChessSound.toggleMuted();
      elements.btnSound.textContent = muted ? '🔇' : '🔊';
      ui.showToast(muted ? 'Sound muted' : 'Sound unmuted', 'info');
    });

    // Theme toggle
    elements.btnTheme.addEventListener('click', function () {
      var themes = ['walnut', 'emerald', 'midnight', 'ice'];
      var nextIdx = (themes.indexOf(state.theme) + 1) % themes.length;
      applyTheme(themes[nextIdx]);
      ui.showToast('Theme: ' + themes[nextIdx].toUpperCase(), 'info');
    });

    // Local Mode Options
    document.querySelectorAll('[data-local-time]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-local-time]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var val = btn.dataset.localTime;
        state.timeControl = (val === '0') ? null : parseInt(val, 10) * 60;
        startNewGame();
      });
    });

    // History Navigation Controls
    if (elements.btnNavStart) {
      elements.btnNavStart.addEventListener('click', function () {
        if (engine.history.length > 0) goToMove(-1);
      });
    }
    if (elements.btnNavPrev) {
      elements.btnNavPrev.addEventListener('click', function () {
        if (engine.history.length === 0) return;
        var cur = (state.previewIndex !== null) ? state.previewIndex : engine.history.length - 1;
        goToMove(Math.max(-1, cur - 1));
      });
    }
    if (elements.btnNavNext) {
      elements.btnNavNext.addEventListener('click', function () {
        if (engine.history.length === 0 || state.previewIndex === null) return;
        goToMove(state.previewIndex + 1);
      });
    }
    if (elements.btnNavEnd) {
      elements.btnNavEnd.addEventListener('click', function () {
        goToMove(null);
      });
    }

    // Keyboard Arrow navigation for move review
    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') {
        if (engine.history.length === 0) return;
        var cur = (state.previewIndex !== null) ? state.previewIndex : engine.history.length - 1;
        goToMove(Math.max(-1, cur - 1));
      } else if (e.key === 'ArrowRight') {
        if (engine.history.length === 0 || state.previewIndex === null) return;
        goToMove(state.previewIndex + 1);
      }
    });

    var autoFlipBtn = document.getElementById('btnToggleAutoFlip');
    if (autoFlipBtn) {
      autoFlipBtn.addEventListener('click', function () {
        state.autoFlipLocal = !state.autoFlipLocal;
        autoFlipBtn.classList.toggle('active', state.autoFlipLocal);
        ui.showToast(state.autoFlipLocal ? 'Auto-flip enabled' : 'Auto-flip disabled', 'info');
      });
    }

    // Robot Mode Options
    document.querySelectorAll('[data-bot-diff]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-bot-diff]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.robotDifficulty = btn.dataset.botDiff;
        ui.showToast('Robot difficulty: ' + state.robotDifficulty.toUpperCase(), 'info');
      });
    });

    document.querySelectorAll('[data-bot-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-bot-color]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var c = btn.dataset.botColor;
        state.playerColorVsBot = (c === 'random') ? (Math.random() < 0.5 ? 'w' : 'b') : c;
        startNewGame();
      });
    });

    // Online Mode Controls
    elements.btnCreateRoom.addEventListener('click', handleCreateOnlineRoom);
    elements.btnCopyLink.addEventListener('click', copyShareableLink);

    // Online Chat
    elements.btnSendChat.addEventListener('click', sendChatMessage);
    elements.chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendChatMessage();
    });

    elements.reactionBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.mode === 'online' && online) {
          online.sendChat(btn.textContent);
          appendChatMessage('You', btn.textContent, 'self');
        }
      });
    });

    // Game Over Modal buttons
    elements.btnModalRematch.addEventListener('click', function () {
      elements.gameOverModal.classList.remove('show');
      if (state.mode === 'online' && online) {
        online.sendAction('rematch_accept');
      }
      startNewGame();
    });

    elements.btnModalClose.addEventListener('click', function () {
      elements.gameOverModal.classList.remove('show');
    });
  }

  function switchMode(newMode) {
    state.mode = newMode;

    // Update Tab Styles
    elements.modeTabs.forEach(function (t) {
      t.classList.toggle('active', t.dataset.mode === newMode);
    });

    // Update Panels
    elements.modePanels.forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === newMode);
    });

    // Show/Hide Chat card (only active in online mode)
    elements.chatCard.style.display = (newMode === 'online') ? 'flex' : 'none';

    // Configure board orientation & permissions
    if (newMode === 'local') {
      ui.allowedColor = null; // Both players can move on same screen
      ui.setFlipped(false);
    } else if (newMode === 'robot') {
      ui.allowedColor = state.playerColorVsBot;
      ui.setFlipped(state.playerColorVsBot === 'b');
    } else if (newMode === 'online') {
      ui.allowedColor = state.onlinePlayerColor;
      ui.setFlipped(state.onlinePlayerColor === 'b');
    }

    startNewGame();
  }

  function startNewGame() {
    engine.reset();
    ui.clearSelection();
    ui.lastMove = null;

    if (state.mode === 'local') {
      ui.allowedColor = null;
    } else if (state.mode === 'robot') {
      ui.allowedColor = state.playerColorVsBot;
    } else if (state.mode === 'online') {
      ui.allowedColor = state.onlinePlayerColor;
    }

    // Reset clocks
    state.clocks = {
      w: state.timeControl || 0,
      b: state.timeControl || 0
    };
    stopClockTimer();
    updateClockDisplay();

    // Render Board
    ui.render(engine);
    updatePlayerCards();
    updateMoveHistory();
    updateStatusText();

    // If vs Robot and player picked Black, robot makes opening move!
    if (state.mode === 'robot' && state.playerColorVsBot === 'b') {
      triggerRobotMove();
    }
  }

  function handleUserMove(moveData) {
    if (state.isBotThinking) return;

    var result = engine.makeMove(moveData.from, moveData.to, moveData.promotion);
    if (!result) return;

    // Play Sound
    if (result.isCheckmate) {
      ChessSound.playGameEnd(true);
    } else if (result.inCheck) {
      ChessSound.playCheck();
    } else if (result.captured) {
      ChessSound.playCapture();
    } else if (result.move.isCastle) {
      ChessSound.playCastle();
    } else {
      ChessSound.playMove();
    }

    ui.setLastMove(result.move.from, result.move.to);
    ui.render(engine);
    updatePlayerCards();
    updateMoveHistory();
    updateStatusText();

    // Start / switch clock timer
    if (state.timeControl) {
      startClockTimer();
    }

    // Auto-flip for local 2-player pass & play if enabled
    if (state.mode === 'local' && state.autoFlipLocal) {
      ui.setFlipped(engine.turn === 'b');
      updatePlayerCardsOrientation();
    }

    // Check game over
    if (engine.isGameOver()) {
      handleGameOver(engine.getGameStatus());
      return;
    }

    // Mode-specific follow ups
    if (state.mode === 'robot' && engine.turn !== state.playerColorVsBot) {
      triggerRobotMove();
    } else if (state.mode === 'online' && online) {
      online.sendMove(result.move, result.fen, result.san);
    }
  }

  function triggerRobotMove() {
    state.isBotThinking = true;
    elements.robotThinking.classList.add('show');
    elements.robotComment.textContent = 'Robot is calculating...';

    // Slight delay (400 - 800ms) for human-like pacing
    setTimeout(function () {
      var botChoice = ChessAI.getBestMove(engine, state.robotDifficulty);
      state.isBotThinking = false;
      elements.robotThinking.classList.remove('show');

      if (!botChoice || !botChoice.move) return;

      var result = engine.makeMove(botChoice.move.from, botChoice.move.to, botChoice.move.promotion);
      if (!result) return;

      if (botChoice.comment) {
        elements.robotComment.textContent = botChoice.comment;
      }

      // Play Sound
      if (result.isCheckmate) {
        ChessSound.playGameEnd(false);
      } else if (result.inCheck) {
        ChessSound.playCheck();
      } else if (result.captured) {
        ChessSound.playCapture();
      } else if (result.move.isCastle) {
        ChessSound.playCastle();
      } else {
        ChessSound.playMove();
      }

      ui.setLastMove(result.move.from, result.move.to);
      ui.render(engine);
      updatePlayerCards();
      updateMoveHistory();
      updateStatusText();

      if (engine.isGameOver()) {
        handleGameOver(engine.getGameStatus());
      }
    }, 550);
  }

  function handleUndo() {
    if (engine.history.length === 0) return;

    if (state.mode === 'robot') {
      // Undo both robot move and user move
      engine.undo();
      if (engine.turn !== state.playerColorVsBot && engine.history.length > 0) {
        engine.undo();
      }
    } else if (state.mode === 'local') {
      engine.undo();
    } else {
      ui.showToast('Undo not allowed in online play', 'danger');
      return;
    }

    ui.clearSelection();
    var last = engine.history[engine.history.length - 1];
    if (last) {
      ui.setLastMove(last.from, last.to);
    } else {
      ui.lastMove = null;
    }

    ui.render(engine);
    updatePlayerCards();
    updateMoveHistory();
    updateStatusText();
    ui.showToast('Move undone', 'info');
  }

  function handleResign() {
    if (engine.isGameOver()) return;
    if (confirm('Are you sure you want to resign this game?')) {
      var resigningPlayer = (state.mode === 'online') ? state.onlinePlayerColor : engine.turn;
      var winner = (resigningPlayer === 'w') ? 'Black' : 'White';
      if (state.mode === 'online' && online) {
        online.sendAction('resign');
      }
      handleGameOver({
        gameOver: true,
        result: 'resignation',
        winner: winner.toLowerCase(),
        description: winner + ' wins by resignation.'
      });
    }
  }

  function handleGameOver(status) {
    stopClockTimer();

    var title = 'Game Over';
    var icon = '🤝';

    if (status.result === 'checkmate') {
      icon = '👑';
      title = (status.winner === 'white' ? 'White' : 'Black') + ' Wins by Checkmate!';
    } else if (status.result === 'resignation') {
      icon = '🏳️';
      title = (status.winner === 'white' ? 'White' : 'Black') + ' Wins by Resignation!';
    } else if (status.result === 'timeout') {
      icon = '⏱️';
      title = (status.winner === 'white' ? 'White' : 'Black') + ' Wins on Time!';
    } else {
      icon = '🤝';
      title = 'Game Drawn!';
    }

    elements.gameOverTitle.textContent = title;
    elements.gameOverDesc.textContent = status.description;
    elements.gameOverModal.classList.add('show');
  }

  // Clocks / Timers
  function startClockTimer() {
    stopClockTimer();
    state.clockTimer = setInterval(function () {
      var turn = engine.turn;
      if (state.clocks[turn] > 0) {
        state.clocks[turn]--;
        updateClockDisplay();

        if (state.clocks[turn] <= 10 && state.clocks[turn] > 0) {
          ChessSound.playTick();
        }

        if (state.clocks[turn] === 0) {
          stopClockTimer();
          var winner = (turn === 'w') ? 'black' : 'white';
          handleGameOver({
            gameOver: true,
            result: 'timeout',
            winner: winner,
            description: (winner === 'white' ? 'White' : 'Black') + ' wins on time (flag fall)!'
          });
        }
      }
    }, 1000);
  }

  function stopClockTimer() {
    if (state.clockTimer) {
      clearInterval(state.clockTimer);
      state.clockTimer = null;
    }
  }

  function formatTime(seconds) {
    if (seconds === null || seconds === undefined) return '∞';
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function updateClockDisplay() {
    if (!state.timeControl) {
      elements.topPlayerClock.textContent = 'Casual';
      elements.bottomPlayerClock.textContent = 'Casual';
      return;
    }

    var topColor = ui.flipped ? 'w' : 'b';
    var bottomColor = ui.flipped ? 'b' : 'w';

    elements.topPlayerClock.textContent = formatTime(state.clocks[topColor]);
    elements.bottomPlayerClock.textContent = formatTime(state.clocks[bottomColor]);

    elements.topPlayerClock.classList.toggle('low-time', state.clocks[topColor] < 30);
    elements.bottomPlayerClock.classList.toggle('low-time', state.clocks[bottomColor] < 30);
  }

  // Update Player Cards (Captured Pieces, Material Score, Active Turn)
  function updatePlayerCards() {
    var isWhiteTurn = (engine.turn === 'w');
    var topIsWhite = ui.flipped;

    elements.topPlayerCard.classList.toggle('active-turn', topIsWhite ? isWhiteTurn : !isWhiteTurn);
    elements.bottomPlayerCard.classList.toggle('active-turn', topIsWhite ? !isWhiteTurn : isWhiteTurn);

    // Captured pieces & material score
    var mat = engine.getMaterialAdvantage();
    renderCapturedTray(elements.topCaptured, topIsWhite ? engine.capturedPieces.w : engine.capturedPieces.b, topIsWhite ? mat.diff : -mat.diff);
    renderCapturedTray(elements.bottomCaptured, topIsWhite ? engine.capturedPieces.b : engine.capturedPieces.w, topIsWhite ? -mat.diff : mat.diff);

    updateClockDisplay();
  }

  function renderCapturedTray(container, piecesList, advantageScore) {
    container.innerHTML = '';
    for (var i = 0; i < piecesList.length; i++) {
      var p = piecesList[i];
      var mini = document.createElement('div');
      mini.className = 'captured-piece-mini';
      mini.innerHTML = window.ChessPieces.getSVG(p);
      container.appendChild(mini);
    }
    if (advantageScore > 0) {
      var badge = document.createElement('span');
      badge.className = 'material-diff-badge';
      badge.textContent = '+' + advantageScore;
      container.appendChild(badge);
    }
  }

  function updatePlayerCardsOrientation() {
    if (state.mode === 'robot') {
      var botIsWhite = (state.playerColorVsBot === 'b');
      if (ui.flipped) {
        elements.topPlayerName.textContent = 'You (Black)';
        elements.bottomPlayerName.textContent = 'Robot (' + state.robotDifficulty.toUpperCase() + ')';
      } else {
        elements.topPlayerName.textContent = 'Robot (' + state.robotDifficulty.toUpperCase() + ')';
        elements.bottomPlayerName.textContent = 'You (White)';
      }
    } else if (state.mode === 'local') {
      if (ui.flipped) {
        elements.topPlayerName.textContent = 'White (Player 1)';
        elements.bottomPlayerName.textContent = 'Black (Player 2)';
      } else {
        elements.topPlayerName.textContent = 'Black (Player 2)';
        elements.bottomPlayerName.textContent = 'White (Player 1)';
      }
    } else if (state.mode === 'online') {
      var selfColor = state.onlinePlayerColor;
      if (ui.flipped) {
        elements.topPlayerName.textContent = (selfColor === 'w') ? 'Opponent' : 'You (Black)';
        elements.bottomPlayerName.textContent = (selfColor === 'w') ? 'You (White)' : 'Opponent';
      } else {
        elements.topPlayerName.textContent = (selfColor === 'w') ? 'Opponent' : 'You (Black)';
        elements.bottomPlayerName.textContent = (selfColor === 'w') ? 'You (White)' : 'Opponent';
      }
    }
    updatePlayerCards();
  }

  function updateStatusText() {
    var status = engine.getGameStatus();
    elements.statusText.textContent = status.description;
    elements.statusDot.className = 'status-dot' + (status.gameOver ? ' waiting' : '');
  }

  function updateMoveHistory() {
    elements.movesList.innerHTML = '';
    var history = engine.history;

    for (var i = 0; i < history.length; i += 2) {
      var moveNum = (i / 2) + 1;
      var whiteMove = history[i];
      var blackMove = history[i + 1];

      var numEl = document.createElement('div');
      numEl.className = 'history-move-num';
      numEl.textContent = moveNum + '.';

      var isCurWhite = (state.previewIndex !== null) ? (state.previewIndex === i) : (i === history.length - 1);
      var isCurBlack = (state.previewIndex !== null) ? (state.previewIndex === i + 1) : (i + 1 === history.length - 1);

      var whiteEl = document.createElement('div');
      whiteEl.className = 'history-move-white' + (isCurWhite ? ' current' : '');
      whiteEl.textContent = whiteMove.san;
      whiteEl.addEventListener('click', (function (idx) {
        return function () { goToMove(idx); };
      })(i));

      var blackEl = document.createElement('div');
      blackEl.className = 'history-move-black' + (isCurBlack ? ' current' : '');
      blackEl.textContent = blackMove ? blackMove.san : '';
      if (blackMove) {
        blackEl.addEventListener('click', (function (idx) {
          return function () { goToMove(idx); };
        })(i + 1));
      }

      elements.movesList.appendChild(numEl);
      elements.movesList.appendChild(whiteEl);
      elements.movesList.appendChild(blackEl);
    }

    if (state.previewIndex === null) {
      elements.movesList.scrollTop = elements.movesList.scrollHeight;
    }
  }

  function goToMove(targetIndex) {
    if (targetIndex === null || targetIndex === undefined || targetIndex >= engine.history.length - 1) {
      state.previewIndex = null;
      ui.isInteractive = true;
      var last = engine.history[engine.history.length - 1];
      if (last) {
        ui.setLastMove(last.from, last.to);
      } else {
        ui.lastMove = null;
      }
      ui.render(engine);
      updatePlayerCards();
      updateMoveHistory();
      updateStatusText();
      return;
    }

    state.previewIndex = targetIndex;
    ui.isInteractive = false;
    ui.clearSelection();

    var previewEngine = new ChessEngine();
    if (targetIndex >= 0) {
      for (var i = 0; i <= targetIndex; i++) {
        var h = engine.history[i];
        previewEngine.makeMove(h.from, h.to, h.promotion);
      }
      var lastPreview = engine.history[targetIndex];
      ui.setLastMove(lastPreview.from, lastPreview.to);
    } else {
      ui.lastMove = null;
    }

    ui.render(previewEngine);
    updatePlayerCards(previewEngine);
    updateMoveHistory();

    var moveNum = targetIndex >= 0 ? (Math.floor(targetIndex / 2) + 1) + (targetIndex % 2 === 0 ? ' (White)' : ' (Black)') : 'Initial';
    elements.statusText.textContent = 'Inspecting move: ' + moveNum + ' • [Click ▶| for live]';
    elements.statusDot.className = 'status-dot waiting';
  }

  // =========================================================================
  // ONLINE MULTIPLAYER (Option 3)
  // =========================================================================

  function initOnlineManager() {
    online = new ChessOnline({
      onOpponentJoined: function (data) {
        state.onlineOpponentConnected = true;
        ui.showToast('Opponent connected! Game on! ♟️', 'success');
        appendChatMessage('System', 'Opponent connected to the room.', 'system');
        updatePlayerCardsOrientation();
      },

      onRemoteMove: function (data) {
        if (!data || !data.move) return;
        var result = engine.makeMove(data.move.from, data.move.to, data.move.promotion);
        if (!result) return;

        // Play Sound
        if (result.isCheckmate) {
          ChessSound.playGameEnd(false);
        } else if (result.inCheck) {
          ChessSound.playCheck();
        } else if (result.captured) {
          ChessSound.playCapture();
        } else if (result.move.isCastle) {
          ChessSound.playCastle();
        } else {
          ChessSound.playMove();
        }

        ui.setLastMove(result.move.from, result.move.to);
        ui.render(engine);
        updatePlayerCards();
        updateMoveHistory();
        updateStatusText();

        if (state.timeControl) {
          startClockTimer();
        }

        if (engine.isGameOver()) {
          handleGameOver(engine.getGameStatus());
        }
      },

      onChatMessage: function (data) {
        if (data.sender !== state.onlinePlayerColor) {
          appendChatMessage('Opponent', data.message, 'opponent');
        }
      },

      onGameAction: function (data) {
        var action = data.action;
        if (action === 'resign') {
          var winner = (data.sender === 'w') ? 'black' : 'white';
          handleGameOver({
            gameOver: true,
            result: 'resignation',
            winner: winner,
            description: 'Opponent resigned! You win!'
          });
        } else if (action === 'draw_offer') {
          if (data.sender !== state.onlinePlayerColor) {
            if (confirm('Opponent has offered a draw. Do you accept?')) {
              online.sendAction('draw_accept');
              handleGameOver({
                gameOver: true,
                result: 'mutual_agreement',
                winner: null,
                description: 'Game drawn by mutual agreement.'
              });
            } else {
              online.sendAction('draw_decline');
              ui.showToast('Draw offer declined.', 'info');
            }
          }
        } else if (action === 'draw_accept') {
          handleGameOver({
            gameOver: true,
            result: 'mutual_agreement',
            winner: null,
            description: 'Opponent accepted draw. Game drawn!'
          });
        } else if (action === 'draw_decline') {
          ui.showToast('Opponent declined the draw offer.', 'info');
        } else if (action === 'rematch_accept') {
          ui.showToast('Opponent accepted rematch!', 'success');
          startNewGame();
        }
      }
    });
  }

  function handleCreateOnlineRoom() {
    var timeChoice = document.querySelector('[data-online-time].active');
    var colorChoice = document.querySelector('[data-online-color].active');

    var timeVal = timeChoice ? timeChoice.dataset.onlineTime : '10';
    var colorVal = colorChoice ? colorChoice.dataset.onlineColor : 'random';

    online.createRoom({
      timeControl: timeVal,
      preferredColor: colorVal
    }, function (err, data) {
      if (err) {
        ui.showToast('Failed to create room: ' + err.message, 'danger');
        return;
      }

      state.onlineRoomId = data.roomId;
      state.onlinePlayerColor = data.color;
      state.timeControl = (timeVal === '0') ? null : parseInt(timeVal, 10) * 60;

      showActiveOnlineRoomUI();
      ui.allowedColor = state.onlinePlayerColor;
      ui.setFlipped(state.onlinePlayerColor === 'b');
      updatePlayerCardsOrientation();
      startNewGame();

      // Copy link automatically for convenience
      copyShareableLink();
    });
  }

  function showActiveOnlineRoomUI() {
    elements.onlineCreateBox.style.display = 'none';
    elements.onlineActiveBox.style.display = 'flex';

    var shareUrl = online.getShareableLink();
    elements.shareLinkInput.value = shareUrl;
    elements.roomCodeBadge.textContent = state.onlineRoomId;

    // Render QR Code onto Canvas
    if (window.SimpleQR && elements.qrCanvas) {
      SimpleQR.drawToCanvas(elements.qrCanvas, shareUrl, {
        size: 160,
        dark: '#1e293b',
        light: '#ffffff'
      });
    }

    appendChatMessage('System', 'Room ' + state.onlineRoomId + ' created. Share the link with your friend!', 'system');
  }

  function copyShareableLink() {
    var link = elements.shareLinkInput.value;
    if (!link) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () {
        ui.showToast('Link copied to clipboard! 📋', 'success');
      }).catch(function () {
        fallbackCopyText(link);
      });
    } else {
      fallbackCopyText(link);
    }
  }

  function fallbackCopyText(text) {
    elements.shareLinkInput.select();
    document.execCommand('copy');
    ui.showToast('Link copied to clipboard! 📋', 'success');
  }

  function sendChatMessage() {
    var text = elements.chatInput.value.trim();
    if (!text || !online) return;

    online.sendChat(text);
    appendChatMessage('You', text, 'self');
    elements.chatInput.value = '';
  }

  function appendChatMessage(sender, text, type) {
    var msgEl = document.createElement('div');
    msgEl.className = 'chat-msg ' + type;
    msgEl.textContent = (type === 'system') ? text : (sender + ': ' + text);
    elements.chatMessages.appendChild(msgEl);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  function checkUrlForRoom() {
    var params = new URLSearchParams(window.location.search);
    var roomId = params.get('room');
    if (roomId) {
      switchMode('online');
      elements.onlineCreateBox.style.display = 'none';
      elements.onlineActiveBox.style.display = 'flex';
      elements.roomCodeBadge.textContent = roomId.toUpperCase();

      online.joinRoom(roomId, function (err, data) {
        if (err) {
          ui.showToast('Could not join room: ' + err.message, 'danger');
          elements.onlineCreateBox.style.display = 'flex';
          elements.onlineActiveBox.style.display = 'none';
          return;
        }

        state.onlineRoomId = data.roomId;
        state.onlinePlayerColor = data.color;
        var timeVal = data.timeControl;
        state.timeControl = (timeVal === '0') ? null : parseInt(timeVal, 10) * 60;

        var shareUrl = online.getShareableLink();
        elements.shareLinkInput.value = shareUrl;

        ui.allowedColor = state.onlinePlayerColor;
        ui.setFlipped(state.onlinePlayerColor === 'b');
        updatePlayerCardsOrientation();

        if (data.fen) {
          engine.loadFEN(data.fen);
          ui.render(engine);
        }

        ui.showToast('Joined game as ' + (data.color === 'w' ? 'White' : 'Black') + '! 🎮', 'success');
        appendChatMessage('System', 'Connected as ' + (data.color === 'w' ? 'White' : 'Black') + '.', 'system');
      });
    }
  }

  // Self-initialization on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

