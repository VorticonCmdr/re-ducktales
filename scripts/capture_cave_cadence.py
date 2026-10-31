"""Natural Carlsbad entry; one independently scheduled Right+Fire passage."""
import base64
import hashlib
import struct
import subprocess
from capture_safari_cadence import relocated_overlay


COLUMNS = ['index', 'frame', 'clock', 'page', 'room', 'torch', 'money', 'seed',
           'enemy', 'partyX', 'partyY', 'partyFrame', 'entering']

def parse_samples(csv):
    rows = []
    for line in csv.splitlines():
        values = line.split(',')
        assert len(values) == len(COLUMNS), 'Missing cave observer field'
        assert all(value.isdigit() for value in values), 'Invalid cave observer integer'
        rows.append(dict(zip(COLUMNS, map(int, values))))
    return rows


def capture_cave_cadence(*, client, stop, load, ds, overlay, entry, add,
                         remove, resume, state, sequence, wait_until, save, root, loader_profile=False):
    data = state('cave-entry', stop)
    assert stop['registers']['cs'] == overlay and stop['registers']['eip'] == 0
    expected = relocated_overlay((root/'game/DUCKTALE.EXE').read_bytes(), 0x1a800, load, 6, 11054, 196)
    read = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': overlay, 'offset': 0, 'len': 11054}]})
    save('cave-code', {'load': load, 'ds': ds, 'segment': overlay, 'read': read})
    assert not read['aborted'] and read['results'][0]['status'] == 'ok'
    assert base64.b64decode(read['results'][0]['data']) == expected
    sp = stop['registers']['esp'] & 65535
    contract = {'variant': struct.unpack_from('<H', data, sp+4)[0],
         'difficulty': data[0x8990], 'location': data[0x5b3c],
         'day': data[0x4e0e], 'seed': struct.unpack_from('<H', data, 0x2229)[0],
         'money': struct.unpack_from('<I', data, 0x8cc0)[0]}
    save('cave-entry-contract', contract)
    assert contract['variant'] == 1, 'Unexpected Carlsbad map variant'
    remove(entry)
    replay = client.get('/api/v1/input/replay/status')
    save('cave-flight-setup-completed', replay)
    assert not replay['active'] and replay['remaining'] == 0
    marker = add(0x9a6)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == marker and stop['registers']['eax'] & 255 == 0
    data = state('cave-first-input', stop)
    remove(marker)
    assert struct.unpack_from('<H', data, 0x4d32)[0] == 45
    assert data[0x3c1] == 0
    flip, ega = struct.unpack_from('<HH', data, 0x1fd4)
    assert flip == 0xe5
    read = client.post('/api/v1/batch', json={'ops': [
        {'op': 'mem_read', 'segment': ega, 'offset': 0, 'len': 2599}]})
    save('cave-driver', {'segment': ega, 'read': read})
    assert not read['aborted'] and read['results'][0]['status'] == 'ok'
    driver = base64.b64decode(read['results'][0]['data'])
    original = base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'))[1].data).toString('base64'));"], cwd=root))
    for lo, hi in [(0x64, 0x72), (0xe5, 0x101), (0x35d, 0x515)]:
        assert driver[lo:hi] == original[lo:hi]
    if loader_profile:
        from capture_cave_loader_profile import capture_cave_loader_profile
        return capture_cave_loader_profile(client=client, stop=stop, load=load, ds=ds, overlay=overlay,
            add=add, remove=remove, resume=resume, state=state, sequence=sequence, save=save, root=root)
    assert client.get('/api/v1/debug/breakpoints')['breakpoints'] == []
    template = (root/'scripts/cave-cadence-observer.lua').read_text()
    lua = template.replace('__DS__', str(ds)).replace('__EGA__', str(ega))
    save('cave-observer-script', {'source': lua, 'templateSHA256': hashlib.sha256(template.encode()).hexdigest(), 'ds': ds, 'ega': ega})
    loaded = client.post_text('/api/v1/script/load', lua, params={'name': 'cave-cadence-observer'})
    started = client.post('/api/v1/script/start')
    save('cave-observer-loaded', {'load': loaded, 'start': started})
    events = [{'type': 'key', 'key': key, 'pressed': pressed, 'frame': frame}
              for frame, pressed in [(0, True), (10, False)] for key in ['KBD_right', 'KBD_space']]
    save('cave-observer-inputs', {'events': events, 'scheduled': sequence(events)})
    continued = client.post('/api/v1/debug/continue')
    assert continued['resumed_from_stop_id'] == stop['stop_id']
    result = wait_until(lambda: client.get('/api/v1/script/status'),
        lambda r: r['state'] in ['completed', 'error'], timeout=20)
    save('cave-observer-result', result)
    assert result['state'] == 'completed' and not result['output_truncated']
    assert result['output']['completed'] is True and len(parse_samples(result['output']['samplesCSV'])) == 480
    replay = client.get('/api/v1/input/replay/status')
    save('cave-observer-replay', replay)
    assert not replay['active'] and replay['remaining'] == 0 and replay['dispatched'] == 4
    final = client.post('/api/v1/debug/pause')['stop']
    assert final['stop_id'] == stop['stop_id'] + 1
    state('cave-observer-final', final)
    save('cave-cadence', {'completed': True, 'expectedSamples': 480,
         'initialStopId': stop['stop_id'], 'finalStopId': final['stop_id'],
         'injections': [], 'partialRestore': False,
         'scope': 'Natural original Carlsbad passage,480 consecutive callbacks and fixed Right+Fire/release schedule. No intermediate stops; not exact instruction/flip timestamps or port timing acceptance.'})
