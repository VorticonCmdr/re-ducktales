"""Natural original treasure route;debugger-bounded component evidence only."""
from collections import deque
import struct


def route(data):
    word = lambda at: struct.unpack_from('<H', data, at)[0]
    room, goal, enemy = (word(a) for a in [0x4d32, 0x97b0, 0x6810])
    cells = struct.unpack_from('<64H', data, 0x5a42)
    for margin in [1, 0, -1]:
        danger = {enemy, enemy-8, enemy+8, enemy-1, enemy+1} if margin == 1 else {enemy} if margin == 0 else set()
        queue, seen = deque([(room, [])]), {room}
        while queue:
            at, path = queue.popleft()
            if at == goal:
                assert path, 'Already at treasure before source treasure call'
                return room, goal, path
            for key, bit, delta in [('KBD_up', 8, -8), ('KBD_right', 2, 1),
                                    ('KBD_down', 4, 8), ('KBD_left', 1, -1)]:
                nxt = at+delta
                if (cells[at] & bit and 0 <= nxt < 64 and not cells[nxt] & 64
                        and nxt not in seen and (nxt == goal or nxt not in danger)):
                    seen.add(nxt)
                    queue.append((nxt, path+[(key, nxt)]))
    raise AssertionError('No source-map path to treasure')


def capture_cave_treasure(*, client, stop, load, ds, overlay, add, remove,
                          resume, state, sequence, save, root):
    reader, treasure = add(0x9a6), add(0x16b4)
    reads, schedules = [], []
    pending = None
    for index in range(80):
        data = state('treasure-route-read-'+str(index), stop, picture=False)
        code = stop['registers']['eax'] & 255
        room = struct.unpack_from('<H', data, 0x4d32)[0]
        reads.append({'index': index, 'code': code, 'room': room,
                      'stopId': stop['stop_id']})
        if pending is not None:
            if room == pending['target']:
                completed = client.get('/api/v1/input/replay/status')
                assert not completed['active'] and completed['remaining'] == 0 and completed['dispatched'] == 4
                pending['completed'] = completed
                pending = None
            else:
                assert room == pending['from'], 'Unexpected original room transition'
        if pending is None:
            assert code == 0, 'Unexpected held input after room flush'
            room, goal, path = route(data)
            key, target = path[0]
            events = [{'type': 'key', 'key': k, 'pressed': pressed, 'frame': frame}
                      for frame, pressed in [(0, True), (10, False)] for k in [key, 'KBD_space']]
            pending = {'from': room, 'target': target, 'goal': goal, 'key': key,
                       'afterRead': index, 'events': events, 'scheduled': sequence(events)}
            schedules.append(pending)
            print('Native cave treasure move',len(schedules),room,'->',target,flush=True)
        stop = resume(stop['stop_id'], wait_seconds=20)
        if stop['breakpoint']['id'] == treasure:
            before = state('treasure-entry', stop)
            assert struct.unpack_from('<H', before, 0x4d32)[0] == struct.unpack_from('<H', before, 0x97b0)[0]
            assert pending is not None and pending['target'] == pending['goal']
            completed = client.get('/api/v1/input/replay/status')
            assert not completed['active'] and completed['remaining'] == 0 and completed['dispatched'] == 4
            pending['completed'] = completed
            break
        assert stop['breakpoint']['id'] == reader
    else:
        raise AssertionError('Unfinished bounded original treasure route')
    remove(reader); remove(treasure)
    # Observe fixed source boundaries without pretending cached screen refresh
    # occurs at the same instruction. Raw PNGs are exploratory until aligned.
    checkpoints = []
    for label, ip in [('before-wipe', 0x16fb), ('after-background', 0x170b),
                      ('before-first-reveal', 0x173d), ('before-second-flip', 0x1770),
                      ('celebration-loop', 0x17de), ('treasure-end', 0x1827)]:
        bp = add(ip)
        stop = resume(stop['stop_id'], wait_seconds=20)
        assert stop['breakpoint']['id'] == bp
        data = state('treasure-'+label, stop)
        checkpoints.append({'label': label, 'ip': ip, 'stopId': stop['stop_id'],
                            'seed': struct.unpack_from('<H', data, 0x2229)[0],
                            'flag': data[0x546a]})
        remove(bp)
    save('treasure-route', {'completed': True, 'reads': reads, 'schedules': schedules,
         'checkpoints': checkpoints, 'injections': [], 'partialRestore': False,
         'scope': 'Natural source-map feedback route using physical make/release schedules;debugger stops at reader/treasure boundaries. Conditional component evidence;not uninterrupted timing. Raw PNG capture alignment unverified.'})
