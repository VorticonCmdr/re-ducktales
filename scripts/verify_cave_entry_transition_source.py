"""Source/live-vector proof of cave entry wipes/reveal; no runtime admission."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires Python assertions')
import base64
import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
from capture_safari_cadence import relocated_overlay
ROOT = Path(__file__).resolve().parents[1]


def artifact(spec):
    p = ROOT/spec['path']
    assert p.is_file(), 'SETUP: missing cave entry source '+str(p)
    b = p.read_bytes()
    assert len(b) == spec['bytes'] and hashlib.sha256(b).hexdigest() == spec['sha256']
    return json.loads(b)


def listing_ok(value, original, segment, start, end, bias=0):
    data = json.loads(value['content'][0]['text'])
    assert data['success'] and not data['truncated']
    at = start
    for i in data['instructions']:
        assert i['address'] == f'{segment}:{at:04x}'
        raw = bytes.fromhex(i['bytes'])
        assert len(raw) == i['length'] and raw == original[bias+at:bias+at+len(raw)], 'Changed entry source bytes'
        at += len(raw)
    assert at == end, 'Missing entry instruction'
    return len(data['instructions'])


def verify():
    m = json.loads((ROOT/'reference/cave-entry-transition-source.json').read_text())
    assert m['kind'] == 'original-cave-entry-transition-source' and m['runtimeImplemented'] is False
    subprocess.run(['python3', 'scripts/verify_cave_cadence.py'], cwd=ROOT, check=True)
    parent = artifact(m['nativeParent'])
    native = artifact(parent['artifacts']['cave-first-input.json'])
    memory = base64.b64decode(native['state']['results'][1]['data'])
    assert struct.unpack_from('<H', memory, 0x1fe0)[0] == 0x155
    assert struct.unpack_from('<H', memory, 0x1fdc)[0] == 0x101
    assert struct.unpack_from('<H', memory, 0x1fe2)[0] == struct.unpack_from('<H', memory, 0x1fde)[0]
    body = relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(), 0x1a800, 0x1000, 6, 11054, 196)
    driver = base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame();process.stdout.write(Buffer.from(r.archives.get('IT.DRV')[1].data).toString('base64'));"], cwd=ROOT))
    live_driver = artifact(parent['artifacts']['cave-driver.json'])
    assert live_driver['segment'] == struct.unpack_from('<H', memory, 0x1fe2)[0]
    assert base64.b64decode(live_driver['read']['results'][0]['data'])[0x101:0x1b0] == driver[0x101:0x1b0]
    entry, ega = artifact(m['source']['entry']), artifact(m['source']['driver'])
    instructions = listing_ok(entry, body, '1c17', 0x491, 0x63c) + listing_ok(ega, driver, '0000', 0x101, 0x1b0)
    assert instructions == m['expectedInstructions'] == 221 and m['expectedBytes'] == 602
    for at, opcode in [(0x491, 'ff1ee01f'), (0x57e, 'ff1ee01f'), (0x638, 'ff1edc1f')]:
        assert body[at:at+4].hex() == opcode
    assert body[0x595:0x59a].hex() == '9a5c170e14'
    assert body[0x5e9:0x5ed].hex() == 'ff1ed41f'
    # Both helpers step one row(40 bytes) per band and five rows per inner
    # stride;forty rows/band. Each of five bands calls the retrace wait five times.
    for at in [0x127, 0x187]: assert driver[at:at+3].hex() == '83c228'
    for at in [0x12a, 0x18a]: assert driver[at:at+4].hex() == '81fac800'
    for at in [0x146, 0x1a2]: assert driver[at:at+3].hex() == 'b90500'
    assert [m['groups'], m['retracesPerGroup']] == [5, 5]
    for kind in ['byte', 'missing']:
        wrong = copy.deepcopy(entry); data = json.loads(wrong['content'][0]['text'])
        if kind == 'byte': data['instructions'][0]['bytes'] = 'ff1ed41f'
        else: data['instructions'].pop()
        wrong['content'][0]['text'] = json.dumps(data)
        try: listing_ok(wrong, body, '1c17', 0x491, 0x63c)
        except AssertionError: pass
        else: raise AssertionError('Accepted changed entry '+kind)
    print('Cave entry source:602 original bytes/221 instructions,live EGA vectors and helper bytes;two wipe call sites and room reveal,5x5 retrace structure,2 negatives. Runtime restoration pending.')


if __name__ == '__main__': verify()
