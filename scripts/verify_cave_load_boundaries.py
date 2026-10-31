"""Exact source of descriptor-before-decode and composition load boundaries."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires assertions')
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
    assert p.is_file(), 'SETUP: missing '+str(p)
    b = p.read_bytes()
    assert len(b) == spec['bytes'] and hashlib.sha256(b).hexdigest() == spec['sha256'], 'Corrupt source fixture'
    return json.loads(b)


def listing(value, original, base, first, end):
    d = json.loads(value['content'][0]['text'])
    assert d['success'] and not d['truncated'] and d['program'] == 'CAVE_CODE.EXE'
    at = first
    instructions = {}
    for i in d['instructions']:
        segment, offset = (int(n, 16) for n in i['address'].split(':'))
        assert segment*16+offset-base == at, 'Missing source instruction'
        raw = bytes.fromhex(i['bytes'])
        assert len(raw) == i['length'] and original[at:at+len(raw)] == raw, 'Changed original instruction'
        instructions[at] = raw
        at += len(raw)
    assert at == end
    return instructions


def verify():
    m = json.loads((ROOT/'reference/cave-load-boundaries.json').read_text())
    assert m['kind'] == 'original-cave-load-boundaries' and m['expectedCases'] == 2
    assert m['initialPreparationTimed'] is False and m['completeLoaderTiming'] is False
    for key in ['build', 'nativeParent', 'backgroundParent', 'entryParent']:
        artifact(m[key])
    for args in [[], ['--manifest=reference/cave-background-load-native.json']]:
        subprocess.run(['python3', 'scripts/verify_cave_loader_profile.py', *args], cwd=ROOT, check=True)
    exe = (ROOT/'game/DUCKTALE.EXE').read_bytes()
    image = bytearray(base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame();process.stdout.write(Buffer.from(r.image).toString('base64'));"], cwd=ROOT)))
    cursor = struct.unpack_from('<H', exe, 8)[0]*16+struct.unpack_from('<H', exe, 22)[0]*16+0x125
    for region in range(16):
        count = struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
        for _ in range(count):
            pos = region*65536+struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
            struct.pack_into('<H', image, pos, (struct.unpack_from('<H', image, pos)[0]+0x1000)&65535)
    resident = image[0x40e0:]
    cave = relocated_overlay(exe, 0x1a800, 0x1000, 6, 11054, 196)
    loader_raw = artifact(m['source']['loader'])
    loader = listing(loader_raw, resident, 0x140e0, 0x175c, 0x19a5)
    composition = listing(artifact(m['source']['composition']), cave, 0x1c170, 0x26c5, 0x28af)
    assert len(loader) == 228 and len(composition) == 168
    assert len(loader)+len(composition) == m['sourceInstructions'] == 396
    assert 585+490 == m['sourceBytes'] == 1075
    # Header position/frame zeroing precedes the type2 decoder call194f.
    assert loader[0x18ec].hex() == 'c6471200'
    assert loader[0x18f0].hex() == 'c7070000'
    assert loader[0x18f4].hex() == 'c747020000'
    assert loader[0x194f][0] == 0x9a
    calls = [at for at, raw in composition.items() if raw.hex() == '9a5c170e14']
    assert len(calls) == 5
    resources = []
    for at in calls:
        assert cave[at-4] == 0xb8 and cave[at-1] == 0x50
        resources.append(struct.unpack_from('<H', cave, at-3)[0])
    assert resources == [2, 9, 8, 7, 1]
    for mode in ['changed-descriptor', 'missing-instruction']:
        wrong = copy.deepcopy(loader_raw)
        d = json.loads(wrong['content'][0]['text'])
        if mode == 'changed-descriptor':
            next(i for i in d['instructions'] if i['address'] == '140e:18f0')['bytes'] = 'c7070100'
        else:
            d['instructions'].pop()
        wrong['content'][0]['text'] = json.dumps(d)
        try:
            listing(wrong, resident, 0x140e0, 0x175c, 0x19a5)
        except AssertionError:
            pass
        else:
            raise AssertionError('Accepted '+mode)
    print('Cave load boundaries:1075 original bytes/396 instructions,descriptor zeroing before decoder and composition loads2/9/8/7/1;2 negatives. Initial preparation and full loader timing remain open.')


if __name__ == '__main__':
    verify()
