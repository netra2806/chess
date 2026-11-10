/**
 * ChessSound - High fidelity procedural sound effects using Web Audio API.
 * 100% self-contained, no external MP3/WAV assets required.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.ChessSound = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var audioCtx = null;
  var isMuted = false;

  function getAudioContext() {
    if (!audioCtx && typeof window !== 'undefined') {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  var ChessSound = {
    isMuted: function () {
      return isMuted;
    },

    setMuted: function (muted) {
      isMuted = Boolean(muted);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('chess_muted', isMuted ? '1' : '0');
        }
      } catch (e) {}
    },

    toggleMuted: function () {
      this.setMuted(!isMuted);
      return isMuted;
    },

    initFromStorage: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          var val = localStorage.getItem('chess_muted');
          if (val === '1') isMuted = true;
        }
      } catch (e) {}
    },

    // Move sound: warm wood thud
    playMove: function () {
      if (isMuted) return;
      var ctx = getAudioContext();
      if (!ctx) return;

      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    },

    // Capture sound: sharp crisp click with impact
    playCapture: function () {
      if (isMuted) return;
      var ctx = getAudioContext();
      if (!ctx) return;

      var now = ctx.currentTime;

      // Click transient
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(480, now);
      osc1.frequency.exponentialRampToValueAtTime(110, now + 0.07);

      gain1.gain.setValueAtTime(0.6, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.09);

      // Body thump
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(160, now + 0.01);
      osc2.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain2.gain.setValueAtTime(0.5, now + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.01);
      osc2.stop(now + 0.14);
    },

    // Check sound: 2-tone melodic alert chime
    playCheck: function () {
      if (isMuted) return;
      var ctx = getAudioContext();
      if (!ctx) return;

      var now = ctx.currentTime;

      function playTone(freq, start, duration) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.35, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      }

      playTone(587.33, now, 0.12); // D5
      playTone(880.00, now + 0.1, 0.22); // A5
    },

    // Castle sound: double sliding piece sound
    playCastle: function () {
      if (isMuted) return;
      var self = this;
      self.playMove();
      setTimeout(function () {
        self.playMove();
      }, 120);
    },

    // Game End sound: victory or draw/defeat chord
    playGameEnd: function (isVictory) {
      if (isMuted) return;
      var ctx = getAudioContext();
      if (!ctx) return;

      var now = ctx.currentTime;
      var notes = isVictory ? [523.25, 659.25, 783.99, 1046.50] : [392.00, 369.99, 349.23, 329.63];

      for (var i = 0; i < notes.length; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = isVictory ? 'triangle' : 'sine';
        var noteStart = now + (i * 0.11);
        osc.frequency.setValueAtTime(notes[i], noteStart);

        gain.gain.setValueAtTime(0.3, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteStart);
        osc.stop(noteStart + 0.5);
      }
    },

    // Clock low time warning tick
    playTick: function () {
      if (isMuted) return;
      var ctx = getAudioContext();
      if (!ctx) return;

      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  };

  ChessSound.initFromStorage();
  return ChessSound;
});

