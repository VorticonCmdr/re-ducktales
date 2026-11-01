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
parser.add_argument('--map-clock', action='store_true', help='Capture35 caller deadline completions and their two successful clock reads after the initial map baseline')
parser.add_argument('--map-repeat', action='store_true', help='Use the fixed long-held Right profile to investigate external keyboard repeat')
parser.add_argument('--map-notice', action='store_true', help='Use fixed map makes,held Fire and fresh dialogue choices to capture the destination handoff')
parser.add_argument('--notice-video', action='store_true', help='Observe raw-frame metadata,BIOS/drawing pages and both sides of destination page flips without changing video state')
parser.add_argument('--notice-keyboard', action='store_true', help='Use the fixed sixteen-read destination letter/keypad/combined-key profile')
parser.add_argument('--navigation', action='store_true', help='Fixed Right/Left after the first warning, returning to row0')
parser.add_argument('--pause-clock-test', action='store_true', help='Measure whether the resident driver clock advances during a one-second owned debugger pause;does not change game timing')
parser.add_argument('--mountain-timing', action='store_true', help='Continue by the natural El Capitan setup into an engine-counted mountain pacing experiment')
parser.add_argument('--mountain-profile', action='store_true', help='Observe original walking logic,erase,draw and flip boundaries during the mountain timing scenario')
parser.add_argument('--mountain-page-observer', action='store_true', help='Observe80 rendered-frame samples of the original page byte without execution breakpoints during measurement')
parser.add_argument('--safari-page-observer', action='store_true', help='Natural Safari entry and non-stopping timer/page observations in a private portable session')
parser.add_argument('--jungle-page-observer', action='store_true', help='Natural swamp entry and uninterrupted movement observations in a private portable session')
parser.add_argument('--jungle-motion-profile', choices=['walk', 'jump', 'walk-hold'], default='walk', help='Independent fixed movement schedule for the jungle observer')
parser.add_argument('--pic-clock-engine', help='Explicit calibrated private engine with read-only Lua PIC time;only jungle observations')
parser.add_argument('--pic-clock-source', help='Source checkout for the explicitly selected PIC clock engine')
parser.add_argument('--native-machine', choices=['svga_s3', 'ega'], default='svga_s3', help='Private jungle movement experiment video hardware')
parser.add_argument('--cave-page-observer', action='store_true', help='Natural Carlsbad entry and uninterrupted passage/reward observations in a private portable session')
parser.add_argument('--cave-loader-profile', action='store_true', help='Measure the first natural cave transition resource load instead of a frame observer')
parser.add_argument('--cave-loader-resource', choices=['sprite10', 'background0'], default='sprite10')
parser.add_argument('--cave-treasure-profile', action='store_true', help='Reach a natural cave treasure with debugger-bounded hardware inputs;not elapsed-time evidence')
args = parser.parse_args()
if bool(args.pic_clock_engine) != bool(args.pic_clock_source):
    parser.error('--pic-clock-engine and --pic-clock-source must be supplied together')
if args.pic_clock_engine and (not args.jungle_page_observer or args.jungle_motion_profile=='walk'):
    parser.error('PIC clock capture requires jungle jump or walk-hold profile')
if args.jungle_motion_profile != 'walk' and not args.jungle_page_observer:
    parser.error('--jungle-motion-profile requires --jungle-page-observer')
if args.native_machine != 'svga_s3' and not args.jungle_page_observer:
    parser.error('--native-machine ega is scoped to --jungle-page-observer')
if args.cave_treasure_profile and (not args.cave_page_observer or args.cave_loader_profile):
    parser.error('--cave-treasure-profile requires --cave-page-observer and excludes loader profiling')
if args.cave_loader_resource != 'sprite10' and not args.cave_loader_profile:
    parser.error('--cave-loader-resource requires --cave-loader-profile')
if args.cave_loader_profile and not args.cave_page_observer:
    parser.error('--cave-loader-profile requires --cave-page-observer')
if sum([args.safari_page_observer, args.jungle_page_observer, args.cave_page_observer]) > 1:
    parser.error('Choose one expedition observer')
if (args.safari_page_observer or args.jungle_page_observer or args.cave_page_observer) and (args.mountain_timing or args.map_inputs or args.navigation):
    parser.error('--safari-page-observer owns its setup and is separate from other profiles')
