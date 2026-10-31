"""Strict saved original passage window; not port timing acceptance."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires Python assertions')
import base64
import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
from capture_cave_cadence import parse_samples
from capture_safari_cadence import relocated_overlay

ROOT = Path(__file__).resolve().parents[1]
sha = lambda b: hashlib.sha256(b).hexdigest()


def samples_ok(csv, m):
    samples = parse_samples(csv)
    assert len(samples) == m['expectedSamples'] == 480, 'Missing cave sample'
    assert samples[0] == m['expectedFirstSample'] and samples[-1] == m['expectedLastSample']
    changes = []
    for i, row in enumerate(samples):
        assert row['index'] == i+1 and row['frame'] == samples[0]['frame']+i, 'Skipped cave frame'
        assert row['room'] in [45, 46] and row['torch'] in [1, 2] and row['money'] == 0
        assert row['page'] in [0, 1] and row['entering'] in [0, 1] and row['enemy'] == 27
        if i:
            assert row['clock'] >= samples[i-1]['clock']
            if any(row[k] != samples[i-1][k] for k in ['room', 'torch', 'entering', 'money']): changes.append(row['index'])
    assert changes == m['expectedTransitionIndices'] == [20, 198, 382]
    assert samples[-1]['frame']-samples[0]['frame'] == m['expectedFrameSpan'] == 479
    assert samples[-1]['clock']-samples[0]['clock'] == m['expectedClockSpan'] == 498
    assert abs(479/70.086-498*16380/1193182) <= 16380/1193182


def inputs_ok(value, replay):
    assert value['events'] == [
        {'type': 'key', 'key': key, 'pressed': pressed, 'frame': frame}
        for frame, pressed in [(0, True), (10, False)] for key in ['KBD_right', 'KBD_space']]
    assert value['scheduled']['events_scheduled'] == 4
    assert not replay['active'] and replay['remaining'] == 0 and replay['dispatched'] == 4


def verify():
    m = json.loads((ROOT/'reference/cave-native-cadence.json').read_text())
    assert m['kind'] == 'original-cave-cadence-observation' and m['nativeObservation'] and not m['portTimingAcceptance']
    assert m['injections'] == [] and not m['partialRestore']
    objects = {}
    for name, spec in m['artifacts'].items():
        p = ROOT/spec['path']
        assert p.is_file(), 'SETUP: missing native cave artifact '+str(p)
        b = p.read_bytes()
        assert len(b) == spec['bytes'] and sha(b) == spec['sha256'], 'Corrupt cave artifact '+name
        if p.suffix == '.json': objects[name] = json.loads(b)
    subprocess.run(['node', '--input-type=module', '-e',
        "import{validateProducerArchive}from'./scripts/lib/consumer-provenance.js';await validateProducerArchive(process.argv[1]);", m['producer']], cwd=ROOT, check=True)
    capture, source, life = objects['capture.json'], objects['source-revision.json'], objects['lifecycle.json']
    assert capture['completed'] and capture['scriptSha256'] == source['files']['scripts/capture-security.py']
    assert capture['injections'] == [] and not capture['partialRestore']
    assert life['terminal'] and life['returnCode'] == 0 and not life['homeOverridden'] and not life['sharedSessionChanged']
    assert life['ownedPID'] == capture['pid'] == objects['engine.json']['pid']
    assert capture['instanceId'] == objects['engine.json']['instance_id']
    tool = objects['profile-tool-identity.json']
    assert sha(Path(tool['executable']).read_bytes()) == tool['executableSha256'] == m['engineBinarySHA256']
    text = '\n'.join(x.rstrip() for x in objects['configuration.json']['screen']['text'].splitlines())
    for name, value in [('cpu cpu_cycles', '3000'), ('cpu core', 'normal'), ('dosbox memsize', '16'), ('dosbox vmem_delay', 'off'), ('dosbox machine', 'svga_s3')]: assert 'config -get '+name+'\n'+value in text
    build_bytes = (ROOT/'reference/build.json').read_bytes(); assert sha(build_bytes) == m['buildManifestSHA256']
    for name, spec in json.loads(build_bytes)['files'].items():
        b = (ROOT/'game'/name).read_bytes()
        assert len(b) == spec['bytes'] and sha(b) == spec['sha256']
    code = objects['cave-code.json']; read = code['read']
    assert not read['aborted'] and read['results'][0]['status'] == 'ok'
    expected = relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(), 0x1a800, code['load'], 6, 11054, 196)
    live = base64.b64decode(read['results'][0]['data']); assert live == expected
    for name, ip in [('cave-entry.json', 0), ('cave-first-input.json', 0x9a6)]:
        record = objects[name]; cpu = record['stop']['registers']
        assert cpu['cs'] == code['segment'] and cpu['eip'] == ip and cpu['ds'] == cpu['ss'] == code['ds']
        assert not record['stop']['protected_mode'] and not record['state']['aborted']
        assert all(r['status'] == 'ok' for r in record['state']['results'])
    first = objects['cave-first-input.json']; assert first['stop']['registers']['eax'] & 255 == 0
    data = base64.b64decode(first['state']['results'][1]['data']); assert len(data) == 65536
    assert struct.unpack_from('<H', data, 0x4d32)[0] == 45 and data[0x3c1] == 0
    driver = base64.b64decode(objects['cave-driver.json']['read']['results'][0]['data'])
    original = base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame();process.stdout.write(Buffer.from(r.archives.get('IT.DRV')[1].data).toString('base64'));"], cwd=ROOT))
    for lo, hi in [(0x64, 0x72), (0xe5, 0x101), (0x35d, 0x515)]: assert driver[lo:hi] == original[lo:hi]
    result = objects['cave-observer-result.json']; observation = objects['cave-cadence.json']
    assert result['state'] == 'completed' and not result['output_truncated'] and result['output']['completed']
    assert result['output']['expectedSamples'] == 480
    assert observation['completed'] and observation['injections'] == [] and not observation['partialRestore']
    assert observation['finalStopId'] == observation['initialStopId']+1 == first['stop']['stop_id']+1
    assert objects['cave-observer-final.json']['stop']['stop_id'] == observation['finalStopId']
    inputs_ok(objects['cave-observer-inputs.json'], objects['cave-observer-replay.json'])
    for name, count in [('startup-inputs.json', 10), ('cave-flight-setup-completed.json', 4)]:
        receipt = objects[name].get('receipt', objects[name])
        assert not receipt['active'] and receipt['remaining'] == 0 and receipt['dispatched'] == count
    csv = result['output']['samplesCSV']; samples_ok(csv, m)
    negatives = 0
    rows = csv.splitlines()
    for kind in ['missing', 'field', 'frame']:
        wrong = rows.copy()
        if kind == 'missing': wrong.pop()
        else:
            fields = wrong[20].split(',')
            if kind == 'field': fields.pop()
            else: fields[1] = str(int(fields[1])+1)
            wrong[20] = ','.join(fields)
        try: samples_ok('\n'.join(wrong), m)
        except AssertionError: negatives += 1
        else: raise AssertionError('Accepted cave corruption '+kind)
    wrong = copy.deepcopy(objects['cave-observer-inputs.json']); wrong['events'].pop()
    try: inputs_ok(wrong, objects['cave-observer-replay.json'])
    except AssertionError: negatives += 1
    else: raise AssertionError('Accepted missing cave release')
    wrong = bytearray(live); wrong[0] ^= 1; assert wrong != expected; negatives += 1
    assert negatives == 5
    # Ghidra's aliases are checked by contiguous original bytes,not by its
    # requested-range summary (the final instruction extends beyond the request).
    spec = m['rightPassageSource']; b = (ROOT/spec['path']).read_bytes()
    assert len(b) == spec['bytes'] and sha(b) == spec['sha256']
    listing = json.loads(json.loads(b)['content'][0]['text'])
    assert listing['success'] and not listing['truncated'] and listing['program'] == 'CAVE_CODE.EXE'
    analysis = relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(), 0x1a800, 0x1000, 6, 11054, 196)
    at = 0x2b1
    for instruction in listing['instructions']:
        assert instruction['address'] == f'1ce1:{at:04x}'
        raw = bytes.fromhex(instruction['bytes'])
        assert len(raw) == instruction['length'] and raw == analysis[0xca0+at:0xca0+at+len(raw)]
        at += len(raw)
    assert at == 0x3df and len(listing['instructions']) == 106
    by_address = {i['address']: i['bytes'] for i in listing['instructions']}
    assert by_address['1ce1:02f6'] == 'ff06324d'
    assert by_address['1ce1:02fa'] == 'c706b28e0100'
    assert by_address['1ce1:0325'] == '9a5c170e14'
    assert by_address['1ce1:03d4'] == 'e81f14'
    print('Original cave:480 complete consecutive CSV samples,479 frame intervals,498 driver counts;four inputs consumed,exact11054-byte relocated cave and three EGA code ranges,closed owned session,5 negatives. Window ends before reward;not port timing acceptance.')


if __name__ == '__main__': verify()
