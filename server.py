#!/usr/bin/env python3
"""
Chess Server - Multi-threaded HTTP server with REST, Server-Sent Events (SSE),
and static file serving for local, AI, and online multiplayer chess.
Zero third-party dependencies; uses only Python standard library.
"""

import sys
import os
import json
import time
import uuid
import random
import socket
import sqlite3
import threading
import mimetypes
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

PORT = 8000
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(ROOT_DIR, 'static')
DB_FILE = os.path.join(ROOT_DIR, 'chess.db')

# Initialize SQLite database for persistent games and moves
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            created REAL,
            last_activity REAL,
            time_control TEXT,
            host_token TEXT,
            host_color TEXT,
            guest_token TEXT,
            guest_color TEXT,
            status TEXT,
            fen TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS moves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            move_num INTEGER,
            color TEXT,
            san TEXT,
            move_json TEXT,
            fen_after TEXT,
            timestamp REAL,
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            sender TEXT,
            message TEXT,
            timestamp REAL,
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# In-memory rooms repository
# { roomId: { 'hostToken': ..., 'guestToken': ..., 'events': [...], ... } }
ROOMS_LOCK = threading.Lock()
ROOMS = {}

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def get_local_ip():
    """Detect LAN IP address for local network multiplayer sharing."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not send actual packets
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def generate_room_code():
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choice(chars) for _ in range(6))

def cleanup_old_rooms():
    """Periodically remove rooms inactive for more than 24 hours."""
    now = time.time()
    with ROOMS_LOCK:
        expired = [rid for rid, r in ROOMS.items() if now - r.get('last_activity', now) > 86400]
        for rid in expired:
            del ROOMS[rid]

class ChessRequestHandler(BaseHTTPRequestHandler):
    server_version = "ChessServer/1.0"

    def log_message(self, format, *args):
        # Clean logging: keep stdout readable
        pass

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def parse_body_json(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length <= 0:
                return {}
            raw = self.rfile.read(content_length).decode('utf-8')
            return json.loads(raw)
        except Exception:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/api/rooms/stream':
            self.handle_sse_stream(query)
            return

        if path == '/api/rooms/poll':
            self.handle_poll(query)
            return

        # Serve static files
        self.serve_static_file(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_body_json()

        if path == '/api/rooms/create':
            self.handle_create_room(body)
        elif path == '/api/rooms/join':
            self.handle_join_room(body)
        elif path == '/api/rooms/move':
            self.handle_make_move(body)
        elif path == '/api/rooms/chat':
            self.handle_send_chat(body)
        elif path == '/api/rooms/action':
            self.handle_game_action(body)
        else:
            self.send_json({'error': 'Not found'}, 404)

    def handle_create_room(self, body):
        time_control = body.get('timeControl', '10')
        preferred_color = body.get('preferredColor', 'random')

        if preferred_color == 'white':
            host_color = 'w'
            guest_color = 'b'
        elif preferred_color == 'black':
            host_color = 'b'
            guest_color = 'w'
        else:
            host_color = random.choice(['w', 'b'])
            guest_color = 'b' if host_color == 'w' else 'w'

        with ROOMS_LOCK:
            room_id = generate_room_code()
            while room_id in ROOMS:
                room_id = generate_room_code()

            host_token = str(uuid.uuid4())
            guest_token = None

            room = {
                'id': room_id,
                'created': time.time(),
                'last_activity': time.time(),
                'time_control': time_control,
                'host_token': host_token,
                'host_color': host_color,
                'guest_token': guest_token,
                'guest_color': guest_color,
                'status': 'waiting',
                'fen': 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                'history': [],
                'events': [],
                'subscribers': [] # list of (condition, event_queue)
            }
            ROOMS[room_id] = room

            # Save room to SQLite database
            try:
                conn = sqlite3.connect(DB_FILE)
                conn.execute(
                    'INSERT OR REPLACE INTO rooms (id, created, last_activity, time_control, host_token, host_color, guest_token, guest_color, status, fen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    (room_id, room['created'], room['last_activity'], time_control, host_token, host_color, '', guest_color, 'waiting', room['fen'])
                )
                conn.commit()
                conn.close()
            except Exception as e:
                pass

        self.send_json({
            'success': True,
            'roomId': room_id,
            'token': host_token,
            'color': host_color,
            'timeControl': time_control
        })

    def handle_join_room(self, body):
        room_id = body.get('roomId', '').upper().strip()

        with ROOMS_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                self.send_json({'success': False, 'error': 'Room not found'}, 404)
                return

            room['last_activity'] = time.time()

            # Check if guest already joined or this is a new guest
            if not room['guest_token']:
                guest_token = str(uuid.uuid4())
                room['guest_token'] = guest_token
                room['status'] = 'playing'
                guest_color = room['guest_color']

                # Broadcast opponent joined event to host
                self.broadcast_room_event(room, 'opponent_joined', {
                    'guestColor': guest_color,
                    'timeControl': room['time_control']
                })
            else:
                guest_token = room['guest_token']
                guest_color = room['guest_color']

        self.send_json({
            'success': True,
            'roomId': room_id,
            'token': guest_token,
            'color': guest_color,
            'gameReady': True,
            'timeControl': room['time_control'],
            'fen': room['fen'],
            'history': room['history']
        })

    def broadcast_room_event(self, room, event_type, data):
        seq = len(room['events']) + 1
        event = {
            'seq': seq,
            'type': event_type,
            'data': data,
            'time': time.time()
        }
        room['events'].append(event)
        room['last_activity'] = time.time()

        # Notify waiting SSE threads
        for cond, queue in room['subscribers']:
            with cond:
                queue.append(event)
                cond.notify_all()

    def handle_make_move(self, body):
        room_id = body.get('roomId', '').upper().strip()
        token = body.get('token')
        move = body.get('move')
        fen = body.get('fen')
        san = body.get('san')

        with ROOMS_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                self.send_json({'success': False, 'error': 'Room not found'}, 404)
                return

            if token not in (room['host_token'], room['guest_token']):
                self.send_json({'success': False, 'error': 'Unauthorized token'}, 403)
                return

            sender_color = room['host_color'] if token == room['host_token'] else room['guest_color']

            room['fen'] = fen
            room['history'].append({'move': move, 'san': san, 'color': sender_color})

            # Save move to SQLite database
            try:
                conn = sqlite3.connect(DB_FILE)
                conn.execute(
                    'INSERT INTO moves (room_id, move_num, color, san, move_json, fen_after, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    (room_id, len(room['history']), sender_color, san, json.dumps(move), fen, time.time())
                )
                conn.execute(
                    'UPDATE rooms SET fen = ?, last_activity = ? WHERE id = ?',
                    (fen, time.time(), room_id)
                )
                conn.commit()
                conn.close()
            except Exception as e:
                pass

            self.broadcast_room_event(room, 'move_made', {
                'move': move,
                'fen': fen,
                'san': san,
                'color': sender_color
            })

        self.send_json({'success': True})

    def handle_send_chat(self, body):
        room_id = body.get('roomId', '').upper().strip()
        token = body.get('token')
        message = (body.get('message') or '').strip()[:200]

        if not message:
            self.send_json({'success': False, 'error': 'Empty message'}, 400)
            return

        with ROOMS_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                self.send_json({'success': False, 'error': 'Room not found'}, 404)
                return

            if token not in (room['host_token'], room['guest_token']):
                self.send_json({'success': False, 'error': 'Unauthorized'}, 403)
                return

            sender_color = room['host_color'] if token == room['host_token'] else room['guest_color']

            self.broadcast_room_event(room, 'chat_message', {
                'sender': sender_color,
                'message': message,
                'timestamp': time.time()
            })

        self.send_json({'success': True})

    def handle_game_action(self, body):
        room_id = body.get('roomId', '').upper().strip()
        token = body.get('token')
        action = body.get('action') # 'resign', 'draw_offer', 'draw_accept', 'rematch'
        payload = body.get('payload', {})

        with ROOMS_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                self.send_json({'success': False, 'error': 'Room not found'}, 404)
                return

            if token not in (room['host_token'], room['guest_token']):
                self.send_json({'success': False, 'error': 'Unauthorized'}, 403)
                return

            sender_color = room['host_color'] if token == room['host_token'] else room['guest_color']

            if action == 'rematch_accept':
                # Reset board for rematch
                room['fen'] = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
                room['history'] = []

            self.broadcast_room_event(room, 'game_action', {
                'action': action,
                'sender': sender_color,
                'payload': payload
            })

        self.send_json({'success': True})

    def handle_poll(self, query):
        room_id = (query.get('roomId', [''])[0]).upper().strip()
        since = int(query.get('since', ['0'])[0])

        with ROOMS_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                self.send_json({'success': False, 'events': []})
                return

            new_events = [e for e in room['events'] if e['seq'] > since]

        self.send_json({'success': True, 'events': new_events})

    def handle_sse_stream(self, query):
        room_id = (query.get('roomId', [''])[0]).upper().strip()
        token = query.get('token', [''])[0]

        with ROOMS_LOCK:
            room = ROOMS.get(room_id)
            if not room or token not in (room['host_token'], room['guest_token']):
                self.send_response(404)
                self.end_headers()
                return

            cond = threading.Condition()
            queue = []
            sub = (cond, queue)
            room['subscribers'].append(sub)

        # Headers for Server-Sent Events
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.send_cors_headers()
        self.end_headers()

        # Send initial connected ping
        try:
            init_msg = f"data: {json.dumps({'type': 'connected', 'roomId': room_id})}\n\n"
            self.wfile.write(init_msg.encode('utf-8'))
            self.wfile.flush()

            while True:
                with cond:
                    while not queue:
                        # Wait for new events or timeout after 15s to send keep-alive comment
                        notified = cond.wait(timeout=15.0)
                        if not notified:
                            # Send SSE keep-alive ping
                            try:
                                self.wfile.write(b": keepalive\n\n")
                                self.wfile.flush()
                            except Exception:
                                return
                    events_to_send = list(queue)
                    queue.clear()

                for ev in events_to_send:
                    payload = f"data: {json.dumps(ev)}\n\n"
                    self.wfile.write(payload.encode('utf-8'))
                    self.wfile.flush()

        except (BrokenPipeError, ConnectionResetError, Exception):
            pass
        finally:
            with ROOMS_LOCK:
                if room_id in ROOMS and sub in ROOMS[room_id]['subscribers']:
                    ROOMS[room_id]['subscribers'].remove(sub)

    def serve_static_file(self, path):
        if path == '/' or not path:
            path = '/index.html'

        clean_path = os.path.normpath(path.lstrip('/'))
        full_path = os.path.join(ROOT_DIR, clean_path)
        if not os.path.exists(full_path) or os.path.isdir(full_path):
            full_path = os.path.join(STATIC_DIR, clean_path)
        if not os.path.exists(full_path) or os.path.isdir(full_path):
            full_path = os.path.join(ROOT_DIR, 'index.html')

        # Security check: ensure path stays inside project directory
        if not full_path.startswith(ROOT_DIR):
            self.send_response(403)
            self.end_headers()
            return

        mime_type, _ = mimetypes.guess_type(full_path)
        if not mime_type:
            if full_path.endswith('.js'):
                mime_type = 'application/javascript'
            elif full_path.endswith('.css'):
                mime_type = 'text/css'
            elif full_path.endswith('.svg'):
                mime_type = 'image/svg+xml'
            else:
                mime_type = 'text/html'

        try:
            with open(full_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', mime_type + '; charset=utf-8' if 'text' in mime_type or 'javascript' in mime_type else mime_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-cache')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()

def run_server():
    local_ip = get_local_ip()
    server = ThreadedHTTPServer(('0.0.0.0', PORT), ChessRequestHandler)

    border = "=" * 64
    print(border)
    print("♟️   CHESS - (PROJECT BY NETRAA) - SERVER STARTED")
    print(border)
    print(f"  • Local Browser:   http://localhost:{PORT}")
    print(f"  • Network Share:   http://{local_ip}:{PORT}")
    print("----------------------------------------------------------------")
    print("  Game Modes:")
    print("    [1] 2 Players (Pass & Play on Same Device)")
    print("    [2] vs Robot (3 AI Difficulties: Beginner, Club, Master)")
    print("    [3] Play Online via Shareable Link / QR Code")
    print("----------------------------------------------------------------")
    print(f"  Share http://{local_ip}:{PORT}/?room=... with friends to play!")
    print(border)
    print("Press Ctrl+C to stop the server.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Chess server...")
        server.shutdown()
        server.server_close()
        print("Server stopped cleanly.")

if __name__ == '__main__':
    run_server()