if args.mountain_timing and (args.map_inputs or args.navigation):
    parser.error('--mountain-timing owns its map setup and is separate from map/navigation profiles')
if args.mountain_profile and not args.mountain_timing:
    parser.error('--mountain-profile requires --mountain-timing')
if args.mountain_page_observer and (not args.mountain_timing or args.mountain_profile):
    parser.error('--mountain-page-observer requires --mountain-timing and is separate from --mountain-profile')
if (args.map_clock or args.map_repeat or args.map_notice) and not args.map_inputs:
    parser.error('--map-clock,--map-repeat and --map-notice require --map-inputs')
if args.map_notice and args.map_repeat:
    parser.error('--map-notice and --map-repeat are separate fixed profiles')
if args.notice_video and not args.map_notice:
    parser.error('--notice-video requires --map-notice')
if args.notice_keyboard and (not args.map_notice or args.notice_video):
    parser.error('--notice-keyboard requires --map-notice and is separate from --notice-video')
out = (ROOT / args.output).resolve()
assert out.is_relative_to((ROOT / '.local').resolve()), 'Captures must stay in ignored local storage'
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
if args.pic_clock_engine:
    subprocess.run(['node','scripts/verify-native-clock.js'],cwd=ROOT,check=True)
    clock_root=Path(args.pic_clock_source).resolve()
    assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=clock_root), 'Clock engine tracked source must be clean'
    cfg=replace(cfg,binary=Path(args.pic_clock_engine).resolve())
    calibrated=json.loads((ROOT/'.local/native-clock-calibration-01/observer-engine.json').read_text())
    assert sha(cfg.binary.read_bytes())==calibrated['binarySHA256'], 'Uncalibrated PIC clock engine'
    assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=clock_root,text=True).strip()==calibrated['revision']
    for name,value in calibrated['files'].items():assert sha((clock_root/name).read_bytes())==value
    save('clock-engine',calibrated)
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
if (args.safari_page_observer or args.jungle_page_observer or args.cave_page_observer):
    # The installed lifecycle redirects HOME. Use an owned portable primary
    # instead,without changing the package or shared bridge configuration.
    from native_portable_session import PortableSession
    subprocess.run(['node', '--input-type=module', '-e',
        "import{archiveSource}from'./scripts/lib/local-scenario-source.js';await archiveSource(process.argv[1]);", str(out)], cwd=ROOT, check=True)
    manager = PortableSession(cfg, attach, out, ROOT/'game', machine=args.native_machine)
else:
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

def add(ip, segment=None, **options):
    segment = overlay if segment is None else segment
    bp = client.post('/api/v1/debug/breakpoints', json={'type': 'execute', 'segment': segment, 'offset': ip, **options})
    owned.add(bp['id'])
    owned_segments[bp['id']] = segment
    return bp['id']

def remove(bp):
    client.delete('/api/v1/debug/breakpoints', json={'id': bp})
    owned.remove(bp)
    del owned_segments[bp]

