# ♟️ Chess - (Project by Netraa)

A modern, responsive, full-featured Chess web application built with **zero external dependencies**. Includes full FIDE chess rules, procedural audio, AI engine, and real-time multiplayer over shareable links.

---

## 🌟 Key Features & The 3 Game Modes

### 1. 👥 Option 1: 2 Players (Pass & Play)
- **Local Play on One Device**: Two players play on the same screen (desktop, laptop, tablet, or smartphone).
- **Time Controls**: Casual (No timer), 3 min Blitz, 5 min Blitz, 10 min Rapid, 15 min Standard.
- **Auto-Flip Board**: Optional automatic board rotation on turn changes so each player sees their side facing them.
- **Full Action Controls**: Move undo, board flip, resign, new game, and move-by-move SAN history review.

### 2. 🤖 Option 2: vs Robot (Computer AI Engine)
- **3 AI Difficulty Tiers**:
  - **Beginner (800 ELO)**: Depth 1 with casual play and human-like blunders. Perfect for learning.
  - **Club (1400 ELO)**: Depth 2 with Minimax, Alpha-Beta pruning, and Piece-Square Tables (PST). Punishes mistakes and controls the center.
  - **Master (1900+ ELO)**: Depth 3-4 with Move Ordering, Quiescence Search on tactical captures, and king safety heuristics.
- **Side Selection**: Play as White (move first), Black (robot moves first), or Random.
- **Robot Commentary & Live Feedback**: Displays the AI's tactical thoughts ("Scanning combinations...", "Calculating 1,200 positions...").

### 3. 🔗 Option 3: Play Online via Shareable Link
- **Instant Room Creation**: Generates a unique 6-character room code and direct link (e.g. `http://<your-ip>:8000/?room=K8X2M9`).
- **One-Click "Copy Link"**: Copy the invitation link directly to your clipboard.
- **Live QR Code**: A QR code is generated on canvas for your friend or opponent across the table to scan with their phone camera and join instantly.
- **Zero Latency Synchronization**: Powered by Server-Sent Events (SSE) with an automatic fast-polling fallback. Moves, clocks, and turns stay perfectly synchronized.
- **In-Game Live Chat**: Send instant messages and emoji reactions (🔥, 👏, 🧠, 😮, ♟️, 👑) during online games.
- **Resignation & Rematch**: Rematch requests and resignations sync seamlessly between players.

---

## 🚀 How to Run

No `npm install`, `pip install`, or external dependencies required! Uses only the built-in Python standard library.

### Quick Start:
```bash
./run.sh
```
or
```bash
python3 server.py
```

Open your browser to:
- **Local Browser**: [http://localhost:8000](http://localhost:8000)
- **Network Devices (Wi-Fi)**: `http://<YOUR_LOCAL_IP>:8000` (printed in the terminal upon server launch)

> **Playing across different devices**: Any device connected to the same Wi-Fi network (laptop, iPhone, Android, iPad) can access the server using your local IP address. When you create an online game, share that link or let them scan the QR code!

---

## 🎨 Visuals & Audio Experience

- **High-Definition Staunton Vector SVGs**: Scalable vector chess pieces that look crystal-sharp on Retina and 4K displays.
- **Multiple Board Themes**:
  - 🪵 **Walnut Classic**: Warm maple and walnut wood aesthetic.
  - 🌿 **Emerald Tournament**: Classic tournament green & cream.
  - 🌌 **Midnight Dark**: Sleek dark slate and graphite styling.
  - ❄️ **Ice Crystal**: Arctic steel and glacial blue.
- **Procedural Web Audio Engine**: Realistic wooden move thuds, crisp capture impacts, double-tone check alerts, castling slides, and victory chords generated purely via the browser's Web Audio API (100% offline, no audio files to fail to load).
- **Interactive Move Modes**: Both **Click-to-Move** and **Drag-and-Drop** with touch support for mobile screens.

---

## 📁 Project Architecture

```
chess/
├── server.py              # Multi-threaded Python server (Static files, Room REST API, SSE streaming, Polling)
├── run.sh                 # One-click startup script (chmod +x)
├── README.md              # Project documentation
├── tests/                 # Automated unit tests
│   ├── test_engine.js     # Chess rules, castling, en passant, promotion, mate tests
│   ├── test_ai.js         # Minimax AI depth & tactical capture tests
│   ├── test_qrcode.js     # QR code generation tests
│   └── test_server_logic.py# Server room management, event dispatch, & chat tests
└── static/
    ├── index.html         # Main web application layout
    ├── css/
    │   ├── style.css      # Luxury modern styling, responsive grid, chat, cards, modals
    │   └── board.css      # Chessboard grid, square themes, piece scaling, highlights
    └── js/
        ├── pieces.js      # Vector Staunton SVG definitions
        ├── engine.js      # FIDE-compliant chess engine (move generation, checks, SAN, FEN)
        ├── ai.js          # Minimax AI with Alpha-Beta pruning & 3 difficulty tiers
        ├── sound.js       # Web Audio API synthesized procedural sounds
        ├── qrcode.js      # Canvas-based QR code generator for link sharing
        ├── ui.js          # Board rendering, drag-and-drop, touch events, promotion modal
        ├── online.js      # Multiplayer client (SSE stream, polling fallback, room sync)
        └── app.js         # Application controller, clock timers, mode switcher
```

---

## 🧪 Running the Automated Tests

To run the unit tests at any time:

```bash
# Test Chess Rules, Castling, En Passant, Checkmate
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_engine.js

# Test Minimax AI & Tactical Capture
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_ai.js

# Test QR Code Generation
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/test_qrcode.js

# Test Python Server & Multiplayer Room Logic
python3 tests/test_server_logic.py
```

