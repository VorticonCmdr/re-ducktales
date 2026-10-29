"""One fresh original office entry/reveal and fixed keyboard selection scenario.
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

def add(ip, segment=None, condition=None):
    request = {'type':'execute','segment':overlay if segment is None else segment,'offset':ip}
    if condition is not None: request['condition'] = condition
    bp = client.post('/api/v1/debug/breakpoints', json=request)
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
    assert not stop['protected_mode']
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
    # Anchor before the first overlay3 dispatch, rather than guessing where
    # a not-yet-loaded office will be allocated.
    code = "import{readFile}from'node:fs/promises';import{unpackImage}from'./src/game/executable.js';process.stdout.write(Buffer.from(unpackImage(await readFile('game/DUCKTALE.EXE'))).toString('base64'));"
    main = base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT))
    assert len(main) == 87664
    assert main[0x133:0x144].hex() == '803e0e4e1e7f49cd3f03e4028846e2eb43'
    def memory(segment, offset, length):
        batch = client.post('/api/v1/batch', json={'ops':[{'op':'mem_read','segment':segment,'offset':offset,'len':length}]})
        assert not batch['aborted'] and len(batch['results']) == 1 and batch['results'][0]['status'] == 'ok'
        return base64.b64decode(batch['results'][0]['data'])
    def anchor():
        scan = client.post('/api/v1/memory/scan', json={'start':0x3000,'end':0x50000,'pattern':'a1 29 22 05 48 92 d1 c8 d1 c8 d1 c8 a3 29 22 cb','limit':8})
        found = []
        for physical in scan['matches']:
            if (physical-0xeb8) % 16: continue
            load_at = (physical-0xeb8)//16-0x40e
            if 0 <= load_at < 65536 and memory(load_at,0x133,17) == main[0x133:0x144]: found.append(load_at)
        assert len(found) <= 1
        return found[0] if found else None
    load = wait_until(anchor,lambda v:v is not None)
    ds = load+0x120e
    paused = client.post('/api/v1/debug/pause')['stop']
    assert not paused['protected_mode']
    exe = (ROOT/'game/DUCKTALE.EXE').read_bytes()
    eh = struct.unpack_from('<14H',exe)
    cursor = eh[4]*16+eh[11]*16+0x125
    relocated_main = bytearray(main)
    for region in range(16):
        count = struct.unpack_from('<H',exe,cursor)[0]; cursor += 2
        for i in range(count):
            at = struct.unpack_from('<H',exe,cursor)[0]+region*0x10000; cursor += 2
            struct.pack_into('<H',relocated_main,at,(struct.unpack_from('<H',relocated_main,at)[0]+load)&65535)
    helper = load+0x40e
    for segment,offset,expected in [(load,0x133,relocated_main[0x133:0x144]),(helper,0x1e9e,relocated_main[0x5f7e:0x5f8e])]:
        assert memory(segment,offset,len(expected)) == expected, 'Resident byte mapping mismatch'
    save('resident-mapping',{'load':load,'helper':helper,'ds':ds,'dispatchBytes':memory(load,0x133,17).hex(),'stackHelperBytes':memory(helper,0x1e9e,16).hex()})
    main_bp = add(0x13a,load)
    startup = []
    for key, at in [('KBD_n',1500),('KBD_space',5000),('KBD_space',6500),('KBD_space',8000),('KBD_enter',9500)]:
        startup += [{'type':'key','key':key,'pressed':True,'t':at},{'type':'key','key':key,'pressed':False,'t':at+150}]
    sequence(startup)
    stop = resume(paused['stop_id'])
    assert stop['breakpoint']['id'] == main_bp and stop['registers']['cs'] == load
    # Setup is conditional on the verified source call boundary. A timed
    # sequence stops advancing while paused; cancel its now-unneeded tail.
    # Required office scenario inputs start only after this setup boundary.
    prefix = client.get('/api/v1/input/replay/status')
    cancelled = client.delete('/api/v1/input/replay')
    after_cancel = client.get('/api/v1/input/replay/status')
    assert not after_cancel['active'] and after_cancel['remaining'] == 0
    save('startup-inputs',{'plannedSetupEvents':startup,'dispatchedPrefix':prefix,'cancelledSetupTail':cancelled,'afterCancel':after_cancel,'stopBeforeOfficeDispatch':stop,'scope':'Conditional setup ends at the original office-call boundary. Cancelled setup tail is explicit, not part of the required office experiment.'})
    keys(('KBD_n',False),('KBD_space',False),('KBD_enter',False))
    remove(main_bp)
    helper_bp = add(0x1e9e,helper,{'register':'ax','op':'eq','value':10})
    for attempt in range(32):
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == helper_bp
        regs = stop['registers']
        stack = memory(regs['ss'],regs['esp'] & 65535,4)
        return_ip,return_cs = struct.unpack('<HH',stack)
        if return_ip == 0x2ef:
            overlay = return_cs
            raw = client.post('/api/v1/batch',json={'ops':[{'op':'mem_read','segment':overlay,'offset':0,'len':8368}]})
            live = base64.b64decode(raw['results'][0]['data'])
            relocated = bytearray(body)
            for i in range(header[3]):
                offset,segment = struct.unpack_from('<HH',source,header[12]+4*i)
                at = offset+16*segment-0xc170
                assert 0 <= at < len(relocated)-1
                struct.pack_into('<H',relocated,at,(struct.unpack_from('<H',relocated,at)[0]+load)&65535)
            assert live == relocated, 'Loaded office bytes mismatch'
            assert regs['ss'] == ds
            save('live-overlay',{'mapping':{'load':load,'ds':ds,'overlay':overlay},'read':raw,'entryStack':stack.hex(),'entryStop':stop})
            break
    else: raise AssertionError('Office entry stack anchor not reached')
    remove(helper_bp)
    initial = state('entry-before',stop)
    table = memory(ds,0x1fd4,16)
    pointers = [struct.unpack_from('<HH',table,i*4) for i in range(4)]
    assert [v[0] for v in pointers] == [0xe5,0x1b0,0x101,0x155]
    assert len({v[1] for v in pointers}) == 1
    ega = pointers[0][1]
    driver_script = "import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'))[1].data).toString('base64'));"
    driver = base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',driver_script],cwd=ROOT))
    assert memory(ega,0x64,0x14c) == driver[0x64:0x1b0]
    save('driver-mapping',{'segment':ega,'table':base64.b64encode(table).decode(),'codeStart':0x64,'code':base64.b64encode(memory(ega,0x64,0x14c)).decode()})
    wipe_bp,reveal_bp = add(0x1aa,ega),add(0x14e,ega)
    for phase,bp,ip in [('wipe',wipe_bp,0x1aa),('reveal',reveal_bp,0x14e)]:
        for band in range(5):
            stop = resume(stop['stop_id'])
            assert stop['breakpoint']['id'] == bp and stop['registers']['cs'] == ega
            data = state(f'{phase}-{band}',stop)
            assert struct.unpack_from('<H',data,stop['registers']['esp'] & 65535)[0] == 40*(band+1)
        remove(bp)
    input_bp = add(0x3c7)
    consumption = []
    def poll(name,expected=None,picture=False):
        global stop
        stop = resume(stop['stop_id'])
        assert stop['breakpoint']['id'] == input_bp and stop['registers']['cs'] == overlay
        byte = stop['registers']['eax'] & 255
        if expected is not None: assert byte == expected, f'{name}: expected{expected},observed{byte}'
        consumption.append({'name':name,'index':len(consumption)+1,'byte':byte,'stopId':stop['stop_id']})
        return state(name,stop,picture)
    poll('initial-input',picture=True)
    scenarios = [('up',[('KBD_up',True)],1),('right',[('KBD_right',True)],3),('left',[('KBD_left',True)],7),('down',[('KBD_down',True)],5),('up-right',[('KBD_up',True),('KBD_right',True)],3),('up-left',[('KBD_up',True),('KBD_left',True)],7),('left-right',[('KBD_left',True),('KBD_right',True)],3),('up-down',[('KBD_up',True),('KBD_down',True)],5)]
    for name,pressed,byte in scenarios:
        keys(*pressed)
        poll(name+'-make',byte)
        poll(name+'-held-1',byte)
        poll(name+'-held',byte,True)
        keys(*[(key,False) for key,_ in pressed])
        poll(name+'-released',byte)
        poll(name+'-neutral-0',0)
        poll(name+'-neutral-1',0)
        poll(name+'-neutral',0,True)
    keys(('KBD_space',True))
    poll('neutral-fire-0',192)
    poll('neutral-fire',192,True)
    keys(('KBD_space',False))
    poll('neutral-fire-release',192)
    poll('neutral-after-fire-0',0)
    poll('neutral-after-fire',0,True)
    keys(('KBD_right',True),('KBD_space',True))
    poll('map-fire',195)
    remove(input_bp)
    return_bp = add(0x6cf)
    stop = resume(stop['stop_id'])
    assert stop['registers']['eax'] & 65535 == 40
    final = state('return-map',stop,False)
    assert final[0x276c:0x27ec] == bytes(128)
    assert struct.unpack_from('<H',initial,0x2229)[0] == struct.unpack_from('<H',final,0x2229)[0]
    remove(return_bp)
    # The compared endpoint is already captured. Resume only to dispatch
    # cleanup key releases; subsequent guest execution is outside the segment.
    before_cleanup = client.get('/api/v1/input/replay/status')
    assert not before_cleanup['active'] and before_cleanup['remaining'] == 0
    keys(('KBD_right',False),('KBD_space',False))
    cleanup_resume = client.post('/api/v1/debug/continue')
    assert cleanup_resume['resumed_from_stop_id'] == stop['stop_id']
    replay = wait_until(lambda:client.get('/api/v1/input/replay/status'),lambda v:not v['active'])
    assert replay['remaining'] == 0
    save('input-cleanup',{'beforeCleanup':before_cleanup,'resume':cleanup_resume,'releaseReceipt':replay,'scope':'Post-capture execution only delivers final key releases and is excluded from compared office state.'})
    assert not owned and len(consumption) == 63
    save('inputs',inputs)
    save('consumption',consumption)
    save('capture',{'completed':True,'pid':manager.pid,'instanceId':info['instance_id'],'port':args.port,'bandCount':10,'keyboardScenarioCount':8,'inputCount':len(consumption),'returnCode':40,'injections':[],'partialRestore':False,'scriptSha256':sha(Path(__file__).read_bytes()),'decoderSha256':sha((ROOT/'src/game/executable.js').read_bytes()),'archiveDecoderSha256':sha((ROOT/'src/assets.js').read_bytes())})
    print(json.dumps({'completed':True,'bands':10,'inputCount':len(consumption),'returnCode':40,'output':str(out)}),flush=True)
finally:
    if manager.running: manager.stop()
    for client in clients: client.close()
