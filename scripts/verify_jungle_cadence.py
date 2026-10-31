"""Strict saved natural jungle observation; not port timing acceptance."""
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
from verify_safari_fpu_source import verify_source

ROOT = Path(__file__).resolve().parents[1]
sha = lambda b: hashlib.sha256(b).hexdigest()


def samples_ok(samples, m):
    assert len(samples) == m['expectedSamples'] == 120, 'Missing jungle sample'
    assert samples[0] == m['expectedFirstSample']
    assert samples[-1] == m['expectedLastSample']
    changes = []
    for i, row in enumerate(samples):
        assert row['index'] == i+1 and row['frame'] == samples[0]['frame']+i, 'Skipped jungle frame'
        assert row['outcome'] == 0 and row['lostLives'] == 1
        # Resident IRQ keyboard table: make/held80h,break40h,cleared00h.
        # Original flushes can clear a held key before keyboard repeat restores it.
        assert row['page'] in [0, 1] and row['right'] in [0, 64, 128]
        if i:
            assert row['clock'] >= samples[i-1]['clock']
            if any(row[k] != samples[i-1][k] for k in ['x', 'y', 'action']):
                changes.append(row['index'])
    assert changes == m['expectedMotionChangeIndices']
    assert samples[-1]['frame']-samples[0]['frame'] == m['expectedFrameSpan'] == 119
    assert samples[-1]['clock']-samples[0]['clock'] == m['expectedClockSpan'] == 123
    assert abs(119/70.086-123*16380/1193182) <= 16380/1193182
    assert any(row['right'] == 128 for row in samples[:40])
    assert all(row['right'] == 0 for row in samples[41:])


def inputs_ok(value, replay, m):
    assert value['events'] == m['events'] == [
        {'type': 'key', 'key': 'KBD_right', 'pressed': True, 'frame': 0},
        {'type': 'key', 'key': 'KBD_right', 'pressed': False, 'frame': 40}]
    assert value['scheduled']['events_scheduled'] == 2
    assert not replay['active'] and replay['remaining'] == 0 and replay['dispatched'] == 2


