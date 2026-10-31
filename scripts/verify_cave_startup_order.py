"""Exact original startup/torch order. Static evidence,not full entry timing."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires assertions')
import base64
import copy
import json
import struct
import subprocess
from verify_cave_load_boundaries import ROOT, artifact, listing
from capture_safari_cadence import relocated_overlay


def verify():
    m = json.loads((ROOT/'reference/cave-startup-order.json').read_text())
    assert m['kind'] == 'original-cave-startup-and-torch-order' and m['expectedCases'] == 3
    artifact(m['build'])
    cache = artifact(m['cacheParent'])
    subprocess.run(['python3', 'scripts/verify_cave_cache_source.py'], cwd=ROOT, check=True)
    exe = (ROOT/'game/DUCKTALE.EXE').read_bytes()
    cave = relocated_overlay(exe, 0x1a800, 0x1000, 6, 11054, 196)
    image = bytearray(base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame();process.stdout.write(Buffer.from(r.image).toString('base64'));"], cwd=ROOT)))
    cursor = struct.unpack_from('<H', exe, 8)[0]*16+struct.unpack_from('<H', exe, 22)[0]*16+0x125
    for region in range(16):
        count = struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
        for _ in range(count):
            pos = region*65536+struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
            struct.pack_into('<H', image, pos, (struct.unpack_from('<H', image, pos)[0]+0x1000)&65535)
    resident = image[0x40e0:]
    startup_raw = artifact(m['source']['startup'])
    startup = listing(startup_raw, cave, 0x1c170, 0x449, 0x49a)
    torch = listing(artifact(m['source']['torch']), cave, 0x1c170, 0x4e8, 0x57e)
    flush = listing(artifact(m['source']['flush']), resident, 0x140e0, 0x19a5, 0x19c5)
    assert [len(startup), len(torch), len(flush)] == [26, 45, 15]
    assert sum(map(len, [startup, torch, flush])) == m['expectedInstructions'] == 86
    assert 81+150+32 == m['expectedBytes'] == 263
    assert startup[0x476].hex() == '2bc0' and startup[0x478].hex() == '50'
    assert startup[0x479].hex() == 'ff1e1c20'  # Sound0 before wipe.
    assert startup[0x491].hex() == 'ff1ee01f'
    assert startup[0x495].hex() == '9aa5190e14'  # Flush after wipe.
    # BIOS head=tail plus128 bytes of native key flags cleared under CLI/STI.
    for at, raw in [(0x19a6,'fa'),(0x19ac,'26a11c00'),(0x19b0,'26a31a00'),
                    (0x19b8,'bf6c27'),(0x19bb,'b94000'),(0x19c0,'f3ab'),(0x19c2,'fb')]:
        assert flush[at].hex() == raw
    assert torch[0x4f0].hex() == 'c706284e0f00'
    assert torch[0x54c].hex() == 'c706284e1000'
    assert torch[0x566].hex() == '9a5c170e14'
    loop = listing(artifact(cache['source']), cave, 0x1c170, 0x9a6, 0xd24)
    assert loop[0xb2b].hex() == 'c706284e0f00'
    assert loop[0xb6d].hex() == 'c706284e1000'
    assert loop[0xb87].hex() == '9a5c170e14'
    for mode in ['changed-call', 'missing-instruction']:
        wrong = copy.deepcopy(startup_raw)
        d = json.loads(wrong['content'][0]['text'])
        if mode == 'changed-call':
            next(i for i in d['instructions'] if i['address'] == '1c17:0495')['bytes'] = '9aa4190e14'
        else:
            d['instructions'].pop()
        wrong['content'][0]['text'] = json.dumps(d)
        try:
            listing(wrong, cave, 0x1c170, 0x449, 0x49a)
        except AssertionError:
            pass
        else:
            raise AssertionError('Accepted '+mode)
    print('Cave startup order:263 original bytes/86 instructions;Sound0 before wipe,BIOS/native flush after wipe,torch selection before load in entry/idle branches;2 negatives. Static order only,not initial preparation timing.')


if __name__ == '__main__':
    verify()
