"""Initial cave load/coordinate/minimap/RNG order,from original bytes."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires assertions')
import copy
import json
import struct
import subprocess
from verify_cave_load_boundaries import ROOT, artifact, listing
from capture_safari_cadence import relocated_overlay


def verify():
    m = json.loads((ROOT/'reference/cave-initialization-source.json').read_text())
    assert m['kind'] == 'original-cave-initialization-source' and m['expectedCases'] == 1
    for key in ['build', 'nativeParent', 'workParent']:
        artifact(m[key])
    subprocess.run(['python3', 'scripts/verify_cave_cadence.py'], cwd=ROOT, check=True)
    body = relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(), 0x1a800, 0x1000, 6, 11054, 196)
    raw = artifact(m['source'])
    code = listing(raw, body, 0x1c170, 0xb, 0x449)
    assert len(code) == m['sourceInstructions'] == 350 and 0x449-0xb == m['sourceBytes'] == 1086
    # Clear map,then pass zero descriptor and the variant stack argument.
    assert code[0x64].hex() == 'c787425a0000'
    assert body[0xa7:0xad].hex() == '2bc050ff7606'
    calls = [at for at, b in code.items() if b.hex() == '9a5c170e14']
    assert calls[0] == 0xad and len(calls) == 21
    resources = []
    for at in calls[1:]:
        assert body[at-4] == 0xb8 and body[at-1] == 0x50
        resources.append(struct.unpack_from('<H', body, at-3)[0])
    assert resources == [17,18,19,20,21,4,5,6,3,22,23,26,37,38,39,40,41,42,43,14]
    assert resources[:1]+resources[5:] == m['expectedDefaultSprites']
    assert resources[1:5] == m['optionalSprites']
    assert code[0x195].hex() == '803e2b5d00' and code[0x19a].hex() == '7440'
    assert 0x19c+0x40 == 0x1dc  # Optional four loads branch to resource4 setup.
    assert code[0x189].hex() == 'c706de795200'
    assert code[0x18f].hex() == 'c706e0792600'
    assert code[0x3c1].hex() == 'ff1ef01f'  # Map sprite37 before minimap helper.
    assert code[0x3d0].hex() == 'e8f518'
    assert code[0x408].hex() == '9ab80e0e14'  # Enemy RNG after minimap.
    assert code[0x403].hex() == 'a3b097'
    for mode in ['missing-instruction', 'changed-map-call']:
        wrong = copy.deepcopy(raw)
        d = json.loads(wrong['content'][0]['text'])
        if mode == 'missing-instruction':
            next(i for i in d['instructions'] if i['address'] == '1c17:00a4')
            d['instructions'] = [i for i in d['instructions'] if i['address'] != '1c17:00a4']
        else:
            next(i for i in d['instructions'] if i['address'] == '1c17:00ad')['bytes'] = '9a5d170e14'
        wrong['content'][0]['text'] = json.dumps(d)
        try:
            listing(wrong, body, 0x1c170, 0xb, 0x449)
        except AssertionError:
            pass
        else:
            raise AssertionError('Accepted '+mode)
    print('Cave initialization source:1086 original bytes/350 contiguous instructions,map then16 sprites/4 optional loads,coordinates after load,minimap before enemy RNG;2 negatives. Not complete initialization timing.')


if __name__ == '__main__':
    verify()
