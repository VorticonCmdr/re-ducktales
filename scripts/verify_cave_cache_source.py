"""Original input-loop call sites; no whole-level timing acceptance."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires assertions')
import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
from capture_safari_cadence import relocated_overlay

ROOT = Path(__file__).resolve().parents[1]


def artifact(spec):
    path = ROOT/spec['path']
    assert path.is_file(), 'SETUP: missing '+str(path)
    data = path.read_bytes()
    assert len(data) == spec['bytes'] and hashlib.sha256(data).hexdigest() == spec['sha256'], 'Corrupt source fixture'
    return json.loads(data)


def compare(data, body, manifest):
    assert data['success'] and not data['truncated']
    assert data['program'] == manifest['sourceProgram'] == 'CAVE_CODE.EXE'
    at = manifest['start']
    calls = []
    for ins in data['instructions']:
        segment, offset = (int(n, 16) for n in ins['address'].split(':'))
        assert segment*16+offset-0x1c170 == at, 'Missing source instruction'
        raw = bytes.fromhex(ins['bytes'])
        assert len(raw) == ins['length'] and body[at:at+len(raw)] == raw, 'Changed original instruction'
        if raw[0] == 0xe8:
            calls.append((at, at+3+struct.unpack_from('<h', raw, 1)[0]))
        at += len(raw)
    assert at == manifest['end'] and at-manifest['start'] == manifest['bytes']
    assert len(data['instructions']) == manifest['instructions'] == 319
    assert [at for at, target in calls if target == manifest['partyTarget']] == manifest['partyCalls']
    assert not any(target == manifest['excludedTarget'] for at, target in calls), 'Unexpected room composition call'


def verify():
    m = json.loads((ROOT/'reference/cave-cache-source.json').read_text())
    assert m['kind'] == 'original-cave-cached-input-loop-source'
    assert m['expectedCases'] == 1 and m['negativeControls'] == 2
    artifact(m['build'])
    artifact(m['nativeParent'])
    subprocess.run(['python3', 'scripts/verify_cave_cadence.py'], cwd=ROOT, check=True)
    body = relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(), 0x1a800, 0x1000, 6, 11054, 196)
    data = json.loads(artifact(m['source'])['content'][0]['text'])
    compare(data, body, m)
    for mode in ['changed-call', 'missing-instruction']:
        altered = copy.deepcopy(data)
        if mode == 'changed-call':
            next(i for i in altered['instructions'] if i['address'] == '1c17:0a90')['bytes'] = 'e8281c'
        else:
            altered['instructions'].pop()
        try:
            compare(altered, body, m)
        except AssertionError:
            pass
        else:
            raise AssertionError('Accepted '+mode)
    print('Cave cached input loop:894 original bytes/319 instructions,three party20b8 calls,no composition26bb call;2 negatives. Not whole-level timing acceptance.')


if __name__ == '__main__':
    verify()
