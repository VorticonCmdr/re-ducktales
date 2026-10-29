"""One fresh original first-map security scenario, with fixed player inputs.
Uses the installed bridge client/lifecycle on an isolated, preflighted port.
Never changes global bridge config, protected operator settings or guest memory.
"""
import argparse
import base64
from dataclasses import replace
import hashlib
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--port', type=int, default=8387)
parser.add_argument('--map-inputs', action='store_true', help='Continue through security into the authored natural map-keyboard scenario')
parser.add_argument('--navigation', action='store_true', help='Fixed Right/Left after the first warning, returning to row0')
args = parser.parse_args()
out = (ROOT / args.output).resolve()
assert out.is_relative_to(ROOT / '.local'), 'Captures must stay in ignored local storage'
out.mkdir(parents=True, exist_ok=False)
bridge = Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']).resolve()
sys.path.insert(0, str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.lifecycle import InstanceManager
from dosbox_mcp.client import DosboxClient

sha = lambda b: hashlib.sha256(b).hexdigest()
def save(name, value):
    (out / (name + '.json')).write_text(json.dumps(value, indent=2)+'\n')

build = json.loads((ROOT / 'reference/build.json').read_text())
for name, identity in build['files'].items():
    data = (ROOT / 'game' / name).read_bytes()
    assert len(data) == identity['bytes'] and sha(data) == identity['sha256'], name
source = (ROOT / '.local/analysis/OVERLAY_02.EXE').read_bytes()
header = struct.unpack_from('<14H', source)
assert header[13] == 2 and header[3] == 180
body = source[header[4]*16:]
assert len(body) == 8368
cfg = replace(Config.load(), port=args.port, base_url=f'http://127.0.0.1:{args.port}', headless=True, mute=True)
assert args.port != 8386, 'Never attach this recipe to the unrelated live endpoint'
with socket.socket() as check:
    check.bind(('127.0.0.1', args.port))
clients = []
def attach(url, token):
    assert url == cfg.base_url
    client = DosboxClient(url, token)
    clients.append(client)
    info = client.get('/api/v1/dosbox/info')
    assert info['pid'] == manager.pid, 'Refusing different process identity'
    return info
manager = InstanceManager(cfg, attach=attach)
owned = set()
owned_segments = {}
inputs = []

def wait_until(read, predicate, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = read()
        if predicate(value):
            return value
        time.sleep(0.02)
    raise AssertionError('Unfinished original scenario wait')

def sequence(events):
    result = client.post('/api/v1/input/sequence', json={'events': events})
    inputs.append({'events': events, 'scheduled': result})
    return result

def keys(*events):
    sequence([{'type': 'key', 'key': key, 'pressed': pressed, 't': 0} for key, pressed in events])

def add(ip, segment=None):
    segment = overlay if segment is None else segment
    bp = client.post('/api/v1/debug/breakpoints', json={'type': 'execute', 'segment': segment, 'offset': ip})
    owned.add(bp['id'])
    owned_segments[bp['id']] = segment
    return bp['id']

def remove(bp):
    client.delete('/api/v1/debug/breakpoints', json={'id': bp})
    owned.remove(bp)
    del owned_segments[bp]

def resume(stop_id):
    resumed = client.post('/api/v1/debug/continue')
    assert resumed['resumed_from_stop_id'] == stop_id
    stop = client.get('/api/v1/debug/wait', params={'since_stop_id': stop_id, 'timeout_ms': 15000}, timeout=20)
    assert stop['satisfied'] and stop['stop_id'] > stop_id
    assert stop['breakpoint']['id'] in owned
    assert stop['registers']['cs'] == owned_segments[stop['breakpoint']['id']] and not stop['protected_mode']
    return stop

def state(name, stop, picture=True):
    info_now = client.get('/api/v1/dosbox/info')
    assert info_now['pid'] == manager.pid and info_now['instance_id'] == info['instance_id']
    batch = client.post('/api/v1/batch', json={'ops': [{'op': 'cpu_read'}, {'op': 'mem_read', 'segment': ds, 'offset': 0, 'len': 65536}]})
    assert not batch['aborted'] and len(batch['results']) == 2
    assert all(r['status'] == 'ok' for r in batch['results'])
    save(name, {'stop': stop, 'state': batch})
    if picture:
        (out / (name + '.png')).write_bytes(client.get('/api/v1/video/frame', params={'format': 'png', 'mode': 'raw'}))
    return base64.b64decode(batch['results'][1]['data'])

try:
    info = manager.start()
    client = clients[-1]
    save('engine', info)
    client.post('/api/v1/drive/mount', json={'drive': 'C', 'path': str((ROOT/'game').resolve()), 'readonly': True})
    commands = 'config -get cpu cpu_cycles\nconfig -get cpu core\nconfig -get dosbox memsize\nconfig -get dosbox machine\n'
    client.post('/api/v1/input/type', json={'text': commands, 'cps': 200})
    config_screen = wait_until(lambda: client.get('/api/v1/video/text'), lambda v: 'svga_s3' in json.dumps(v))
    save('configuration', {'commands': commands, 'screen': config_screen, 'argv': manager.build_argv()})
    client.post('/api/v1/input/type', json={'text': 'c:\nducktale\n', 'cps': 100})
    wait_until(lambda: client.get('/api/v1/status'), lambda v: v.get('program') == 'DUCKTALE')
    startup = []
    for key, at in [('KBD_n',1500),('KBD_space',5000),('KBD_space',6500),('KBD_space',8000),('KBD_enter',9500)]:
        startup += [{'type':'key','key':key,'pressed':True,'t':at},{'type':'key','key':key,'pressed':False,'t':at+150}]
    sequence(startup)
    replay = wait_until(lambda: client.get('/api/v1/input/replay/status'), lambda v: not v['active'])
    assert replay['dispatched'] == 10 and replay['remaining'] == 0
    save('startup-inputs', {'events': startup, 'receipt': replay})
    paused = client.post('/api/v1/debug/pause')['stop']
    scan = client.post('/api/v1/memory/scan', json={'start':0x3000,'end':0x50000,'pattern':'55 8b ec b8 0a 00 9a 9e 1e ?? ?? c7 46 fc 00 00','limit':4})
    assert scan['total'] == 1 and len(scan['matches']) == 1
    base = scan['matches'][0] - 0x2e4
    assert base % 16 == 0
    overlay = base // 16
    raw = client.post('/api/v1/batch', json={'ops':[{'op':'mem_read','segment':overlay,'offset':0,'len':8368}]})
    live = base64.b64decode(raw['results'][0]['data'])
    load = struct.unpack_from('<H',live,8)[0] - 0x040e
    relocated = bytearray(body)
    for i in range(header[3]):
        offset, segment = struct.unpack_from('<HH',source,header[12]+4*i)
        at = offset+16*segment-0xc170
        assert 0 <= at < len(relocated)-1
        struct.pack_into('<H',relocated,at,(struct.unpack_from('<H',relocated,at)[0]+load)&65535)
    assert live == relocated, 'Original overlay mismatch'
    ds = load + 0x120e
    save('live-overlay', {'mapping':{'load':load,'ds':ds,'overlay':overlay},'read':raw})
    office_bp = add(0x3c7)
    stop = resume(paused['stop_id'])
    assert stop['registers']['ds'] == ds and stop['registers']['ss'] == ds
    state('office-input',stop)
    keys(('KBD_right',True),('KBD_space',True))
    stop = resume(stop['stop_id'])
    assert stop['registers']['eax'] & 255 == 195
    state('office-confirm',stop,False)
    remove(office_bp)
    entry_bp = add(0x7ad)
    stop = resume(stop['stop_id'])
    initial = state('entry',stop)
    keys(('KBD_right',False),('KBD_space',False))
    remove(entry_bp)
    rng_bps = {add(ip): ip for ip in [0x8e7,0x8fd,0x9a5]}
    finish_bp = add(0xa42)
    draws = []
    while True:
        stop = resume(stop['stop_id'])
        if stop['breakpoint']['id'] == finish_bp:
            break
        assert len(draws) < 512
        batch = client.post('/api/v1/batch',json={'ops':[{'op':'mem_read','segment':ds,'offset':0x2229,'len':2},{'op':'mem_read','segment':ds,'offset':stop['registers']['ebp']-30,'len':30}]})
        assert not batch['aborted'] and all(r['status']=='ok' for r in batch['results'])
        draws.append({'stop':stop,'state':batch})
    save('rng-consumption', draws)
    assert len(draws) >= 41
    generated = state('generated',stop,False)
    for bp in [*rng_bps,finish_bp]: remove(bp)
    input_bp = add(0xac4)
    for i in range(4):
        stop = resume(stop['stop_id'])
        assert stop['registers']['eax'] == 0
        state(f'initial-poll-{i}',stop)
    # Security19a5 flushes immediately after each read. Press at the next
    # pre-read boundary, not after an earlier read that would discard the key.
    remove(input_bp)
    before_bp = add(0xabf)
    stop = resume(stop['stop_id'])
    assert stop['breakpoint']['id'] == before_bp
    keys(('KBD_space',True))
    input_bp = add(0xac4)
    remove(before_bp)
    stop = resume(stop['stop_id'])
    state('fire-first',stop,False)
    assert stop['registers']['eax'] & 255 == 192
    keys(('KBD_space',False))
    remove(input_bp)
    warning_bp = add(0xb94)
    cleanup_bp = add(0xc70)
    stop = resume(stop['stop_id'])
    warned = stop['breakpoint']['id'] == warning_bp
    state('first-result',stop)
    remove(warning_bp)
    if warned:
        input_bp = add(0xac4)
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == input_bp and stop['registers']['eax'] == 0
        state('warning-poll',stop)
        remove(input_bp)
        if args.navigation:
            for key, byte, name in [('KBD_right',3,'navigation-right'),('KBD_left',7,'navigation-left')]:
                before_bp = add(0xb97)
                stop = resume(stop['stop_id'])
                assert stop['breakpoint']['id'] == before_bp
                keys((key,True))
                input_bp = add(0xac4)
                remove(before_bp)
                stop = resume(stop['stop_id'])
                state(name+'-input',stop,False)
                assert stop['registers']['eax'] & 255 == byte, f'{name} consumed {stop["registers"]["eax"] & 255}, expected {byte}'
                keys((key,False))
                remove(input_bp)
                moved_bp = add(0xb28)
                stop = resume(stop['stop_id'])
                assert stop['breakpoint']['id'] == moved_bp
                state(name,stop)
                remove(moved_bp)
        before_bp = add(0xb97 if args.navigation else 0xabf)
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == before_bp
        keys(('KBD_space',True))
        input_bp = add(0xac4)
        remove(before_bp)
        stop = resume(stop['stop_id'])
        state('fire-second',stop,False)
        assert stop['registers']['eax'] & 255 == 192
        keys(('KBD_space',False))
        remove(input_bp)
        red_bp, blank_bp = add(0xc24),add(0xc5e)
        for i in range(6):
            stop = resume(stop['stop_id'])
            assert stop['breakpoint']['id'] == (red_bp if i % 2 == 0 else blank_bp)
            state(f'alarm-{i}',stop)
        remove(red_bp); remove(blank_bp)
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == cleanup_bp
        state('cleanup',stop)
    remove(cleanup_bp)
    return_bp = add(0xca5)
    stop = resume(stop['stop_id'])
    assert stop['registers']['eax'] == 1
    final = state('return',stop)
    remove(return_bp)
    if args.map_inputs:
        profile_path = ROOT / 'reference/map-keyboard-inputs.json'
        profile = json.loads(profile_path.read_text())
        assert profile['expectedReads'] == 36 and len(profile['events']) == 10
        by_read = {e['beforeRead']: e for e in profile['events']}
        assert len(by_read) == 10 and all(0 <= i < 36 for i in by_read)
        code = "import{readFile}from'node:fs/promises';import{unpackImage}from'./src/game/executable.js';process.stdout.write(Buffer.from(unpackImage(await readFile('game/DUCKTALE.EXE'))).toString('base64'));"
        main = bytearray(base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT)))
        assert len(main) == 87664
        exe = (ROOT/'game/DUCKTALE.EXE').read_bytes()
        eh = struct.unpack_from('<14H',exe)
        cursor = eh[4]*16+eh[11]*16+0x125
        for region in range(16):
            count = struct.unpack_from('<H',exe,cursor)[0];cursor += 2
            for i in range(count):
                at = struct.unpack_from('<H',exe,cursor)[0]+region*65536;cursor += 2
                struct.pack_into('<H',main,at,(struct.unpack_from('<H',main,at)[0]+load)&65535)
        ranges=[('reader',load+0x124,2,0x1242,876),
                ('scanner',load+0x40e,0x19c5,0x5aa5,114),
                ('irq',load+0x40e,0x1aa9,0x5b89,173),
                ('clock',load+0x40e,0xdc4,0x4ea4,8),
                ('deadline',load,0x9ab8,0x9ab8,49)]
        reads=client.post('/api/v1/batch',json={'ops':[{'op':'mem_read','segment':segment,'offset':offset,'len':length}for _,segment,offset,_,length in ranges]})
        assert not reads['aborted'] and all(r['status']=='ok'for r in reads['results'])
        for (name,_,_,at,length),r in zip(ranges,reads['results'],strict=True):
            assert base64.b64decode(r['data']) == main[at:at+length],f'Resident map code mismatch {name}'
        save('map-resident-mapping',{'load':load,'ds':ds,'ranges':[{'name':name,'segment':segment,'offset':offset,'imageOffset':at,'length':length}for name,segment,offset,at,length in ranges],'read':reads})
        map_cs = overlay + 0xca
        entry_bp = add(0x1228, map_cs)
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == entry_bp
        live_map = client.post('/api/v1/batch', json={'ops':[{'op':'mem_read','segment':overlay,'offset':0,'len':8368}]})
        assert not live_map['aborted'] and live_map['results'][0]['status'] == 'ok'
        assert base64.b64decode(live_map['results'][0]['data']) == relocated
        save('map-live-overlay', {'segment':overlay,'entrySegment':map_cs,'entryStop':stop,'read':live_map})
        start_map = state('map-entry',stop)
        # At the far-call entry,SS:SP+4/+6 contain the caller's cursor pointers.
        sp = stop['registers']['esp'] & 65535
        x_ptr,y_ptr = struct.unpack_from('<HH',start_map,sp+4)
        assert x_ptr < 65535 and y_ptr < 65535
        remove(entry_bp)
        before_bp,input_bp,end_bp = add(0x1238,map_cs),add(0x123d,map_cs),add(0x140e,map_cs)
        map_records=[]
        for index in range(36):
            row={'index':index}
            for stage,bp in [('before',before_bp),('input',input_bp),('end',end_bp)]:
                stop=resume(stop['stop_id'])
                assert stop['breakpoint']['id'] == bp
                name=f'map-{index:03d}-{stage}'
                data=state(name,stop,False)
                row[stage]={'artifact':name+'.json','stopId':stop['stop_id'],
                            'clock':struct.unpack_from('<I',data,0x2225)[0],
                            'deadline':struct.unpack_from('<I',data,0x27f8)[0],
                            'period':struct.unpack_from('<I',data,0x27fc)[0],
                            'readerMode':data[0x3c1],
                            'ax':stop['registers']['eax'] & 65535,
                            'x':struct.unpack_from('<h',data,x_ptr)[0],
                            'y':struct.unpack_from('<h',data,y_ptr)[0]}
                if stage=='before' and index in by_read:
                    raw_codes={'KBD_right':0x4d,'KBD_k':0x25,'KBD_left':0x4b,
                               'KBD_kp3':0x51,'KBD_m':0x32,'KBD_up':0x48}
                    for event in by_read[index]['keys']:
                        expected=128 if event['pressed'] else 0
                        assert data[0x276c+raw_codes[event['key']]]==expected, f'Authored key not settled before map read{index}: {event}'
                if stage=='end' and index+1 in by_read:
                    event=by_read[index+1]
                    row['scheduledForRead']=index+1
                    row['scheduledInputRecord']=len(inputs)
                    # Queue after the previous pointer's flush. The original
                    # six-count caller wait delivers all hardware scan bytes
                    # before the following reader,including extended arrows.
                    keys(*[(e['key'],e['pressed'])for e in event['keys']])
            map_records.append(row)
        for bp in [before_bp,input_bp,end_bp]:remove(bp)
        replay=client.get('/api/v1/input/replay/status')
        assert not replay['active'] and replay['remaining']==0
        assert data[0x276c:0x27ec] == bytes(128)
        save('map-consumption',map_records)
        save('map-capture',{'completed':True,'inputReads':36,'authoredSequences':10,
                           'profile':str(profile_path.relative_to(ROOT)),
                           'profileSha256':sha(profile_path.read_bytes()),
                           'xPointer':x_ptr,'yPointer':y_ptr,'segment':map_cs,
                           'injections':[],'partialRestore':False,'replay':replay,
                           'scope':'Natural map input/IRQ-table/flush/clock observations after conditional fresh-launch security setup. Not browser or full native timing parity.'})
    assert not owned
    save('inputs',inputs)
    save('capture',{'completed':True,'pid':manager.pid,'instanceId':info['instance_id'],'port':args.port,'initialSeed':struct.unpack_from('<H',initial,0x2229)[0],'finalSeed':struct.unpack_from('<H',final,0x2229)[0],'rngCalls':len(draws),'wrongFirst':warned,'navigation':args.navigation and warned,'requiredInputPolls':4+(3+(2 if args.navigation else 0) if warned else 1),'injections':[],'partialRestore':False,'scriptSha256':sha(Path(__file__).read_bytes())})
    print(json.dumps({'completed':True,'pid':manager.pid,'rngCalls':len(draws),'wrongFirst':warned,'output':str(out)}),flush=True)
finally:
    if manager.running:
        manager.stop()
    for client in clients:
        client.close()
