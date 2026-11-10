/**
 * ChessOnline - Online Multiplayer Manager.
 * Coordinates room creation, link sharing, move synchronization, and live chat
 * via Server-Sent Events (SSE) with seamless HTTP polling fallback.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.ChessOnline = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function ChessOnline(callbacks) {
    this.callbacks = callbacks || {};
    this.roomId = null;
    this.playerToken = null;
    this.playerColor = null;
    this.eventSource = null;
    this.pollInterval = null;
    this.lastEventSeq = 0;
    this.isHost = false;
    this.status = 'disconnected'; // 'connecting', 'waiting', 'playing', 'ended'
  }

  ChessOnline.prototype.createRoom = function (options, callback) {
    var self = this;
    options = options || {};

    fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeControl: options.timeControl || '10', // minutes (or 'unlimited')
        preferredColor: options.preferredColor || 'random'
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success) {
          if (callback) callback(new Error(data.error || 'Failed to create room'));
          return;
        }
        self.roomId = data.roomId;
        self.playerToken = data.token;
        self.playerColor = data.color;
        self.isHost = true;
        self.status = 'waiting';
        self.connectStream();

        if (callback) callback(null, data);
      })
      .catch(function (err) {
        if (callback) callback(err);
      });
  };

  ChessOnline.prototype.joinRoom = function (roomId, callback) {
    var self = this;
    self.roomId = roomId.toUpperCase().trim();

    fetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: self.roomId })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success) {
          if (callback) callback(new Error(data.error || 'Failed to join room'));
          return;
        }
        self.roomId = data.roomId;
        self.playerToken = data.token;
        self.playerColor = data.color;
        self.isHost = false;
        self.status = data.gameReady ? 'playing' : 'waiting';
        self.connectStream();

        if (callback) callback(null, data);
      })
      .catch(function (err) {
        if (callback) callback(err);
      });
  };

  ChessOnline.prototype.connectStream = function () {
    var self = this;
    this.disconnectStream();

    var streamUrl = '/api/rooms/stream?roomId=' + encodeURIComponent(this.roomId) +
                    '&token=' + encodeURIComponent(this.playerToken);

    if (typeof EventSource !== 'undefined') {
      try {
        this.eventSource = new EventSource(streamUrl);

        this.eventSource.onopen = function () {
          // Connected to SSE stream
        };

        this.eventSource.onmessage = function (e) {
          try {
            var event = JSON.parse(e.data);
            self.handleServerEvent(event);
          } catch (err) {}
        };

        this.eventSource.onerror = function () {
          // Fallback to polling if SSE encounters issues
          self.startPollingFallback();
        };
      } catch (e) {
        self.startPollingFallback();
      }
    } else {
      self.startPollingFallback();
    }
  };

  ChessOnline.prototype.startPollingFallback = function () {
    var self = this;
    if (this.pollInterval) return;

    this.pollInterval = setInterval(function () {
      if (!self.roomId || !self.playerToken) return;

      fetch('/api/rooms/poll?roomId=' + encodeURIComponent(self.roomId) +
            '&token=' + encodeURIComponent(self.playerToken) +
            '&since=' + self.lastEventSeq)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.events && data.events.length > 0) {
            for (var i = 0; i < data.events.length; i++) {
              self.handleServerEvent(data.events[i]);
            }
          }
        })
        .catch(function () {});
    }, 750);
  };

  ChessOnline.prototype.handleServerEvent = function (event) {
    if (!event || !event.type) return;
    if (event.seq && event.seq <= this.lastEventSeq) return;
    if (event.seq) this.lastEventSeq = event.seq;

    var type = event.type;
    var data = event.data || {};

    if (type === 'opponent_joined') {
      this.status = 'playing';
      if (this.callbacks.onOpponentJoined) this.callbacks.onOpponentJoined(data);
    } else if (type === 'move_made') {
      if (this.callbacks.onRemoteMove) this.callbacks.onRemoteMove(data);
    } else if (type === 'chat_message') {
      if (this.callbacks.onChatMessage) this.callbacks.onChatMessage(data);
    } else if (type === 'game_action') {
      if (this.callbacks.onGameAction) this.callbacks.onGameAction(data);
    } else if (type === 'opponent_status') {
      if (this.callbacks.onOpponentStatus) this.callbacks.onOpponentStatus(data);
    }
  };

  ChessOnline.prototype.sendMove = function (moveData, fen, san, callback) {
    if (!this.roomId || !this.playerToken) return;

    fetch('/api/rooms/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: this.roomId,
        token: this.playerToken,
        move: moveData,
        fen: fen,
        san: san
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (callback) callback(null, data);
      })
      .catch(function (err) {
        if (callback) callback(err);
      });
  };

  ChessOnline.prototype.sendChat = function (message, callback) {
    if (!this.roomId || !this.playerToken || !message) return;

    fetch('/api/rooms/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: this.roomId,
        token: this.playerToken,
        message: message
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (callback) callback(null, data);
      })
      .catch(function (err) {
        if (callback) callback(err);
      });
  };

  ChessOnline.prototype.sendAction = function (action, payload, callback) {
    if (!this.roomId || !this.playerToken) return;

    fetch('/api/rooms/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: this.roomId,
        token: this.playerToken,
        action: action,
        payload: payload || {}
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (callback) callback(null, data);
      })
      .catch(function (err) {
        if (callback) callback(err);
      });
  };

  ChessOnline.prototype.getShareableLink = function () {
    if (!this.roomId) return '';
    var origin = window.location.origin;
    return origin + '/?room=' + encodeURIComponent(this.roomId);
  };

  ChessOnline.prototype.disconnectStream = function () {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  };

  ChessOnline.prototype.leaveRoom = function () {
    this.disconnectStream();
    this.roomId = null;
    this.playerToken = null;
    this.playerColor = null;
    this.status = 'disconnected';
  };

  return ChessOnline;
});

