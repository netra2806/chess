/**
 * SimpleQR - Lightweight self-contained QR Code generator for HTML5 Canvas.
 * Generates standard QR codes for URLs and room links without external dependencies.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.SimpleQR = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Minimal QR code encoder for URLs (ISO/IEC 18004)
  // Supports alphanumeric/byte mode for typical room URLs up to ~120 chars

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype = {
    get: function (index) {
      var bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
    },
    put: function (num, length) {
      for (var i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    },
    putBit: function (bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) {
        this.buffer.push(0);
      }
      if (bit) {
        this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      }
      this.length++;
    }
  };

  var QRPolynomial = {
    glog: function (n) {
      if (n < 1) throw new Error('glog(' + n + ')');
      return LOG_TABLE[n];
    },
    gexp: function (n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return EXP_TABLE[n];
    }
  };

  var EXP_TABLE = new Array(256);
  var LOG_TABLE = new Array(256);
  for (var i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
  for (var i = 8; i < 256; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
  }
  for (var i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

  function Poly(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    for (var j = num.length - offset; j < this.num.length; j++) this.num[j] = 0;
  }
  Poly.prototype = {
    multiply: function (e) {
      var num = new Array(this.num.length + e.num.length - 1);
      for (var i = 0; i < num.length; i++) num[i] = 0;
      for (var i = 0; i < this.num.length; i++) {
        for (var j = 0; j < e.num.length; j++) {
          num[i + j] ^= QRPolynomial.gexp(QRPolynomial.glog(this.num[i]) + QRPolynomial.glog(e.num[j]));
        }
      }
      return new Poly(num, 0);
    },
    mod: function (e) {
      if (this.num.length - e.num.length < 0) return this;
      var ratio = QRPolynomial.glog(this.num[0]) - QRPolynomial.glog(e.num[0]);
      var num = new Array(this.num.length);
      for (var i = 0; i < this.num.length; i++) num[i] = this.num[i];
      for (var i = 0; i < e.num.length; i++) {
        num[i] ^= QRPolynomial.gexp(QRPolynomial.glog(e.num[i]) + ratio);
      }
      return new Poly(num, 0).mod(e);
    }
  };

  function getErrorCorrectPolynomial(errorCorrectLength) {
    var a = new Poly([1], 0);
    for (var i = 0; i < errorCorrectLength; i++) {
      a = a.multiply(new Poly([1, QRPolynomial.gexp(i)], 0));
    }
    return a;
  }

  // Version table: total bytes & ECC bytes (Level L)
  // [totalCodewords, ecCodewords]
  var VERSION_PARAMS = [
    null,
    [26, 7],   // V1
    [44, 10],  // V2
    [70, 15],  // V3
    [100, 20], // V4
    [134, 26], // V5
    [172, 36], // V6
    [196, 40]  // V7
  ];

  function chooseVersion(dataLength) {
    // 8 bits per byte + mode + count
    for (var v = 1; v <= 7; v++) {
      var cap = VERSION_PARAMS[v][0] - VERSION_PARAMS[v][1];
      if (dataLength + 3 <= cap) return v;
    }
    return 7;
  }

  function QRCodeModel(typeNumber) {
    this.typeNumber = typeNumber;
    this.moduleCount = typeNumber * 4 + 17;
    this.modules = null;
  }

  QRCodeModel.prototype = {
    make: function (data) {
      var buffer = new QRBitBuffer();
      // Byte mode: 0100
      buffer.put(4, 4);
      buffer.put(data.length, this.typeNumber < 10 ? 8 : 16);
      for (var i = 0; i < data.length; i++) {
        buffer.put(data.charCodeAt(i), 8);
      }

      var totalDataCount = VERSION_PARAMS[this.typeNumber][0] - VERSION_PARAMS[this.typeNumber][1];
      if (buffer.length + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
      while (buffer.length % 8 !== 0) {
        buffer.putBit(false);
      }
      while (buffer.length < totalDataCount * 8) {
        buffer.put(0xec, 8);
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0x11, 8);
      }

      var dataBytes = buffer.buffer;
      var ecCount = VERSION_PARAMS[this.typeNumber][1];
      var rsPoly = getErrorCorrectPolynomial(ecCount);
      var rawPoly = new Poly(dataBytes, rsPoly.num.length - 1);
      var modPoly = rawPoly.mod(rsPoly);

      var finalCodewords = dataBytes.slice();
      for (var j = 0; j < rsPoly.num.length - 1; j++) {
        var modIndex = j + modPoly.num.length - (rsPoly.num.length - 1);
        finalCodewords.push((modIndex >= 0) ? modPoly.num[modIndex] : 0);
      }

      this.createModules(finalCodewords);
    },

    createModules: function (dataWords) {
      var count = this.moduleCount;
      this.modules = new Array(count);
      for (var r = 0; r < count; r++) {
        this.modules[r] = new Array(count);
        for (var c = 0; c < count; c++) this.modules[r][c] = null;
      }

      // Position patterns
      this.setupFinderPattern(0, 0);
      this.setupFinderPattern(count - 7, 0);
      this.setupFinderPattern(0, count - 7);

      // Alignment pattern for V2+
      if (this.typeNumber >= 2) {
        var alignPos = count - 7;
        this.setupAlignmentPattern(alignPos, alignPos);
      }

      // Timing patterns
      for (var t = 8; t < count - 8; t++) {
        if (this.modules[t][6] === null) this.modules[t][6] = (t % 2 === 0);
        if (this.modules[6][t] === null) this.modules[6][t] = (t % 2 === 0);
      }

      // Map data bits
      var bitIdx = 0;
      var bitCount = dataWords.length * 8;
      var inc = -1;
      var row = count - 1;
      var col = count - 1;

      while (col > 0) {
        if (col === 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            var currCol = col - c;
            if (this.modules[row][currCol] === null) {
              var bit = false;
              if (bitIdx < bitCount) {
                var byteI = Math.floor(bitIdx / 8);
                var mask = 0x80 >>> (bitIdx % 8);
                bit = (dataWords[byteI] & mask) !== 0;
              }
              // Mask pattern 0: (row + col) % 2 === 0
              var maskCondition = ((row + currCol) % 2 === 0);
              this.modules[row][currCol] = bit ^ maskCondition;
              bitIdx++;
            }
          }
          row += inc;
          if (row < 0 || count <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
        col -= 2;
      }

      // Fill remaining nulls
      for (var r2 = 0; r2 < count; r2++) {
        for (var c2 = 0; c2 < count; c2++) {
          if (this.modules[r2][c2] === null) this.modules[r2][c2] = false;
        }
      }
    },

    setupFinderPattern: function (row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
              (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
              (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },

    setupAlignmentPattern: function (row, col) {
      for (var r = -2; r <= 2; r++) {
        for (var c = -2; c <= 2; c++) {
          if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    }
  };

  return {
    drawToCanvas: function (canvas, text, options) {
      options = options || {};
      var size = options.size || 200;
      var darkColor = options.dark || '#1a1f2c';
      var lightColor = options.light || '#ffffff';

      var version = chooseVersion(text.length);
      var qr = new QRCodeModel(version);
      qr.make(text);

      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = lightColor;
      ctx.fillRect(0, 0, size, size);

      var count = qr.moduleCount;
      var margin = 2; // quiet zone modules
      var totalModules = count + margin * 2;
      var cellSize = size / totalModules;

      ctx.fillStyle = darkColor;
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.modules[r][c]) {
            var x = Math.round((c + margin) * cellSize);
            var y = Math.round((r + margin) * cellSize);
            var w = Math.ceil(cellSize);
            var h = Math.ceil(cellSize);
            ctx.fillRect(x, y, w, h);
          }
        }
      }
    }
  };
});