def resume(stop_id, wait_seconds=15):
    resumed = client.post('/api/v1/debug/continue')
    assert resumed['resumed_from_stop_id'] == stop_id
    deadline = time.monotonic() + wait_seconds
    while True:
        stop = client.get('/api/v1/debug/wait', params={'since_stop_id': stop_id, 'timeout_ms': 15000}, timeout=20)
        if stop['satisfied']:
            break
        if time.monotonic() >= deadline:
            # An observation timeout is not a new execution. Retain the same
            # continuation until the bounded scenario limit, then save a stable
            # diagnostic state before the owner's finally block stops its child.
            diagnostic_stop = client.post('/api/v1/debug/pause')['stop']
            save('unfinished-owned-wait', {'wait': stop, 'paused': diagnostic_stop,
                 'expectedBreakpoints': sorted(owned), 'waitSeconds': wait_seconds,
                 'replay': client.get('/api/v1/input/replay/status')})
            state('unfinished-owned-wait-state', diagnostic_stop)
            raise AssertionError('Unfinished owned execution;stable diagnostic captured')
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
    record = {'stop': stop, 'state': batch}
    if args.notice_video and name.startswith('notice'):
        # All observations occur at the same owned CPU stop. The raw image is
        # the renderer's last shared image, not a fresh VRAM rendering. The
        # status frame counter also counts aborted render updates; it is not
        # a precise completed-scanout clock.
        # Read existing metadata/pages;never write VGA index or plane registers.
        data = base64.b64decode(batch['results'][1]['data'])
        driver_segment = struct.unpack_from('<H',data,0x1fd6)[0]
        assert 0x1000 <= driver_segment < 0xa000
        status_before = client.get('/api/v1/status')
        frame_before = client.get('/api/v1/video/frame/info',params={'mode':'raw'})
        video_memory = client.post('/api/v1/batch',json={'ops':[
            {'op':'mem_read','segment':0x40,'offset':0x4e,'len':21},
            {'op':'mem_read','segment':driver_segment,'offset':0,'len':2599}]})
        assert not video_memory['aborted'] and all(r['status']=='ok' for r in video_memory['results'])
        driver = base64.b64decode(video_memory['results'][1]['data'])
        assert driver[0xe5:0x101] == bytes.fromhex('b4052ea02700cd102e80362700012e8b1e1e008177060002e864ffcb'), 'Unexpected live EGA flip routine'
        surface = struct.unpack_from('<H',driver,0x1e)[0]
        assert surface+12 <= len(data)
        record['video'] = {'statusBefore':status_before,'frameBefore':frame_before,
                           'memory':video_memory,'driverSegment':driver_segment,
                           'drawingSurfacePointer':surface,
                           'drawingSurfaceWords':list(struct.unpack_from('<6H',data,surface)),
                           'driverNextPage':driver[0x27]}
    if picture:
        (out / (name + '.png')).write_bytes(client.get('/api/v1/video/frame', params={'format': 'png', 'mode': 'raw'}))
    if 'video' in record:
        record['video']['frameAfter'] = client.get('/api/v1/video/frame/info',params={'mode':'raw'})
        record['video']['statusAfter'] = client.get('/api/v1/status')
        assert record['video']['statusBefore']['frame'] == record['video']['statusAfter']['frame'], 'Frame advanced at a paused CPU boundary'
        assert record['video']['frameBefore']['frame_hash'] == record['video']['frameAfter']['frame_hash'], 'Raw image changed at a paused CPU boundary'
    save(name, record)
    return base64.b64decode(batch['results'][1]['data'])

