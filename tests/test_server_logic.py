#!/usr/bin/env python3
import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server

def test_room_lifecycle():
    print("Testing server room management & events directly...")

    # 1. Simulate create room
    with server.ROOMS_LOCK:
        room_id = server.generate_room_code()
        host_token = "test-host-token-123"
        room = {
            'id': room_id,
            'created': time.time(),
            'last_activity': time.time(),
            'time_control': '10',
            'host_token': host_token,
            'host_color': 'w',
            'guest_token': None,
            'guest_color': 'b',
            'status': 'waiting',
            'fen': 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'history': [],
            'events': [],
            'subscribers': []
        }
        server.ROOMS[room_id] = room

    assert room_id in server.ROOMS, "Room was created"
    print(f"Room {room_id} registered successfully.")

    # 2. Simulate guest joining
    with server.ROOMS_LOCK:
        r = server.ROOMS[room_id]
        guest_token = "test-guest-token-456"
        r['guest_token'] = guest_token
        r['status'] = 'playing'
        server.ChessRequestHandler.broadcast_room_event(None, r, 'opponent_joined', {
            'guestColor': 'b',
            'timeControl': r['time_control']
        })

    assert len(r['events']) == 1, "Opponent joined event created"
    assert r['events'][0]['type'] == 'opponent_joined'
    print("Guest join event verified.")

    # 3. Simulate move broadcast
    with server.ROOMS_LOCK:
        r = server.ROOMS[room_id]
        r['fen'] = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
        r['history'].append({'move': {'from': {'r': 6, 'c': 4}, 'to': {'r': 4, 'c': 4}}, 'san': 'e4', 'color': 'w'})
        server.ChessRequestHandler.broadcast_room_event(None, r, 'move_made', {
            'move': {'from': {'r': 6, 'c': 4}, 'to': {'r': 4, 'c': 4}},
            'fen': r['fen'],
            'san': 'e4',
            'color': 'w'
        })

    assert len(r['events']) == 2
    assert r['events'][1]['type'] == 'move_made'
    assert r['events'][1]['data']['san'] == 'e4'
    print("Move broadcast verified.")

    # 4. Simulate polling logic
    new_events = [e for e in r['events'] if e['seq'] > 0]
    assert len(new_events) == 2
    new_events_after_1 = [e for e in r['events'] if e['seq'] > 1]
    assert len(new_events_after_1) == 1
    assert new_events_after_1[0]['data']['san'] == 'e4'
    print("Sequence-based polling verified.")

    # 5. Simulate in-game chat broadcast
    with server.ROOMS_LOCK:
        server.ChessRequestHandler.broadcast_room_event(None, r, 'chat_message', {
            'sender': 'b',
            'message': 'Nice move! 🔥',
            'timestamp': time.time()
        })
    assert len(r['events']) == 3
    assert r['events'][2]['type'] == 'chat_message'
    assert r['events'][2]['data']['message'] == 'Nice move! 🔥'
    print("Chat message broadcast verified.")

    print("\nAll direct server unit tests PASSED successfully! 🎉")

if __name__ == '__main__':
    test_room_lifecycle()

