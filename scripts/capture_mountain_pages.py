"""Non-stopping original page observations, owned by capture-security.py.

Fixed input/event and sample schedules. No instruction hooks, guest writes,
state restore or per-frame execution stops. Render-frame samples bracket page
changes; they are not exact instruction-boundary timestamps or CPU checkpoints.
"""
import base64
import hashlib
import struct
import subprocess


def capture_mountain_pages(*, client, stop, before, ds, sequence, state,
                           wait_until, save, root):
    flip, ega = struct.unpack_from('<HH', before, 0x1fd4)
    sprite, sprite_segment = struct.unpack_from('<HH', before, 0x1ff0)
    assert flip == 0xe5 and sprite == 0x35d and sprite_segment == ega
    driver_read = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': ega, 'offset': 0, 'len': 2599}]})
    assert not driver_read['aborted'] and driver_read['results'][0]['status'] == 'ok'
    driver = base64.b64decode(driver_read['results'][0]['data'])
    decode = "import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'))[1].data).toString('base64'));"
    original = base64.b64decode(subprocess.check_output(
        ['node', '--input-type=module', '-e', decode], cwd=root))
    assert len(original) == 2599
    assert driver[0xe5:0x101] == original[0xe5:0x101]
    assert driver[0x35d:0x515] == original[0x35d:0x515]
    save('page-driver-mapping', {'segment': ega, 'flip': flip, 'sprite': sprite,
         'read': driver_read, 'originalSha256': hashlib.sha256(original).hexdigest()})
    breakpoints = client.get('/api/v1/debug/breakpoints')
    save('page-breakpoints-before', breakpoints)
    # A fresh owned session has no third-party breakpoints. Refuse to measure
    # if any remained from setup; never clear another owner's debugger state.
    assert breakpoints['breakpoints'] == []
    authored = (root / 'scripts/mountain-page-observer.lua').read_text()
    script = authored.replace('__DS__', str(ds)).replace('__EGA__', str(ega))
    save('page-observer-script', {'source': script,
         'templateSha256': hashlib.sha256(authored.encode()).hexdigest(),
         'ds': ds, 'ega': ega})
    # Same raw-text load and separate start as the installed script_load tool.
    loaded = client.post_text('/api/v1/script/load', script,
                              params={'name': 'mountain-page-observer'})
    started = client.post('/api/v1/script/start')
    save('page-observer-loaded', {'load': loaded, 'start': started})
    # Fixed relative rendered-frame schedule: independent of actor/page outputs.
    events = [
        {'type': 'key', 'key': 'KBD_right', 'pressed': True, 'frame': 0},
        {'type': 'key', 'key': 'KBD_right', 'pressed': False, 'frame': 40}]
    scheduled = sequence(events)
    save('page-observer-inputs', {'events': events, 'scheduled': scheduled})
    continued = client.post('/api/v1/debug/continue')
    assert continued['resumed_from_stop_id'] == stop['stop_id']
    status = wait_until(lambda: client.get('/api/v1/script/status'),
                        lambda value: value['state'] in ['completed', 'error'], timeout=20)
    save('page-observer-result', status)
    assert status['state'] == 'completed' and not status['output_truncated']
    assert status['output']['completed'] is True
    samples = status['output']['samples']
    assert len(samples) == 80
    replay = client.get('/api/v1/input/replay/status')
    assert not replay['active'] and replay['remaining'] == 0 and replay['dispatched'] == 2
    final_stop = client.post('/api/v1/debug/pause')['stop']
    assert final_stop['stop_id'] == stop['stop_id'] + 1, 'Unexpected execution stop during observation'
    after = state('page-observer-final', final_stop)
    assert after[0x27b9] == 0 and after[0x4d34] == 3
    save('mountain-page-observation', {'completed': True, 'expectedSamples': 80,
         'initialStopId': stop['stop_id'], 'finalStopId': final_stop['stop_id'],
         'replay': replay, 'injections': [], 'partialRestore': False,
         'scope': 'Fixed render-frame samples bracket original page changes without intermediate debugger stops. Not exact flip timestamps,CPU checkpoints or full-level parity.'})
