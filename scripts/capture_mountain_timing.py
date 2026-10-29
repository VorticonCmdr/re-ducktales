"""One bounded, original-only mountain cadence experiment.

Called only by capture-security.py's single owned emulator session. Setup follows
the original map controls to select El Capitan at36,61; no guest writes or
restores. Breakpoint ignore_count is engine-side, but does internally stop/resume:
this is explicitly a counted-boundary benchmark, not uninterrupted scanout.
"""
import base64
import struct
import time


def capture_mountain_timing(*, client, stop, load, ds, overlay, add, remove,
                            resume, state, keys, sequence, wait_until, save, root):
    initial_stop = stop['stop_id']
    map_cs = overlay + 0xca
    marker = add(0x1228, map_cs)
    stop = resume(initial_stop)
    assert stop['breakpoint']['id'] == marker
    data = state('timing-map-entry', stop)
    sp = stop['registers']['esp'] & 65535
    x_ptr, y_ptr = struct.unpack_from('<HH', data, sp + 4)
    assert struct.unpack_from('<hh', data, x_ptr)[0] == 46
    assert struct.unpack_from('<h', data, y_ptr)[0] == 139
    remove(marker)
    # The map caller uses its +0ca paragraph alias throughout the destination.
    entry = add(0x1757 - 0xca0, map_cs)
    end = add(0x140e, map_cs)
    stop = resume(stop['stop_id'])
    reset = False
    reached = False
    # Feedback is setup only. Alternate one-pixel makes with neutral polls to
    # reset original acceleration; never write the cursor or target slot.
    for index in range(200):
        assert stop['breakpoint']['id'] == end
        data = state(f'timing-map-step-{index:03d}', stop, False)
        x, y = struct.unpack_from('<h', data, x_ptr)[0], struct.unpack_from('<h', data, y_ptr)[0]
        if (x, y) == (36, 61):
            reached = True
            break
        if reset:
            reset = False
        else:
            key = ('KBD_right' if x < 36 else 'KBD_left') if x != 36 else ('KBD_down' if y < 61 else 'KBD_up')
            keys((key, True), (key, False))
            reset = True
        stop = resume(stop['stop_id'])
    assert reached, 'Unfinished natural El Capitan map selection'
    remove(end)
    keys(('KBD_space', True))
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == entry
    data = state('timing-destination-entry', stop)
    remove(entry)
    keys(('KBD_space', False))
    flush, read = add(0x1e33 - 0xca0, map_cs), add(0x1e8e - 0xca0, map_cs)
    destination = []
    for name, key, expected in [('travel', 'KBD_right', 3),
                                 ('confirm', 'KBD_space', 192)]:
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == flush
        state('timing-destination-' + name + '-flush', stop, False)
        keys((key, True), (key, False))
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == read
        assert stop['registers']['eax'] & 255 == expected
        state('timing-destination-' + name + '-read', stop)
        destination.append({'case': name, 'byte': expected})
    remove(flush)
    remove(read)
    marker = add(0x1ec7 - 0xca0, map_cs)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker
    assert stop['registers']['eax'] & 65535 == 1
    state('timing-destination-return', stop)
    remove(marker)
    flight = add(0x2ae, condition={'segment': overlay, 'offset': 0x2b1,
                 'width': 2, 'op': 'eq', 'value': load + 0x124})
    keys(('KBD_space', True))
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == flight
    flight_data = state('timing-flight-first-input', stop)
    bp = stop['registers']['ebp'] & 65535
    duration, racing = struct.unpack_from('<HH', flight_data, bp + 6)
    assert duration in [1, 2, 3] and racing in [0, 1]
    save('timing-flight-contract', {'duration': duration, 'racing': racing,
         'scope': 'Original caller arguments;crash setup requires a naturally nonracing flight. No flag is overwritten.'})
    assert racing == 0, 'SETUP: racing flight cannot use the crash-to-mountain recipe'
    remove(flight)
    keys(('KBD_space', False))
    # The established original flight-input setup, with a fresh make after the
    # release. These frame numbers are setup inputs, never benchmark timestamps.
    sequence([{'type': 'key', 'key': 'KBD_space', 'pressed': True, 'frame': 3},
              {'type': 'key', 'key': 'KBD_down', 'pressed': True, 'frame': 80},
              {'type': 'key', 'key': 'KBD_down', 'pressed': False, 'frame': 100},
              {'type': 'key', 'key': 'KBD_space', 'pressed': False, 'frame': 160}])
    mountain = add(0)
    stop = resume(stop['stop_id'], wait_seconds=60)
    assert stop['breakpoint']['id'] == mountain
    data = state('timing-mountain-entry', stop)
    # Always validate the actual overlay, not its reused address or a loader.
    exe = (root / 'game/DUCKTALE.EXE').read_bytes()
    at = 0x17600
    h = struct.unpack_from('<14H', exe, at)
    assert h[0] == 0x5a4d and h[3] == 68 and h[13] == 5
    size = (h[2] - 1) * 512 + (h[1] or 512)
    expected = bytearray(exe[at + h[4] * 16:at + size])
    assert len(expected) == 12002
    for i in range(h[3]):
        offset, segment = struct.unpack_from('<HH', exe, at + h[12] + i * 4)
        offset += segment * 16 - 0xc170
        struct.pack_into('<H', expected, offset,
                         (struct.unpack_from('<H', expected, offset)[0] + load) & 65535)
    body = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': overlay, 'offset': 0, 'len': 12002}]})
    assert not body['aborted'] and body['results'][0]['status'] == 'ok'
    assert base64.b64decode(body['results'][0]['data']) == expected
    save('timing-mountain-code', {'load': load, 'ds': ds, 'segment': overlay,
                                'stop': stop, 'read': body})
    remove(mountain)
    replay = client.get('/api/v1/input/replay/status')
    assert not replay['active'] and replay['remaining'] == 0, 'Unfinished flight setup'
    marker = add(0x31c)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker
    assert stop['registers']['eax'] & 255 == 0, 'Nonneutral first mountain input'
    before = state('timing-mountain-first-read', stop)
    remove(marker)
    keys(('KBD_right', True))
    # Replacing a breakpoint at the currently paused IP can re-hit that same
    # instruction. Cross the known post-update boundary before arming a counted
    # reader breakpoint; otherwise hit_count would include a duplicate read.
    barrier = add(0x145d)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == barrier
    state('timing-mountain-first-body-end', stop, False)
    remove(barrier)
    # Fourteen subsequent read boundaries; no model-driven polling or inputs
    # occur between them. Skipped hits still count and are retained in the stop.
    marker = add(0x31c, ignore_count=13)
    started = time.monotonic()
    stop = resume(stop['stop_id'])
    host_ms = (time.monotonic() - started) * 1000
    assert stop['breakpoint']['id'] == marker
    assert stop['breakpoint']['hit_count'] == 14
    assert stop['registers']['eax'] & 255 == 3
    after = state('timing-mountain-last-read', stop)
    remove(marker)
    assert before[0x4d34] == after[0x4d34] == 3, 'Life reset invalidates this segment'
    assert before[0x5b3c] == after[0x5b3c], 'Destination changed'
    keys(('KBD_right', False))
    barrier = add(0x145d)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == barrier
    state('timing-mountain-last-body-end', stop, False)
    remove(barrier)
    marker = add(0x31c)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker
    # Mode0 consumes a break-marked direction once before removing its slot.
    # readOrdinaryKeys has the same delete-then-use order. Do not flush away
    # this real original input just to manufacture an immediate neutral read.
    edge = state('timing-mountain-release-edge-read', stop)
    assert stop['registers']['eax'] & 255 == 3
    assert edge[0x27b9] == 0
    remove(marker)
    barrier = add(0x145d)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == barrier
    state('timing-mountain-release-body-end', stop, False)
    remove(barrier)
    marker = add(0x31c)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker
    state('timing-mountain-release-read', stop)
    assert stop['registers']['eax'] & 255 == 0
    remove(marker)
    replay = client.get('/api/v1/input/replay/status')
    assert not replay['active'] and replay['remaining'] == 0
    begin = struct.unpack_from('<I', before, 0x2225)[0]
    end = struct.unpack_from('<I', after, 0x2225)[0]
    assert end > begin
    save('mountain-timing', {'completed': True, 'measuredIntervals': 14,
         'observedInputBoundaries': 4, 'engineCountedReads': 15,
         'cleanupInputReads': 2,
         'firstByte': 0, 'lastByte': 3, 'releaseBytes': [3, 0],
         'counterBefore': begin, 'counterAfter': end,
         'counterDifference': end - begin, 'hostMilliseconds': host_ms,
         'firstX': struct.unpack_from('<h', before, 0x5ae0)[0],
         'lastX': struct.unpack_from('<h', after, 0x5ae0)[0],
         'firstLives': before[0x4d34], 'lastLives': after[0x4d34],
         'destinationChoices': destination, 'replay': replay,
         'injections': [], 'partialRestore': False,
         'scope': 'Fresh original counted mountain cadence with held Right;ignore_count internally stops/resumes and intermediate returned bytes are not captured. Not uninterrupted scanout or whole-level timing parity.'})
