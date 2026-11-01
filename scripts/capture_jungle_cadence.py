"""Natural swamp entry; fixed Right/release schedule; read-only observation."""
import base64
import hashlib
import json
import struct
import subprocess
from capture_safari_cadence import relocated_overlay


def capture_jungle_cadence(*, client, stop, load, ds, overlay, entry, add,
                           remove, resume, state, sequence, wait_until, save, root, motion_profile='walk'):
    assert motion_profile in ['walk', 'jump']
    data = state('jungle-entry', stop)
    assert stop['registers']['cs'] == overlay and stop['registers']['eip'] == 0
    exe = (root/'game/DUCKTALE.EXE').read_bytes()
    expected = relocated_overlay(exe, 0x1fa00, load, 8, 24056, 436)
    read = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': overlay, 'offset': 0, 'len': 24056}]})
    save('jungle-code', {'load': load, 'ds': ds, 'segment': overlay, 'read': read})
    assert not read['aborted'] and read['results'][0]['status'] == 'ok'
    assert base64.b64decode(read['results'][0]['data']) == expected
    sp = stop['registers']['esp'] & 65535
    save('jungle-entry-contract', {'variant': struct.unpack_from('<H', data, sp+4)[0],
         'difficulty': data[0x8990], 'location': data[0x5b3c],
         'day': data[0x4e0e], 'seed': struct.unpack_from('<H', data, 0x2229)[0],
         'money': struct.unpack_from('<I', data, 0x8cc0)[0]})
    remove(entry)
    replay = client.get('/api/v1/input/replay/status')
    save('jungle-flight-setup-completed', replay)
    assert not replay['active'] and replay['remaining'] == 0
    marker = add(0x680)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker and stop['registers']['eax'] & 255 == 0
    state('jungle-first-input', stop)
    remove(marker)
    # Finish both initial page reveals before measuring ordinary movement.
    marker = add(0x49a)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker
    data = state('jungle-first-presentation', stop)
    remove(marker)
    assert struct.unpack_from('<H', data, 0x1aac)[0] == 0
    flip, ega = struct.unpack_from('<HH', data, 0x1fd4)
    assert flip == 0xe5
    read = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': ega, 'offset': 0, 'len': 2599}]})
    save('jungle-driver', {'segment': ega, 'read': read})
    assert not read['aborted'] and read['results'][0]['status'] == 'ok'
    driver = base64.b64decode(read['results'][0]['data'])
    original = base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'))[1].data).toString('base64'));"], cwd=root))
    # Compare the executed flip/wait and sprite code, not mutable driver state.
    for low, high in [(0x64, 0x72), (0xe5, 0x101), (0x35d, 0x515)]:
        assert driver[low:high] == original[low:high]
    assert client.get('/api/v1/debug/breakpoints')['breakpoints'] == []
    contract = None
    if motion_profile == 'jump':
        contract = json.loads((root/'reference/jungle-jump-inputs.json').read_text())
        assert contract['kind'] == 'original-jungle-jump-physical-inputs' and contract['expectedSamples'] == 120
        save('jungle-motion-input-contract', contract)
    template = (root/('scripts/jungle-jump-observer.lua' if contract else 'scripts/jungle-cadence-observer.lua')).read_text()
    lua = template.replace('__DS__', str(ds)).replace('__EGA__', str(ega))
    save('jungle-observer-script', {'source': lua, 'templateSHA256': hashlib.sha256(template.encode()).hexdigest(), 'ds': ds, 'ega': ega})
    loaded = client.post_text('/api/v1/script/load', lua, params={'name': 'jungle-cadence-observer'})
    started = client.post('/api/v1/script/start')
    save('jungle-observer-loaded', {'load': loaded, 'start': started})
    events = contract['events'] if contract else [
        {'type': 'key', 'key': 'KBD_right', 'pressed': True, 'frame': 0},
        {'type': 'key', 'key': 'KBD_right', 'pressed': False, 'frame': 40}]
    save('jungle-observer-inputs', {'events': events, 'scheduled': sequence(events)})
    continued = client.post('/api/v1/debug/continue')
    assert continued['resumed_from_stop_id'] == stop['stop_id']
    result = wait_until(lambda: client.get('/api/v1/script/status'),
        lambda r: r['state'] in ['completed', 'error'], timeout=20)
    save('jungle-observer-result', result)
    assert result['state'] == 'completed' and not result['output_truncated']
    assert result['output']['completed'] is True
    if contract:
        rows = result['output']['samplesCSV'].splitlines()
        assert len(rows) == 120 and all(len(row.split(',')) == 16 for row in rows)
    else:
        assert len(result['output']['samples']) == 120
    replay = client.get('/api/v1/input/replay/status')
    save('jungle-observer-replay', replay)
    assert not replay['active'] and replay['remaining'] == 0 and replay['dispatched'] == len(events)
    final = client.post('/api/v1/debug/pause')['stop']
    assert final['stop_id'] == stop['stop_id'] + 1
    state('jungle-observer-final', final)
    save('jungle-cadence', {'completed': True, 'expectedSamples': 120, 'motionProfile': motion_profile,
         'initialStopId': stop['stop_id'], 'finalStopId': final['stop_id'],
         'injections': [], 'partialRestore': False,
         'scope': 'Natural original swamp movement,120 consecutive render callbacks and fixed Right/release schedule. No intermediate debugger stops; not exact input/flip timestamps or port timing acceptance.'})
