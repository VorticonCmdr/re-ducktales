"""Exact natural treasure phase/RNG observation,not timing/pixel acceptance."""
if not __debug__:
    raise RuntimeError('SETUP: verification requires assertions')
import base64
import copy
import hashlib
import json
import struct
import subprocess
from pathlib import Path
from capture_safari_cadence import relocated_overlay

ROOT = Path(__file__).resolve().parents[1]


def read_artifact(a):
    p = ROOT/a['path']
    assert p.is_file(), 'SETUP: missing treasure artifact '+str(p)
    b = p.read_bytes()
    assert len(b) == a['bytes'] and hashlib.sha256(b).hexdigest() == a['sha256'], 'Corrupt treasure artifact '+str(p)
    return json.loads(b) if p.suffix == '.json' else b


def memory(value, ip, segment):
    stop = value['stop']
    assert not stop['protected_mode'] and stop['registers']['cs'] == segment and stop['registers']['eip'] == ip
    state = value['state']
    assert not state['aborted'] and len(state['results']) == 2
    assert all(r['status'] == 'ok' for r in state['results'])
    b = base64.b64decode(state['results'][1]['data'])
    assert len(b) == 65536
    return b


def check_route(value, objects, segment):
    assert value['completed'] and value['injections'] == [] and not value['partialRestore']
    reads, moves = value['reads'], value['schedules']
    assert len(reads) == 14 and len(moves) == 7, 'Unfinished treasure inputs'
    keys = {'KBD_up': (0xc1,-8), 'KBD_right': (0xc3,1), 'KBD_down': (0xc5,8), 'KBD_left': (0xc7,-1)}
    for n, read in enumerate(reads):
        b = memory(objects['treasure-route-read-'+str(n)+'.json'], 0x9a6, segment)
        assert read['index'] == n and read['room'] == struct.unpack_from('<H', b, 0x4d32)[0]
        stop = objects['treasure-route-read-'+str(n)+'.json']['stop']
        assert read['stopId'] == stop['stop_id'] and read['code'] == stop['registers']['eax'] & 255
    for n, move in enumerate(moves):
        assert move['afterRead'] == 2*n and reads[2*n]['code'] == 0
        code, delta = keys[move['key']]
        assert reads[2*n+1]['code'] == code, 'Hardware/reader divergence'
        assert reads[2*n]['room'] == reads[2*n+1]['room'] == move['from']
        assert move['target'] == move['from']+delta
        assert move['goal'] == 19
        if n+1 < len(moves): assert reads[2*n+2]['room'] == move['target']
        events = [{'type': 'key', 'key': k, 'pressed': pressed, 'frame': frame}
                  for frame, pressed in [(0, True), (10, False)] for k in [move['key'], 'KBD_space']]
        assert move['events'] == events, 'Missing physical treasure input'
        assert move['scheduled']['events_scheduled'] == 4
        done = move['completed']
        assert not done['active'] and done['remaining'] == 0 and done['dispatched'] == 4
    assert moves[0]['from'] == 45 and moves[-1]['target'] == 19


def check_phases(value, objects, segment):
    entry = memory(objects['treasure-entry.json'], 0x16b4, segment)
    assert entry[0x546a] == 0
    assert struct.unpack_from('<H', entry, 0x4d32)[0] == struct.unpack_from('<H', entry, 0x97b0)[0] == 19
    seed = struct.unpack_from('<H', entry, 0x2229)[0]
    # Port RNG implementation carries its own16-bit state from the incoming
    # native seed. No expected ending state determines an input or draw count.
    seeds = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{nextRandom}from'./src/game/integer.js';let s=Number(process.argv[1]);const a=[s];for(let i=0;i<15;i++)a.push(s=nextRandom(s));console.log(JSON.stringify(a));", str(seed)], cwd=ROOT))
    plan = [('before-wipe',0x16fb,0,1),('after-background',0x170b,0,1),
            ('before-first-reveal',0x173d,1,1),('before-second-flip',0x1770,2,1),
            ('celebration-loop',0x17de,5,2),('treasure-end',0x1827,15,2)]
    assert len(value['checkpoints']) == len(plan) == 6
    for record,(label,ip,draws,flag) in zip(value['checkpoints'],plan):
        assert record['label'] == label and record['ip'] == ip
        snap = objects['treasure-'+label+'.json']
        b = memory(snap, ip, segment)
        assert record['stopId'] == snap['stop']['stop_id']
        assert record['seed'] == struct.unpack_from('<H', b, 0x2229)[0] == seeds[draws], 'Treasure RNG divergence'
        assert record['flag'] == b[0x546a] == flag, 'Treasure phase divergence'


