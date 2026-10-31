"""Original treasure wipe/load/two compositions/cached animation loops."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires assertions')
import copy
import json
import struct
import subprocess
from verify_cave_load_boundaries import ROOT, artifact, listing
from capture_safari_cadence import relocated_overlay


def verify():
    m = json.loads((ROOT/'reference/cave-treasure-order.json').read_text())
    assert m['kind'] == 'original-cave-treasure-order' and m['expectedCases'] == 1
    artifact(m['nativeParent'])
    subprocess.run(['python3', 'scripts/verify_cave_cadence.py'], cwd=ROOT, check=True)
    body = relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(), 0x1a800, 0x1000, 6, 11054, 196)
    raw = artifact(m['source'])
    code = listing(raw, body, 0x1c170, 0x16b4, 0x1827)
    assert len(code) == m['sourceInstructions'] == 144 and 0x1827-0x16b4 == m['sourceBytes'] == 371
    scenes = [at for at,b in code.items() if b[0] == 0xe8 and at+3+struct.unpack_from('<h',b,1)[0] == 0x26bb]
    assert scenes == [0x1715, 0x1748] and len(scenes) == m['expectedCompositions'] == 2
    for at, expected in [(0x16fb,'ff1ee01f'),(0x1706,'9a5c170e14'),
                         (0x173d,'ff1edc1f'),(0x1770,'ff1ed41f'),
                         (0x178f,'ff1eec1f'),(0x17f4,'ff1eec1f'),
                         (0x17bc,'837e9603'),(0x1821,'837e960a')]:
        assert code[at].hex() == expected
    assert body[0x1703:0x1706].hex() == '2bc050'  # Background resource0.
    # Caller copies occur once per3/10-frame loop,additional to party20b8.
    assert m['expectedCallerCopies'] == 3+10
    assert m['expectedPartyCalls'] == m['expectedPresentationCalls'] == 2+3+10
    assert m['expectedRequestedRetraces'] == 25+25+14
    for mode in ['wrong-call','missing-instruction']:
        wrong = copy.deepcopy(raw); d = json.loads(wrong['content'][0]['text'])
        if mode == 'wrong-call':
            next(i for i in d['instructions'] if i['bytes']=='ff1ee01f')['bytes']='ff1ed41f'
        else: d['instructions'].pop()
        wrong['content'][0]['text']=json.dumps(d)
        try: listing(wrong, body, 0x1c170, 0x16b4, 0x1827)
        except AssertionError: pass
        else: raise AssertionError('Accepted '+mode)
    print('Cave treasure source:371 original bytes/144 instructions,2 compositions,opening wipe/background0,3+10 cached frames with13 explicit caller copies;2 negatives. Not native ending timing acceptance.')


if __name__ == '__main__': verify()
