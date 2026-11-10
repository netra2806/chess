/**
 * Vector SVG Chess Pieces - Staunton Design.
 * Rendered with crisp strokes, subtle gradients, and retina-ready SVG paths.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.ChessPieces = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SVG_PIECES = {
    // White Pawn
    wP: '<svg viewBox="0 0 45 45"><path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 1.47,-1.19 2.41,-3 2.41,-5.03 0,-2.41 -1.33,-4.5 -3.28,-5.62 0.49,-0.67 0.78,-1.49 0.78,-2.38 0,-2.21 -1.79,-4 -4,-4 z" style="fill:#ffffff; stroke:#1a1a1a; stroke-width:1.5; stroke-linecap:round;" /></svg>',

    // White Knight
    wN: '<svg viewBox="0 0 45 45"><g style="fill:none; stroke:#1a1a1a; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,30 9.65,24 9,14 14,14 17.5,18.5 17.5,18.5 18,17 21,14 21,11 21,8.5 19,8.5 19,8.5 c 0,0 5,-0.5 5,2.5 z" style="fill:#ffffff; stroke:#1a1a1a;"/><path d="m 24,18 c 0.38,2.91 -5.55,7.37 -8,9 -3,2 -2.82,4.34 -5,4 -1.04,-0.94 -1.12,-2.34 0,-3 1.94,-1.14 4.54,-2.02 5.5,-4 1.1,-2.28 0.46,-3.6 -1,-6.5 -0.5,-1 0,-3.5 1.5,-4 2.5,0.5 6.5,1.5 7,4.5 z" style="fill:#ffffff; stroke:#1a1a1a;"/><circle cx="15" cy="14.5" r="1.5" style="fill:#1a1a1a; stroke:none;"/></g></svg>',

    // White Bishop
    wB: '<svg viewBox="0 0 45 45"><g style="fill:none; stroke:#1a1a1a; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><g style="fill:#ffffff; stroke:#1a1a1a; stroke-linecap:butt;"><path d="m 9,36 c 3.39,-0.97 10.11,0.43 13.5,-2 3.39,2.43 10.11,1.03 13.5,2 0,0 1.65,0.54 3,2 -0.68,0.97 -1.65,0.99 -3,0.5 -3.39,-0.49 -10.11,1.37 -13.5,-0.66 C 19.11,39.86 12.39,38.02 9,38.5 7.65,38.99 6.68,38.97 6,38 7.35,36.54 9,36 9,36 z"/><path d="m 15,32 c 2.5,2.5 12.5,2.5 15,0 0.5,-1.5 0,-2 0,-2 0,-2.5 -2.5,-4 -2.5,-4 5.5,-1.5 6,-11.5 -5,-15.5 -11,4 -10.5,14 -5,15.5 0,0 -2.5,1.5 -2.5,4 0,0 -0.5,0.5 0,2 z"/><path d="m 25,8 a 2.5,2.5 0 1 1 -5,0 2.5,2.5 0 1 1 5,0 z"/></g><path d="m 17.5,26 h 10 M 15,30 h 15 M 22.5,15.5 v 5 M 20,18 h 5" style="stroke:#1a1a1a; stroke-linejoin:miter;"/></g></svg>',

    // White Rook
    wR: '<svg viewBox="0 0 45 45"><g style="fill:#ffffff; stroke:#1a1a1a; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 9,39 h 27 v -3 H 9 v 3 z m 3,-3 v -4.5 h 21 V 36 H 12 z m -1,-7.5 c 2,-1 1,-5 1,-7 0,-3 1.5,-4 3.5,-4 h 14 c 2,0 3.5,1 3.5,4 0,2 -1,6 1,7 H 11 z m 1,-14.5 h 3 v 4 h 4 v -4 h 7 v 4 h 4 v -4 h 3 v 6 H 12 v -6 z" style="stroke-linecap:butt;"/><path d="m 14,29.5 h 17" style="fill:none; stroke-width:1;"/></g></svg>',

    // White Queen
    wQ: '<svg viewBox="0 0 45 45"><g style="fill:#ffffff; stroke:#1a1a1a; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 9,26 c 8.5,-1.5 21,-1.5 27,0 l 2.5,-12.5 L 31,25 l -3.5,-15 -5,14 -5,-14 -3.5,14 -7.5,-11.5 z"/><path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1.5,2.5 -1.5,2.5 -1.5,1.5 0.5,2.5 0.5,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0.5,-2.5 0,0 0,-1.5 -1.5,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4-8.5,-1.5 -18.5,-1.5 -27,0 z"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/></g></svg>',

    // White King
    wK: '<svg viewBox="0 0 45 45"><g style="fill:none; stroke:#1a1a1a; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 22.5,11.63 v 6 M 20,13.5 h 5" style="stroke-linejoin:miter;"/><path d="m 22.5,25 c 0,0 4.5,-7.5 3,-10.5 -1,-1.5 -3,-1.5 -3,-1.5 0,0 -2,0 -3,1.5 -1.5,3 3,10.5 3,10.5" style="fill:#ffffff; stroke-linecap:butt;"/><path d="m 11.5,37 c 5.5,3.5 15.5,3.5 21,0 v -7 c 0,0 9,-4.5 6,-10.5 -4,-1 -6,2 -6,2 0,0 0,-4 -5,-4 -6,0 -5,4 -5,4 0,0 -1,-4 -5,-4 -5,0 -5,4 -5,4 0,0 -2,-3 -6,-2 -3,6 6,10.5 6,10.5 v 7 z" style="fill:#ffffff;"/><path d="m 20,8 h 5 M 22.5,5.5 v 5" style="stroke-linejoin:miter;"/><path d="m 11.5,30 c 5.5,-2 15.5,-2 21,0 M 11.5,33.5 c 5.5,-2 15.5,-2 21,0 M 11.5,37 c 5.5,-2 15.5,-2 21,0"/></g></svg>',

    // Black Pawn
    bP: '<svg viewBox="0 0 45 45"><path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 1.47,-1.19 2.41,-3 2.41,-5.03 0,-2.41 -1.33,-4.5 -3.28,-5.62 0.49,-0.67 0.78,-1.49 0.78,-2.38 0,-2.21 -1.79,-4 -4,-4 z" style="fill:#2b2b2b; stroke:#e0e0e0; stroke-width:1.5; stroke-linecap:round;" /></svg>',

    // Black Knight
    bN: '<svg viewBox="0 0 45 45"><g style="fill:none; stroke:#e0e0e0; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,30 9.65,24 9,14 14,14 17.5,18.5 17.5,18.5 18,17 21,14 21,11 21,8.5 19,8.5 19,8.5 c 0,0 5,-0.5 5,2.5 z" style="fill:#2b2b2b; stroke:#e0e0e0;"/><path d="m 24,18 c 0.38,2.91 -5.55,7.37 -8,9 -3,2 -2.82,4.34 -5,4 -1.04,-0.94 -1.12,-2.34 0,-3 1.94,-1.14 4.54,-2.02 5.5,-4 1.1,-2.28 0.46,-3.6 -1,-6.5 -0.5,-1 0,-3.5 1.5,-4 2.5,0.5 6.5,1.5 7,4.5 z" style="fill:#2b2b2b; stroke:#e0e0e0;"/><circle cx="15" cy="14.5" r="1.5" style="fill:#e0e0e0; stroke:none;"/></g></svg>',

    // Black Bishop
    bB: '<svg viewBox="0 0 45 45"><g style="fill:none; stroke:#e0e0e0; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><g style="fill:#2b2b2b; stroke:#e0e0e0; stroke-linecap:butt;"><path d="m 9,36 c 3.39,-0.97 10.11,0.43 13.5,-2 3.39,2.43 10.11,1.03 13.5,2 0,0 1.65,0.54 3,2 -0.68,0.97 -1.65,0.99 -3,0.5 -3.39,-0.49 -10.11,1.37 -13.5,-0.66 C 19.11,39.86 12.39,38.02 9,38.5 7.65,38.99 6.68,38.97 6,38 7.35,36.54 9,36 9,36 z"/><path d="m 15,32 c 2.5,2.5 12.5,2.5 15,0 0.5,-1.5 0,-2 0,-2 0,-2.5 -2.5,-4 -2.5,-4 5.5,-1.5 6,-11.5 -5,-15.5 -11,4 -10.5,14 -5,15.5 0,0 -2.5,1.5 -2.5,4 0,0 -0.5,0.5 0,2 z"/><path d="m 25,8 a 2.5,2.5 0 1 1 -5,0 2.5,2.5 0 1 1 5,0 z"/></g><path d="m 17.5,26 h 10 M 15,30 h 15 M 22.5,15.5 v 5 M 20,18 h 5" style="stroke:#e0e0e0; stroke-linejoin:miter;"/></g></svg>',

    // Black Rook
    bR: '<svg viewBox="0 0 45 45"><g style="fill:#2b2b2b; stroke:#e0e0e0; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 9,39 h 27 v -3 H 9 v 3 z m 3,-3 v -4.5 h 21 V 36 H 12 z m -1,-7.5 c 2,-1 1,-5 1,-7 0,-3 1.5,-4 3.5,-4 h 14 c 2,0 3.5,1 3.5,4 0,2 -1,6 1,7 H 11 z m 1,-14.5 h 3 v 4 h 4 v -4 h 7 v 4 h 4 v -4 h 3 v 6 H 12 v -6 z" style="stroke-linecap:butt;"/><path d="m 14,29.5 h 17" style="fill:none; stroke-width:1;"/></g></svg>',

    // Black Queen
    bQ: '<svg viewBox="0 0 45 45"><g style="fill:#2b2b2b; stroke:#e0e0e0; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 9,26 c 8.5,-1.5 21,-1.5 27,0 l 2.5,-12.5 L 31,25 l -3.5,-15 -5,14 -5,-14 -3.5,14 -7.5,-11.5 z"/><path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1.5,2.5 -1.5,2.5 -1.5,1.5 0.5,2.5 0.5,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0.5,-2.5 0,0 0,-1.5 -1.5,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4-8.5,-1.5 -18.5,-1.5 -27,0 z"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/></g></svg>',

    // Black King
    bK: '<svg viewBox="0 0 45 45"><g style="fill:none; stroke:#e0e0e0; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round"><path d="m 22.5,11.63 v 6 M 20,13.5 h 5" style="stroke-linejoin:miter;"/><path d="m 22.5,25 c 0,0 4.5,-7.5 3,-10.5 -1,-1.5 -3,-1.5 -3,-1.5 0,0 -2,0 -3,1.5 -1.5,3 3,10.5 3,10.5" style="fill:#2b2b2b; stroke-linecap:butt;"/><path d="m 11.5,37 c 5.5,3.5 15.5,3.5 21,0 v -7 c 0,0 9,-4.5 6,-10.5 -4,-1 -6,2 -6,2 0,0 0,-4 -5,-4 -6,0 -5,4 -5,4 0,0 -1,-4 -5,-4 -5,0 -5,4 -5,4 0,0 -2,-3 -6,-2 -3,6 6,10.5 6,10.5 v 7 z" style="fill:#2b2b2b;"/><path d="m 20,8 h 5 M 22.5,5.5 v 5" style="stroke-linejoin:miter;"/><path d="m 11.5,30 c 5.5,-2 15.5,-2 21,0 M 11.5,33.5 c 5.5,-2 15.5,-2 21,0 M 11.5,37 c 5.5,-2 15.5,-2 21,0"/></g></svg>'
  };

  return {
    getSVG: function (piece) {
      if (!piece) return '';
      var key = piece.color + piece.type.toUpperCase();
      return SVG_PIECES[key] || '';
    },
    getSVGByKey: function (key) {
      return SVG_PIECES[key] || '';
    }
  };
});

