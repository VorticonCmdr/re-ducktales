"""Strict saved original observation;not port timing acceptance."""
if not __debug__:
    raise RuntimeError("SETUP: verification requires Python assertions;disable optimization")

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


def samples_ok(samples, m):
    assert len(samples) == m['expectedSamples'] == 120, 'Missing Safari sample'
    changes = []
    for i, row in enumerate(samples):
        assert row['index'] == i+1 and row['frame'] == samples[0]['frame']+i, 'Skipped Safari frame'
        assert [row['film'], row['column'], row['started']] == [12, 1, 0]
        assert row['page'] in [0, 1]
        if i:
            delta = row['counter']-samples[i-1]['counter']
            assert delta in [0, 1], 'Changed Safari counter'
            if delta: changes.append(row['index'])
    assert changes == m['counterChangeIndices'], 'Changed Safari counter boundary'
    assert len(changes) == m['expectedCounterTransitions'] == 18
    assert samples[-1]['frame']-samples[0]['frame'] == m['expectedFrameSpan'] == 119
    assert samples[-1]['clock']-samples[0]['clock'] == m['expectedClockSpan'] == 124
    assert samples[0]['counter'] == 0 and samples[-1]['counter'] == 18
    assert abs(119/70.086-124*16380/1193182) <= 16380/1193182