def verify():
    m = json.loads((ROOT/'reference/cave-treasure-observation.json').read_text())
    assert m['kind'] == 'original-cave-treasure-observation'
    assert m['expectedReaderCalls'] == 14 and m['expectedMoves'] == 7 and m['expectedCheckpointCount'] == 6 and m['expectedPartyCalls'] == 15
    assert m['injections'] == m['fittedInputs'] == [] and not m['partialRestore']
    assert not m['nativeElapsedTimeAcceptance'] and not m['pixelAcceptance']
    build = read_artifact(m['build'])
    assert len(build['files']) == 22
    for name,identity in build['files'].items():
        b = (ROOT/'game'/name).read_bytes()
        assert len(b) == identity['bytes'] and hashlib.sha256(b).hexdigest() == identity['sha256'], 'Changed original '+name
    read_artifact(m['source']); read_artifact(m['configuration'])
    from verify_cave_treasure_source import verify as verify_source
    verify_source()
    assert len(m['artifacts']) == m['expectedArtifactCount'] > 100
    objects = {n:read_artifact(a) for n,a in m['artifacts'].items()}
    subprocess.run(['node','--input-type=module','-e',"import{validateProducerArchive}from'./scripts/lib/consumer-provenance.js';await validateProducerArchive(process.argv[1]);",m['producer']],cwd=ROOT,check=True)
    capture,life = objects['capture.json'],objects['lifecycle.json']
    assert capture['completed'] and capture['injections'] == [] and not capture['partialRestore']
    assert life['terminal'] and life['returnCode'] == 0 and not life['homeOverridden'] and not life['sharedSessionChanged']
    tool = objects['profile-tool-identity.json']
    assert hashlib.sha256(Path(tool['executable']).read_bytes()).hexdigest() == tool['executableSha256'] == '85662a8383e0fde0734797451374b28a443166440fd9bf5823626505760d9d0f'
    code = objects['cave-code.json']; segment = code['segment']
    expected = relocated_overlay((ROOT/'game/DUCKTALE.EXE').read_bytes(),0x1a800,code['load'],6,11054,196)
    assert not code['read']['aborted'] and code['read']['results'][0]['status'] == 'ok'
    assert base64.b64decode(code['read']['results'][0]['data']) == expected
    value = objects['treasure-route.json']
    check_route(value,objects,segment); check_phases(value,objects,segment)
    for mode in ['missing-event','changed-seed','missing-checkpoint']:
        wrong = copy.deepcopy(value)
        if mode == 'missing-event': wrong['schedules'][0]['events'].pop()
        elif mode == 'changed-seed': wrong['checkpoints'][-1]['seed'] ^= 1
        else: wrong['checkpoints'].pop()
        try:
            check_route(wrong,objects,segment);check_phases(wrong,objects,segment)
        except AssertionError:
            pass
        else: raise AssertionError('Accepted '+mode)
    print('Original treasure:7 natural room moves/28 consumed physical events,14 reader calls,6 phase/RNG checkpoints at0/0/1/2/5/15 party draws;full11054-byte cave identity,closed owned session,3 negatives. No elapsed-time or pixel acceptance.')


if __name__ == '__main__': verify()
