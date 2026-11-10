// Test SimpleQR
load('static/js/qrcode.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

print('Testing SimpleQR...');

// Create mock canvas and context
var drawCalls = 0;
var mockContext = {
  fillStyle: '',
  fillRect: function (x, y, w, h) {
    drawCalls++;
  }
};

var mockCanvas = {
  width: 0,
  height: 0,
  getContext: function (type) {
    return mockContext;
  }
};

SimpleQR.drawToCanvas(mockCanvas, 'http://192.168.1.5:8000/?room=ABC123', { size: 160 });
assert(mockCanvas.width === 160, 'Canvas width set to 160');
assert(mockCanvas.height === 160, 'Canvas height set to 160');
assert(drawCalls > 20, 'QR squares drawn to canvas');

print('SimpleQR rendered successfully with ' + drawCalls + ' module fillRect operations!');
print('SimpleQR test PASSED!');

