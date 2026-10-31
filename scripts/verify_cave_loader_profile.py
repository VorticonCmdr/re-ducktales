"""One conditional original loader call and exact decoded planar payload."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires Python assertions')
import base64
import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
from capture_safari_cadence import relocated_overlay

ROOT = Path(__file__).resolve().parents[1]
sha = lambda b: hashlib.sha256(b).hexdigest()


def artifact(spec):
    p = ROOT/spec['path']
    assert p.is_file(), 'SETUP: missing cave loader artifact '+str(p)
    b = p.read_bytes()
    assert len(b) == spec['bytes'] and sha(b) == spec['sha256'], 'Corrupt cave loader artifact '+str(p)
    return b


def replay_ok(replay):
    assert not replay['active'] and replay['remaining'] == 0 and replay['dispatched'] == 4


def clock_ok(before, after, expected):
    first = struct.unpack_from('<I', before, 0x2225)[0]
    last = struct.unpack_from('<I', after, 0x2225)[0]
    assert expected in [84, 85] and last-first == expected, 'Changed loader clock bracket'
    return first, last


def verify():
    path = next((arg.split('=',1)[1] for arg in sys.argv[1:] if arg.startswith('--manifest=')), 'reference/cave-loader-native.json')
    m = json.loads((ROOT/path).read_text())
    resource = m['resource']; assert resource in [0, 10]
    before_ip, after_ip = (0x595, 0x59a) if resource == 0 else (0xfc5, 0xfca)
    caller_at, caller_size = (0x580, 64) if resource == 0 else (0xf51, 302)
    assert m['kind'] == 'original-cave-loader-conditional-profile' and m['expectedCases'] == 1
    assert not m['portTimingAcceptance'] and m['injections'] == [] and not m['partialRestore']
    objects = {name: json.loads(artifact(spec)) for name, spec in m['artifacts'].items() if name.endswith('.json')}
    for name, spec in m['artifacts'].items():
        if not name.endswith('.json'): artifact(spec)
    subprocess.run(['node', '--input-type=module', '-e',
        "import{validateProducerArchive}from'./scripts/lib/consumer-provenance.js';await validateProducerArchive(process.argv[1]);", m['producer']], cwd=ROOT, check=True)
    capture, life = objects['capture.json'], objects['lifecycle.json']
    assert capture['completed'] and capture['injections'] == [] and not capture['partialRestore']
    assert capture['scriptSha256'] == objects['source-revision.json']['files']['scripts/capture-security.py']
    assert life['terminal'] and life['returnCode'] == 0 and not life['homeOverridden'] and not life['sharedSessionChanged']
    assert capture['pid'] == life['ownedPID'] == objects['engine.json']['pid']
    tool = objects['profile-tool-identity.json']
    assert sha(Path(tool['executable']).read_bytes()) == tool['executableSha256'] == m['engineBinarySHA256']
    text = '\n'.join(x.rstrip() for x in objects['configuration.json']['screen']['text'].splitlines())
    for name, value in [('cpu cpu_cycles', '3000'), ('cpu core', 'normal'), ('dosbox memsize', '16'), ('dosbox vmem_delay', 'off'), ('dosbox machine', 'svga_s3')]: assert 'config -get '+name+'\n'+value in text
    build = json.loads(artifact(m['build']))
    for name, spec in build['files'].items():
        b = (ROOT/'game'/name).read_bytes()
        assert len(b) == spec['bytes'] and sha(b) == spec['sha256']
    code = objects['cave-code.json']; load = code['load']
    exe = (ROOT/'game/DUCKTALE.EXE').read_bytes()
    cave = relocated_overlay(exe, 0x1a800, load, 6, 11054, 196)
    assert base64.b64decode(code['read']['results'][0]['data']) == cave
    before_record, after_record = objects['cave-loader-before.json'], objects['cave-loader-after.json']
    for record, ip in [(before_record, before_ip), (after_record, after_ip)]:
        cpu = record['stop']['registers']
        assert cpu['cs'] == code['segment'] and cpu['eip'] == ip and cpu['ss'] == cpu['ds'] == code['ds']
        assert not record['stop']['protected_mode'] and not record['state']['aborted']
        assert all(r['status'] == 'ok' for r in record['state']['results'])
    assert after_record['stop']['stop_id'] == before_record['stop']['stop_id']+1
    before = base64.b64decode(before_record['state']['results'][1]['data'])
    after = base64.b64decode(after_record['state']['results'][1]['data'])
    assert len(before) == len(after) == 65536
    sp = before_record['stop']['registers']['esp'] & 65535
    destination = struct.unpack_from('<H', before, 0x203a)[0] if resource == 0 else 0x54fc
    assert struct.unpack_from('<HH', before, sp) == (resource, destination)
    assert after_record['stop']['registers']['eax'] & 65535 == destination
    assert [before[0x204a], before[0x2043], before[0x8b54]] == [1, 1, 1]
    assert struct.unpack_from('<H', before, 0x4d32)[0] == (45 if resource == 0 else 46)
    assert struct.unpack_from('<H', before, 0x8eb2)[0] == 1
    first, last = clock_ok(before, after, m['expectedDriverCounts'])
    profile = objects['cave-loader-profile.json']
    assert profile['completed'] and profile['resource'] == resource and profile['destination'] == destination
    assert [profile['beforeClock'], profile['afterClock'], profile['driverCounts']] == [first, last, m['expectedDriverCounts']]
    replay_ok(objects['cave-loader-replay.json'])
    if resource == 0:
        assert objects['cave-loader-inputs.json'] == {'events': [], 'scheduled': None}
        replay_ok(objects['cave-flight-setup-completed.json'])
    else: assert objects['cave-loader-inputs.json']['events'] == [
        {'type': 'key', 'key': key, 'pressed': pressed, 'frame': frame}
        for frame, pressed in [(0, True), (10, False)] for key in ['KBD_right', 'KBD_space']]
    # Unpacked original resident and independently decoded resource data.
    decoded = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame(),e=r.archives.get('EXP.ARC')[Number(process.argv[1])];process.stdout.write(JSON.stringify({image:Buffer.from(r.image).toString('base64'),pixels:Buffer.from(e.data).toString('base64')}));", str(resource)], cwd=ROOT))
    image = bytearray(base64.b64decode(decoded['image']))
    cursor = struct.unpack_from('<H', exe, 8)[0]*16+struct.unpack_from('<H', exe, 22)[0]*16+0x125
    for region in range(16):
        count = struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
        for _ in range(count):
            pos = region*65536+struct.unpack_from('<H', exe, cursor)[0]; cursor += 2
            struct.pack_into('<H', image, pos, (struct.unpack_from('<H', image, pos)[0]+load)&65535)
    load_code = objects['cave-loader-code.json']['read']
    assert not load_code['aborted'] and all(r['status'] == 'ok' for r in load_code['results'])
    assert base64.b64decode(load_code['results'][0]['data']) == cave[caller_at:caller_at+caller_size]
    at = 0x40e*16+0x175c
    assert base64.b64decode(load_code['results'][1]['data']) == image[at:at+585]
    source = json.loads(json.loads(artifact(m['converterSource']))['content'][0]['text'])
    assert source['success'] and not source['truncated'] and source['program'] == 'CAVE_CODE.EXE'
    at = 0x12f0
    for instruction in source['instructions']:
        assert instruction['address'] == f'140e:{at:04x}'
        raw = bytes.fromhex(instruction['bytes'])
        assert raw == image[0x40e*16+at:0x40e*16+at+len(raw)] and len(raw) == instruction['length']
        at += len(raw)
    assert at == 0x13ce and len(source['instructions']) == 89
    descriptor = list(struct.unpack_from('<6H' if resource == 0 else '<10H', after, destination)); payload = objects['cave-loader-payload.json']
    assert descriptor == payload['descriptor']
    if resource == 0:
        assert descriptor[:2] == [40, 200] and descriptor[4] == 8000 and payload['planes'] == 4
        span, planes, expected_size = 8000, 4, 32000
        offset, segment = descriptor[2:4]
    else:
        assert descriptor[2:6] == [17, 112, 68, 112] and descriptor[8] == 7616 and payload['planes'] == 5
        span, planes, expected_size = 7616, 5, 30464
        offset, segment = descriptor[6:8]
    assert after[0x2675] == (1 if resource == 0 else 2)
    assert payload['read']['results'][0]['addr'] == segment*16+offset
    assert not payload['read']['aborted'] and payload['read']['results'][0]['status'] == 'ok'
    actual = base64.b64decode(payload['read']['results'][0]['data'])
    pixels = base64.b64decode(decoded['pixels']); assert len(pixels) == expected_size
    expected = bytearray(span*planes); transparent = pixels[0] >> 4
    for p in range(len(pixels)*2):
        color = (pixels[p//2] >> (4 if p % 2 == 0 else 0)) & 15
        bit = 1 << (7-p%8)
        for plane in range(4):
            if color & (1 << plane): expected[plane*span+p//8] |= bit
        if planes == 5 and color != transparent: expected[4*span+p//8] |= bit
    assert actual == expected, 'Original planar sprite differs'
    negatives = 0
    wrong = bytearray(actual); wrong[200] ^= 1; assert wrong != expected; negatives += 1
    wrong = bytearray(after); struct.pack_into('<I', wrong, 0x2225, last+1)
    try: clock_ok(before, wrong, m['expectedDriverCounts'])
    except AssertionError: negatives += 1
    else: raise AssertionError('Accepted changed loader clock')
    wrong = copy.deepcopy(objects['cave-loader-replay.json']); wrong['dispatched'] = 3
    try: replay_ok(wrong)
    except AssertionError: negatives += 1
    else: raise AssertionError('Accepted unconsumed loader input')
    assert negatives == 3
    print(f'Original cave loader:one natural resource{resource} call,{last-first} conditional driver counts;exact585 loader/{caller_size} caller/222 converter bytes and{len(actual)} planar bytes;inputs/closed owned session,3 negatives. No port timing admission or fitted delay.')


if __name__ == '__main__': verify()