def verify():
    m = json.loads((ROOT/'reference/jungle-native-cadence.json').read_text())
    assert m['kind'] == 'original-jungle-cadence-observation'
    assert m['nativeObservation'] and not m['portTimingAcceptance']
    assert m['injections'] == [] and not m['partialRestore']
    objects = {}
    for role, spec in m['artifacts'].items():
        p = ROOT/spec['path']
        assert p.is_file(), 'SETUP: missing original jungle artifact '+str(p)
        b = p.read_bytes()
        assert len(b) == spec['bytes'] and sha(b) == spec['sha256'], 'Corrupt jungle artifact '+role
        if p.suffix == '.json': objects[role] = json.loads(b)
    assert len(objects) > 0
    subprocess.run(['node', '--input-type=module', '-e',
        "import{validateProducerArchive}from'./scripts/lib/consumer-provenance.js';await validateProducerArchive(process.argv[1]);", m['producer']], cwd=ROOT, check=True)
    capture, source = objects['capture.json'], objects['source-revision.json']
    assert capture['completed'] and capture['injections'] == [] and not capture['partialRestore']
    assert capture['scriptSha256'] == source['files']['scripts/capture-security.py']
    life, engine = objects['lifecycle.json'], objects['engine.json']
    assert life['terminal'] and life['returnCode'] == 0 and not life['homeOverridden'] and not life['sharedSessionChanged']
    assert life['ownedPID'] == capture['pid'] == engine['pid']
    assert capture['instanceId'] == engine['instance_id']
    tool = objects['profile-tool-identity.json']
    assert sha(Path(tool['executable']).read_bytes()) == tool['executableSha256'] == m['engineBinarySHA256']
    text = '\n'.join(x.rstrip() for x in objects['configuration.json']['screen']['text'].splitlines())
    for name, value in [('cpu cpu_cycles', '3000'), ('cpu core', 'normal'), ('dosbox memsize', '16'), ('dosbox vmem_delay', 'off'), ('dosbox machine', 'svga_s3')]:
        assert 'config -get '+name+'\n'+value in text
    build_bytes = (ROOT/'reference/build.json').read_bytes()
    assert sha(build_bytes) == m['buildManifestSHA256']
    for name, spec in json.loads(build_bytes)['files'].items():
        b = (ROOT/'game'/name).read_bytes()
        assert len(b) == spec['bytes'] and sha(b) == spec['sha256']
    exe = (ROOT/'game/DUCKTALE.EXE').read_bytes()
    code = objects['jungle-code.json']; load = code['load']
    assert not code['read']['aborted'] and code['read']['results'][0]['status'] == 'ok'
    live = base64.b64decode(code['read']['results'][0]['data'])
    expected = relocated_overlay(exe, 0x1fa00, load, 8, 24056, 436)
    assert live == expected
    for name, ip in [('jungle-entry.json', 0), ('jungle-first-input.json', 0x680), ('jungle-first-presentation.json', 0x49a)]:
        record = objects[name]; cpu = record['stop']['registers']
        assert cpu['cs'] == code['segment'] and cpu['eip'] == ip
        assert cpu['ds'] == cpu['ss'] == code['ds'] and not record['stop']['protected_mode']
        assert not record['state']['aborted'] and all(r['status'] == 'ok' for r in record['state']['results'])
    assert objects['jungle-first-input.json']['stop']['registers']['eax'] & 255 == 0
    # Recompute all admitted original flight FPU rewrites; no byte masks.
    flight = objects['safari-flight-code.json']; sites = verify_source(ROOT)
    expected_flight = relocated_overlay(exe, 0x12c00, load, 4, 17548, 248)
    for text in flight['runtimeFpuPatchedOffsets']:
        assert text in sites
        p = int(text, 16); interrupt = expected_flight[p+1]
        assert expected_flight[p] == 0xcd and (0x34 <= interrupt <= 0x3b or interrupt == 0x3d)
        struct.pack_into('<H', expected_flight, p, (struct.unpack_from('<H', expected_flight, p)[0]-(0xa23d if interrupt == 0x3d else 0x5c32)) & 65535)
        if interrupt != 0x3d:
            operand = struct.unpack_from('<H', expected_flight, p+1)[0]
            if not (((operand & 0x30fb) == 0x30d9 and expected_flight[p+2] < 0xf0) or (operand & 0xfeff) == 0xe2db or operand == 0xe0df): expected_flight[p] = 0x90
    assert base64.b64decode(flight['read']['results'][0]['data']) == expected_flight
    original = base64.b64decode(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame();process.stdout.write(Buffer.from(r.archives.get('IT.DRV')[1].data).toString('base64'));"], cwd=ROOT))
    driver = base64.b64decode(objects['jungle-driver.json']['read']['results'][0]['data'])
    for lo, hi in [(0x64, 0x72), (0xe5, 0x101), (0x35d, 0x515)]: assert driver[lo:hi] == original[lo:hi]
    observation = objects['jungle-cadence.json']; result = objects['jungle-observer-result.json']
    assert observation['completed'] and observation['injections'] == [] and not observation['partialRestore']
    assert observation['finalStopId'] == observation['initialStopId']+1
    assert objects['jungle-first-presentation.json']['stop']['stop_id'] == observation['initialStopId']
    assert objects['jungle-observer-final.json']['stop']['stop_id'] == observation['finalStopId']
    assert result['state'] == 'completed' and not result['output_truncated'] and result['output']['completed']
    inputs_ok(objects['jungle-observer-inputs.json'], objects['jungle-observer-replay.json'], m)
    for role, count in [('startup-inputs.json', 10), ('jungle-flight-setup-completed.json', 4)]:
        value = objects[role]; receipt = value['receipt'] if role == 'startup-inputs.json' else value
        assert not receipt['active'] and receipt['remaining'] == 0 and receipt['dispatched'] == count
    values = result['output']['samples']
    samples = sorted(values.values() if isinstance(values, dict) else values, key=lambda r: r['index'])
    samples_ok(samples, m)
    negatives = 0
    for kind in ['missing', 'frame', 'motion']:
        changed = copy.deepcopy(samples)
        if kind == 'missing': changed.pop()
        elif kind == 'frame': changed[20]['frame'] += 1
        else: changed[20]['x'] += 1
        try: samples_ok(changed, m)
        except AssertionError: negatives += 1
        else: raise AssertionError('Accepted jungle sample corruption '+kind)
    changed = copy.deepcopy(objects['jungle-observer-inputs.json']); changed['events'].pop()
    try: inputs_ok(changed, objects['jungle-observer-replay.json'], m)
    except AssertionError: negatives += 1
    else: raise AssertionError('Accepted missing release')
    wrong = bytearray(live); wrong[0] ^= 1
    assert wrong != expected; negatives += 1
    assert negatives == 5
    print('Original jungle:120 consecutive callback samples,119 frame intervals,123 driver counts;fixed Right/release consumed,full relocated flight/jungle identity,three EGA code ranges,closed owned session,5 negatives. Not port timing acceptance or exact flip counts.')


if __name__ == '__main__': verify()
