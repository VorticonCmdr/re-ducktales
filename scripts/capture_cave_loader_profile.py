"""Conditional clock bracket around one natural sprite10 load; no guest writes."""
import base64
import struct
import subprocess


def capture_cave_loader_profile(*, client, stop, load, ds, overlay, add, remove,
                                resume, state, sequence, save, root, resource=10):
    assert resource in [0, 10]
    before_ip, after_ip = (0x595, 0x59a) if resource == 0 else (0xfc5, 0xfca)
    caller_at, caller_size = (0x580, 64) if resource == 0 else (0xf51, 302)
    before_bp, after_bp = add(before_ip), add(after_ip)
    events = [{'type': 'key', 'key': key, 'pressed': pressed, 'frame': frame}
              for frame, pressed in [(0, True), (10, False)] for key in ['KBD_right', 'KBD_space']]
    if resource == 0: events = []
    save('cave-loader-inputs', {'events': events, 'scheduled': sequence(events) if events else None})
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == before_bp
    before = state('cave-loader-before', stop)
    sp = stop['registers']['esp'] & 65535
    destination = struct.unpack_from('<H', before, 0x203a)[0] if resource == 0 else 0x54fc
    assert struct.unpack_from('<HH', before, sp) == (resource, destination)
    assert struct.unpack_from('<HH', before, 0x4d32)[0] == (45 if resource == 0 else 46)
    assert struct.unpack_from('<H', before, 0x8eb2)[0] == 1 and before[0x8b54] == 1
    remove(before_bp)
    code = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': overlay, 'offset': caller_at, 'len': caller_size},
        {'op': 'mem_read', 'segment': load+0x40e, 'offset': 0x175c, 'len': 585}]})
    save('cave-loader-code', {'load': load, 'segment': overlay, 'resident': load+0x40e, 'callerOffset': caller_at, 'callerSize': caller_size, 'read': code})
    assert not code['aborted'] and all(r['status'] == 'ok' for r in code['results'])
    from capture_safari_cadence import relocated_overlay
    exe = (root/'game/DUCKTALE.EXE').read_bytes()
    expected = relocated_overlay(exe, 0x1a800, load, 6, 11054, 196)
    assert base64.b64decode(code['results'][0]['data']) == expected[caller_at:caller_at+caller_size]
    image = bytearray(base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{readFile}from'node:fs/promises';import{unpackImage}from'./src/game/executable.js';process.stdout.write(Buffer.from(unpackImage(await readFile('game/DUCKTALE.EXE'))).toString('base64'));"], cwd=root)))
    cursor = struct.unpack_from('<H', exe, 8)[0]*16+struct.unpack_from('<H', exe, 22)[0]*16+0x125
    for region in range(16):
        count = struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
        for _ in range(count):
            pos = region*65536+struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
            struct.pack_into('<H', image, pos, (struct.unpack_from('<H', image, pos)[0]+load)&65535)
    resident_start = 0x40e*16+0x175c
    assert base64.b64decode(code['results'][1]['data']) == image[resident_start:resident_start+585]
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == after_bp
    after = state('cave-loader-after', stop)
    assert stop['registers']['eax'] & 65535 == destination
    remove(after_bp)
    clock = lambda b: struct.unpack_from('<I', b, 0x2225)[0]
    start, finish = clock(before), clock(after)
    assert finish >= start
    descriptor = list(struct.unpack_from('<6H' if resource == 0 else '<10H', after, destination))
    if resource == 0:
        plane, factor, offset, segment = descriptor[4], 4, descriptor[2], descriptor[3]
        assert descriptor[:2] == [40, 200] and plane == 8000
    else:
        plane, factor, offset, segment = descriptor[8], 5 if after[0x2043] else 4, descriptor[6], descriptor[7]
        assert descriptor[2:6] == [17, 112, 68, 112] and plane == 7616 and factor == 5
    assert offset+plane*factor <= 65536
    payload = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': segment, 'offset': offset, 'len': plane*factor}]})
    assert not payload['aborted'] and payload['results'][0]['status'] == 'ok'
    save('cave-loader-payload', {'descriptor': descriptor, 'planes': factor, 'read': payload})
    replay = client.get('/api/v1/input/replay/status')
    save('cave-loader-replay', replay)
    assert not replay['active'] and replay['remaining'] == 0 and replay['dispatched'] == 4
    save('cave-loader-profile', {'completed': True, 'resource': resource, 'destination': destination,
         'beforeClock': start, 'afterClock': finish, 'driverCounts': finish-start,
         'beforeIP': before_ip, 'afterIP': after_ip, 'injections': [], 'partialRestore': False,
         'scope': 'One original natural graphics resource load bounded by debugger stops;counter delta brackets conditional work,not uninterrupted timing. Complete caller/load bytes and descriptor/payload retained. No port clock input is derived from the result.'})