def verify():
    m = json.loads((ROOT/'reference/safari-native-cadence.json').read_text())
    assert m['kind'] == 'original-safari-cadence-observation'
    assert m['nativeObservation'] and m['portTimingAcceptance'] is False
    assert m['injections'] == [] and m['partialRestore'] is False
    objects = {}
    for role, spec in m['artifacts'].items():
        p = ROOT/spec['path']
        assert p.is_file(), 'SETUP: missing native Safari artifact '+str(p)
        b = p.read_bytes()
        assert len(b) == spec['bytes'] and hashlib.sha256(b).hexdigest() == spec['sha256'], 'Corrupt native Safari artifact '+role
        if role.endswith('.json'): objects[role] = json.loads(b)
    subprocess.run(['node', '--input-type=module', '-e',
        "import{validateProducerArchive}from'./scripts/lib/consumer-provenance.js';await validateProducerArchive(process.argv[1]);", m['producer']],cwd=ROOT,check=True)
    source = objects['source-revision.json']
    capture = objects['capture.json']
    assert capture['completed'] and capture['injections'] == [] and not capture['partialRestore']
    assert capture['scriptSha256'] == source['files']['scripts/capture-security.py']
    life = objects['lifecycle.json']
    assert life['terminal'] and life['returnCode'] == 0 and not life['homeOverridden'] and not life['sharedSessionChanged']
    assert life['ownedPID'] == capture['pid'] == objects['engine.json']['pid']
    assert capture['instanceId'] == objects['engine.json']['instance_id']
    tool = objects['profile-tool-identity.json']
    assert hashlib.sha256(Path(tool['executable']).read_bytes()).hexdigest() == tool['executableSha256'] == m['engineBinarySHA256']
    text = objects['configuration.json']['screen']['text']
    for name, value in [('cpu cpu_cycles','3000'),('cpu core','normal'),('dosbox memsize','16'),('dosbox vmem_delay','off'),('dosbox machine','svga_s3')]:
        # DOS text screen pads rows;strip each row before checking its reply.
        assert 'config -get '+name+'\n'+value in '\n'.join(x.rstrip() for x in text.splitlines())
    build = json.loads((ROOT/'reference/build.json').read_text())
    for name, identity in build['files'].items():
        b=(ROOT/'game'/name).read_bytes()
        assert len(b)==identity['bytes'] and hashlib.sha256(b).hexdigest()==identity['sha256']
    exe=(ROOT/'game/DUCKTALE.EXE').read_bytes()
    code=objects['safari-code.json'];load=code['load']
    assert not code['read']['aborted'] and code['read']['results'][0]['status']=='ok'
    assert base64.b64decode(code['read']['results'][0]['data'])==relocated_overlay(exe,0x1d800,load,7,7924,93)
    first=objects['safari-first-input.json'];cpu=first['stop']['registers']
    assert cpu['cs']==code['segment'] and cpu['eip']==0x7d7 and cpu['eax']&255==0
    assert cpu['ds']==cpu['ss']==code['ds'] and not first['stop']['protected_mode']
    data=base64.b64decode(first['state']['results'][1]['data']);bp=cpu['ebp']&65535
    assert len(data)==65536 and data[0x3c1]==1 and data[0x5d2a]==12 and struct.unpack_from('<H',data,bp-0x58)[0]==0
    # Four inline copy words are derived from source descriptors,not ignored.
    driver=base64.b64decode(objects['safari-driver-observed.json']['read']['results'][0]['data'])
    original=base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',
        "import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame();process.stdout.write(Buffer.from(r.archives.get('IT.DRV')[1].data).toString('base64'));"],cwd=ROOT))
    expected=bytearray(original);video=struct.unpack_from('<H',data,0x2038)[0];ram=struct.unpack_from('<H',data,0x203a)[0]
    assert [struct.unpack_from('<H',data,p)[0] for p in [video,ram]]==[40,40]
    assert [struct.unpack_from('<H',data,p+8)[0] for p in [video,ram]]==[8000,8000]
    for p,value in [(0x32d,0),(0x331,0),(0x341,8000),(0x34b,8000)]:
        assert struct.unpack_from('<H',original,p)[0]==1234
        struct.pack_into('<H',expected,p,value)
    assert driver[0x38:]==expected[0x38:]
    sites=verify_source(ROOT);flight=objects['safari-flight-code.json']
    expected_flight=relocated_overlay(exe,0x12c00,load,4,17548,248)
    live=base64.b64decode(flight['read']['results'][0]['data'])
    for text in flight['runtimeFpuPatchedOffsets']:
        assert text in sites
        p=int(text,16);interrupt=expected_flight[p+1]
        assert expected_flight[p]==0xcd and (0x34<=interrupt<=0x3b or interrupt==0x3d)
        struct.pack_into('<H',expected_flight,p,(struct.unpack_from('<H',expected_flight,p)[0]-(0xa23d if interrupt==0x3d else 0x5c32))&65535)
        if interrupt!=0x3d:
            operand=struct.unpack_from('<H',expected_flight,p+1)[0]
            if not (((operand&0x30fb)==0x30d9 and expected_flight[p+2]<0xf0) or (operand&0xfeff)==0xe2db or operand==0xe0df):expected_flight[p]=0x90
    assert live==expected_flight
    observation=objects['safari-cadence.json'];result=objects['safari-observer-result.json']
    assert observation['completed'] and observation['injections']==[] and not observation['partialRestore']
    assert observation['finalStopId']==observation['initialStopId']+1
    assert first['stop']['stop_id']==observation['initialStopId']
    assert objects['safari-observer-final.json']['stop']['stop_id']==observation['finalStopId']
    assert result['state']=='completed' and not result['output_truncated'] and result['output']['completed']
    assert objects['safari-observer-inputs.json']['events']==[]
    startup=objects['startup-inputs.json'];assert len(startup['events'])==startup['receipt']['dispatched']==10 and startup['receipt']['remaining']==0 and not startup['receipt']['active']
    schedules=objects['inputs.json'];assert len(schedules)>0
    for schedule in schedules:assert len(schedule['events'])==schedule['scheduled']['events_scheduled']>0
    values=result['output']['samples'];samples=sorted(values.values() if isinstance(values,dict) else values,key=lambda v:v['index'])
    samples_ok(samples,m)
    negatives=0
    for kind in ['missing','counter','frame']:
        changed=copy.deepcopy(samples)
        if kind=='missing':changed.pop()
        elif kind=='counter':changed[20]['counter']+=1
        else:changed[20]['frame']+=1
        try:samples_ok(changed,m)
        except AssertionError:negatives+=1
        else:raise AssertionError('Accepted native observation corruption '+kind)
    wrong=bytearray(driver);wrong[0x32d]^=1
    assert wrong[0x38:]!=expected[0x38:];negatives+=1
    assert negatives==4
    print('Original Safari:120 consecutive callback samples,119 frame intervals,124 driver counts,18 source loop completions;exact code/self-modification identities,closed owned session,4 observation negatives. No port timing acceptance or exact scanout/CPU checkpoints.')


if __name__=='__main__':verify()
