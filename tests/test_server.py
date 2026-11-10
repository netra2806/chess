#!/usr/bin/env python3
import sys
import os
import time
import json
import urllib.request
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server

def run_tests():
    print("Testing server endpoints...")
    # Start server on port 8001 for test
    test_port = 8001
    server.PORT = test_port
    httpd = server.ThreadedHTTPServer(('127.0.0.1', test_port), server.ChessRequestHandler)
    t = threading.Thread(target=httpd.serve_forever)
    t.daemon = True
    t.start()
    time.sleep(0.3)

    base = f"http://127.0.0.1:{test_port}"

    # 1. Test Create Room
    req = urllib.request.Request(
        f"{base}/api/rooms/create",
        data=json.dumps({"timeControl": "5", "preferredColor": "white"}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        res = json.loads(resp.read().decode('utf-8'))
        assert res.get('success') is True
        room_id = res.get('roomId')
        host_token = res.get('token')
        assert res.get('color') == 'w'
        print(f"Test 1: Room created successfully! RoomId: {room_id}")

    # 2. Test Join Room
    req_join = urllib.request.Request(
        f"{base}/api/rooms/join",
        data=json.dumps({"roomId": room_id}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_join) as resp_join:
        assert resp_join.status == 200
        res_join = json.loads(resp_join.read().decode('utf-8'))
        assert res_join.get('success') is True
        assert res_join.get('color') == 'b'
        guest_token = res_join.get('token')
        print("Test 2: Second player joined room successfully as Black!")

    # 3. Test Make Move
    req_move = urllib.request.Request(
        f"{base}/api/rooms/move",
        data=json.dumps({
            "roomId": room_id,
            "token": host_token,
            "move": {"from": {"r": 6, "c": 4}, "to": {"r": 4, "c": 4}},
            "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "san": "e4"
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_move) as resp_move:
        assert resp_move.status == 200
        res_move = json.loads(resp_move.read().decode('utf-8'))
        assert res_move.get('success') is True
        print("Test 3: White move 'e4' submitted and broadcasted!")

    # 4. Test Poll Events
    with urllib.request.urlopen(f"{base}/api/rooms/poll?roomId={room_id}&since=0") as resp_poll:
        assert resp_poll.status == 200
        res_poll = json.loads(resp_poll.read().decode('utf-8'))
        events = res_poll.get('events', [])
        assert len(events) >= 2 # opponent_joined + move_made
        types = [e['type'] for e in events]
        assert 'opponent_joined' in types
        assert 'move_made' in types
        print(f"Test 4: Polling returned synchronized events: {types}!")

    # 5. Test Chat Message
    req_chat = urllib.request.Request(
        f"{base}/api/rooms/chat",
        data=json.dumps({
            "roomId": room_id,
            "token": guest_token,
            "message": "Good luck!"
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req_chat) as resp_chat:
        assert resp_chat.status == 200
        res_chat = json.loads(resp_chat.read().decode('utf-8'))
        assert res_chat.get('success') is True
        print("Test 5: In-game chat message sent successfully!")

    httpd.shutdown()
    httpd.server_close()
    print("\nALL SERVER TESTS PASSED SUCCESSFULLY! 🚀")

if __name__ == '__main__':
    run_tests()