try:
    info = manager.start()
    client = clients[-1]
    save('engine', info)
    if args.mountain_profile or args.mountain_page_observer or (args.safari_page_observer or args.jungle_page_observer or args.cave_page_observer):
        binary = Path(manager.build_argv()[0]).resolve()
        save('profile-tool-identity', {'executable': str(binary),
             'executableSha256': sha(binary.read_bytes()),
             'bridgeClientSha256': sha((bridge/'dosbox_mcp/client.py').read_bytes()),
             'lifecycleSha256': sha((bridge/'dosbox_mcp/lifecycle.py').read_bytes()),
             'scope': 'Binary and bridge identities read at owned launch;no engine or tool modifications'})
    if args.notice_video:
        executable = Path(manager.build_argv()[0]).resolve()
        save('video-tool-identity',{'executable':str(executable),'executableSha256':sha(executable.read_bytes()),
                                    'bridgeClientSha256':sha((bridge/'dosbox_mcp/client.py').read_bytes()),
                                    'scope':'Read-only raw frame/status,BIOS and EGA-driver snapshots at owned CPU stops;no VGA-register writes or fitted timing.'})
    client.post('/api/v1/drive/mount', json={'drive': 'C', 'path': str((ROOT/'game').resolve()), 'readonly': True})
    commands = 'config -get cpu cpu_cycles\nconfig -get cpu core\nconfig -get dosbox memsize\n'
    if args.mountain_profile or args.mountain_page_observer or (args.safari_page_observer or args.jungle_page_observer or args.cave_page_observer):
        commands += 'config -get dosbox vmem_delay\n'
    commands += 'config -get dosbox machine\n'
    client.post('/api/v1/input/type', json={'text': commands, 'cps': 200})
    config_screen = wait_until(lambda: client.get('/api/v1/video/text'), lambda v: args.native_machine in json.dumps(v))
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
    if args.pause_clock_test:
        before = state('pause-clock-before', stop, False)
        started = time.monotonic()
        time.sleep(1)
        after = state('pause-clock-after', stop, False)
        elapsed = (time.monotonic() - started) * 1000
        paused_status = client.get('/api/v1/debug/status')
        counter_before = struct.unpack_from('<I', before, 0x2225)[0]
        counter_after = struct.unpack_from('<I', after, 0x2225)[0]
        assert counter_after == counter_before, 'Driver clock advanced during debugger pause'
        save('pause-clock-test', {'completed': True, 'hostMilliseconds': elapsed,
                                 'counterBefore': counter_before, 'counterAfter': counter_after,
                                 'stopId': stop['stop_id'], 'statusAfter': paused_status,
                                 'injections': [], 'partialRestore': False,
                                 'scope': 'Debugger pause invariance only;not a fresh mountain movement or wall-clock benchmark'})
    keys(('KBD_right',True),('KBD_space',True))
    stop = resume(stop['stop_id'])
    assert stop['registers']['eax'] & 255 == 195
    office_confirm = state('office-confirm',stop,False)
    if args.pause_clock_test:
        assert struct.unpack_from('<I', office_confirm, 0x2225)[0] > counter_after, 'Driver clock did not resume'
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
    if (args.safari_page_observer or args.jungle_page_observer or args.cave_page_observer):
        from capture_safari_cadence import capture_safari_cadence
        from capture_jungle_cadence import capture_jungle_cadence
        from capture_cave_cadence import capture_cave_cadence
        capture_safari_cadence(client=client, stop=stop, load=load, ds=ds,
                               overlay=overlay, add=add, remove=remove,
                               resume=resume, state=state, keys=keys,
                               sequence=sequence, wait_until=wait_until,
                               save=save, root=ROOT,
                               target=(45, 68) if args.cave_page_observer else (64, 73) if args.jungle_page_observer else (46, 56),
                               entry_callback=(lambda **kwargs: capture_cave_cadence(loader_profile=args.cave_loader_resource, **kwargs)) if args.cave_loader_profile else (lambda **kwargs: capture_cave_cadence(treasure_profile=True, **kwargs)) if args.cave_treasure_profile else capture_cave_cadence if args.cave_page_observer else (lambda **kwargs: capture_jungle_cadence(motion_profile=args.jungle_motion_profile, clock_observer=bool(args.pic_clock_engine), **kwargs)) if args.jungle_page_observer else None)
    if args.mountain_timing:
        from capture_mountain_timing import capture_mountain_timing
        capture_mountain_timing(client=client, stop=stop, load=load, ds=ds,
                                overlay=overlay, add=add, remove=remove,
                                resume=resume, state=state, keys=keys,
                                sequence=sequence, wait_until=wait_until,
                                save=save, root=ROOT, profile=args.mountain_profile,
                                page_observer=args.mountain_page_observer)
    if args.map_inputs:
        profile_path = ROOT / ('reference/destination-keyboard-inputs.json' if args.notice_keyboard else 'reference/map-notice-inputs.json' if args.map_notice else 'reference/map-keyboard-repeat-inputs.json' if args.map_repeat else 'reference/map-keyboard-inputs.json')
        profile = json.loads(profile_path.read_text())
        expected_sequences = 15 if args.map_notice else 2 if args.map_repeat else 10
        assert profile['expectedReads'] == 36 and len(profile['events']) == expected_sequences
        by_read = {e['beforeRead']: e for e in profile['events']}
        assert len(by_read) == expected_sequences and all(0 <= i < 36 for i in by_read)
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
        clock_records=[]
        clock_inputs=[]
        clock_bps=[]
        if args.map_clock:
            # Read the actual relocated CALLF operand. The memory-read alias
            # load:9ab8 is physically equivalent,but not the executing CS:IP.
            assert body[0x10ac:0x10b1] == bytes.fromhex('9ad8018e09')
            deadline_ip,deadline_cs=struct.unpack_from('<HH',relocated,0x10ad)
            assert deadline_ip==0x1d8 and deadline_cs==load+0x98e
            clock_bps=[(stage,add(ip,deadline_cs))for stage,ip in
                       [('entry',0x1d8),('ready',0x1f4),('read',0x1f9),('end',0x208)]]
            save('map-clock-mapping',{'segment':deadline_cs,'entry':deadline_ip,
                                     'callBodyOffset':0x10ac,'liveCall':relocated[0x10ac:0x10b1].hex(),
                                     'scope':'Two successful clock reads,not the number or values of earlier busy-wait polls.'})
        for index in range(36):
            # The first pointer entry was reached before these hooks were armed.
            # Subsequent calls use the untouched original six-count caller wait.
            if args.map_clock and index:
                clock_row={'beforeMapRead':index}
                for stage,bp in clock_bps:
                    stop=resume(stop['stop_id'])
                    assert stop['breakpoint']['id']==bp
                    name=f'map-clock-{index:03d}-{stage}'
                    data=state(name,stop,False)
                    clock_row[stage]={'artifact':name+'.json','stopId':stop['stop_id'],
                                      'clock':struct.unpack_from('<I',data,0x2225)[0],
                                      'deadline':struct.unpack_from('<I',data,0x27f8)[0],
                                      'period':struct.unpack_from('<I',data,0x27fc)[0]}
                    if stage in ['ready','read']:
                        regs=stop['registers']
                        # AX:DX are the device result at its consumption boundary,
                        # captured before ADD/ADC. Never infer them from deadline.
                        clock_inputs.append({'beforeMapRead':index,'phase':stage,
                                             'value':((regs['edx']&65535)<<16)|(regs['eax']&65535),
                                             'artifact':name+'.json','stopId':stop['stop_id']})
                clock_records.append(clock_row)
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
                               'KBD_kp3':0x51,'KBD_m':0x32,'KBD_up':0x48,'KBD_space':0x39}
                    expected_flags={}
                    for event in by_read[index]['keys']:
                        key=event['key']
                        if event['pressed']:expected_flags[key]=[128]
                        elif key in expected_flags:expected_flags[key]=[64]
                        else:expected_flags[key]=[0,64] if args.map_repeat else [0]
                    for key,expected in expected_flags.items():
                        assert data[0x276c+raw_codes[key]] in expected, f'Authored key not settled before map read{index}: {key}'
                if stage=='end' and index+1 in by_read:
                    event=by_read[index+1]
                    row['scheduledForRead']=index+1
                    row['scheduledInputRecord']=len(inputs)
                    # Queue after the previous pointer's flush. The original
                    # six-count caller wait delivers all hardware scan bytes
                    # before the following reader,including extended arrows.
                    keys(*[(e['key'],e['pressed'])for e in event['keys']])
            map_records.append(row)
        for bp in [before_bp,input_bp,end_bp]+[bp for _,bp in clock_bps]:remove(bp)
        replay=client.get('/api/v1/input/replay/status')
        assert not replay['active'] and replay['remaining']==0
        if args.map_notice:
            # Held Fire returns before the pointer's normal flush/mode reset.
            assert stop['registers']['eax']&65535==1 and data[0x3c1]==0
            assert data[0x276c+0x39]==128
            entry=add(0x1757-0xca0,map_cs)
            stop=resume(stop['stop_id']);assert stop['breakpoint']['id']==entry
            state('notice-entry',stop);remove(entry)
            notice_records=[]
            def notice_snapshot(name,stop,picture=False):
                data=state(name,stop,picture)
                bp=stop['registers']['ebp']&65535
                return {'artifact':name+'.json','stopId':stop['stop_id'],
                        'clock':struct.unpack_from('<I',data,0x2225)[0],
                        'mode':data[0x3c1],'choice':struct.unpack_from('<H',data,(bp-0x7c)&65535)[0],
                        'ax':stop['registers']['eax']&65535}
            for name,ip in [('notice-before-entry-flush',0x18b1),('notice-after-entry-flush',0x18b6)]:
                marker=add(ip-0xca0,map_cs)
                stop=resume(stop['stop_id']);assert stop['breakpoint']['id']==marker
                notice_records.append(notice_snapshot(name,stop))
                remove(marker)
            stages=[('flush',add(0x1e33-0xca0,map_cs)),('before',add(0x1e89-0xca0,map_cs)),('input',add(0x1e8e-0xca0,map_cs))]
            flip_stages=[('flip-before',add(0x1da1-0xca0,map_cs)),('flip-after',add(0x1da5-0xca0,map_cs))] if args.notice_video else []
            notice_reads = 16 if args.notice_keyboard else 5
            if args.notice_keyboard:
                assert profile['noticeReads'] == notice_reads
                assert set(profile['noticeEvents']) == {str(i) for i in range(notice_reads)}
            for index in range(notice_reads):
                row={'index':index}
                for stage,bp in stages:
                    stop=resume(stop['stop_id']);assert stop['breakpoint']['id']==bp
                    row[stage]=notice_snapshot(f'notice-{index:03d}-{stage}',stop,stage=='flush')
                    event=profile['noticeEvents'].get(str(index),{})
                    if stage=='flush' and event.get('keys'):
                        row['scheduledInputRecord']=len(inputs)
                        keys(*[(e['key'],e['pressed'])for e in event['keys']])
                    if stage=='input' and event.get('afterKeys'):
                        row['afterInputRecord']=len(inputs)
                        keys(*[(e['key'],e['pressed'])for e in event['afterKeys']])
                for stage,bp in flip_stages:
                    stop=resume(stop['stop_id']);assert stop['breakpoint']['id']==bp
                    row[stage]=notice_snapshot(f'notice-{index:03d}-{stage}',stop,True)
                notice_records.append(row)
            for _,bp in stages+flip_stages:remove(bp)
            ret=add(0x1ec7-0xca0,map_cs)
            stop=resume(stop['stop_id']);assert stop['breakpoint']['id']==ret
            data=state('notice-return',stop)
            remove(ret)
            assert stop['registers']['eax']&65535 == 1
            replay=client.get('/api/v1/input/replay/status')
            assert not replay['active'] and replay['remaining']==0
            assert data[0x276c:0x27ec]==bytes(128)
            save('notice-consumption',notice_records)
            save('notice-capture',{'completed':True,'inputReads':notice_reads,'returnCode':stop['registers']['eax']&65535,
                                   'segment':map_cs,'injections':[],'partialRestore':False,'replay':replay,
                                   'videoBoundaries':10 if args.notice_video else 0,
                                   'scope':'Natural held-Fire map-to-dialogue handoff and fresh choices;not full scene/browser timing parity.'})
        else:
            assert data[0x276c:0x27ec] == bytes(128)
        if args.map_clock:
            assert len(clock_records)==35 and len(clock_inputs)==70
            save('map-clock-inputs',clock_inputs)
            save('map-clock-consumption',clock_records)
            save('map-clock-capture',{'completed':True,'expectedCalls':35,'expectedExternalReads':70,
                                      'initialMapReadExcluded':0,'injections':[],'partialRestore':False,
                                      'scope':'Deadline completion segment after a conditional fresh launch. Earlier spin-poll counts and values are not captured;not complete CPU/IRQ or browser timing parity.'})
        save('map-consumption',map_records)
        save('map-capture',{'completed':True,'inputReads':36,'authoredSequences':expected_sequences,
                           'profile':str(profile_path.relative_to(ROOT)),
                           'profileSha256':sha(profile_path.read_bytes()),
                           'xPointer':x_ptr,'yPointer':y_ptr,'segment':map_cs,
                           'injections':[],'partialRestore':False,'replay':replay,
                           'scope':'Natural map input/IRQ-table/flush/clock observations after conditional fresh-launch security setup. Not browser or full native timing parity.'})
    assert not owned
    if (args.safari_page_observer or args.jungle_page_observer or args.cave_page_observer):
        subprocess.run(['node', '--input-type=module', '-e',
            "import{checkSource}from'./scripts/lib/local-scenario-source.js';await checkSource(process.argv[1],p=>p.startsWith('src/')||p.startsWith('scripts/')||p.startsWith('tests/')||p==='reference/build.json');", str(out)], cwd=ROOT, check=True)
    save('inputs',inputs)
    save('capture',{'completed':True,'pid':manager.pid,'instanceId':info['instance_id'],'port':args.port,'initialSeed':struct.unpack_from('<H',initial,0x2229)[0],'finalSeed':struct.unpack_from('<H',final,0x2229)[0],'rngCalls':len(draws),'wrongFirst':warned,'navigation':args.navigation and warned,'requiredInputPolls':4+(3+(2 if args.navigation else 0) if warned else 1),'injections':[],'partialRestore':False,'scriptSha256':sha(Path(__file__).read_bytes())})
    print(json.dumps({'completed':True,'pid':manager.pid,'rngCalls':len(draws),'wrongFirst':warned,'output':str(out)}),flush=True)
finally:
    if manager.running or (args.safari_page_observer or args.jungle_page_observer or args.cave_page_observer):
        manager.stop()
    for client in clients:
        client.close()
