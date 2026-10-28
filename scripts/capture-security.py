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
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--port', type=int, default=8387)
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

def add(ip):
    bp = client.post('/api/v1/debug/breakpoints', json={'type': 'execute', 'segment': overlay, 'offset': ip})
    owned.add(bp['id'])
    return bp['id']

def remove(bp):
    client.delete('/api/v1/debug/breakpoints', json={'id': bp})
    owned.remove(bp)

def resume(stop_id):
    resumed = client.post('/api/v1/debug/continue')
    assert resumed['resumed_from_stop_id'] == stop_id
    stop = client.get('/api/v1/debug/wait', params={'since_stop_id': stop_id, 'timeout_ms': 15000}, timeout=20)
    assert stop['satisfied'] and stop['stop_id'] > stop_id
    assert stop['breakpoint']['id'] in owned
    assert stop['registers']['cs'] == overlay and not stop['protected_mode']
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
        before_bp = add(0xabf)
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
    assert not owned
    save('inputs',inputs)
    save('capture',{'completed':True,'pid':manager.pid,'instanceId':info['instance_id'],'port':args.port,'initialSeed':struct.unpack_from('<H',initial,0x2229)[0],'finalSeed':struct.unpack_from('<H',final,0x2229)[0],'rngCalls':len(draws),'wrongFirst':warned,'requiredInputPolls':4+(3 if warned else 1),'injections':[],'partialRestore':False,'scriptSha256':sha(Path(__file__).read_bytes())})
    print(json.dumps({'completed':True,'pid':manager.pid,'rngCalls':len(draws),'wrongFirst':warned,'output':str(out)}),flush=True)
finally:
    if manager.running:
        manager.stop()
    for client in clients:
        client.close()
