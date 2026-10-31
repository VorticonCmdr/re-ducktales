"""Conditional original note gate branch in an owned DOS COM fixture.
Original resource5 code/data copied unchanged;only mutable driver inputs are
injected. No original file or shared emulator is changed. No timing acceptance.
"""
import argparse,base64,hashlib,json,os,socket,struct,subprocess,sys,time
from pathlib import Path
from dataclasses import replace
from native_portable_session import PortableSession
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--port',type=int,default=8411);a=p.parse_args()
out=(ROOT/a.output).resolve();assert out.is_relative_to((ROOT/'.local').resolve());out.mkdir()
assert a.port!=8386
with socket.socket() as s:s.bind(('127.0.0.1',a.port))
bridge=Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']).resolve();sys.path.insert(0,str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.client import DosboxClient
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,v):(out/(n+'.json')).write_text(json.dumps(v,indent=2)+'\n')
inputs=json.loads((ROOT/'reference/speaker-note-gate-inputs.json').read_text())
assert inputs['kind']=='conditional-speaker-note-gate-inputs' and len(inputs['cases'])==3
driver=base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',
    "import{originalGame}from'./tests/helpers/original-game.js';const{archives}=await originalGame();process.stdout.write(Buffer.from(archives.get('IT.DRV')[5].data).toString('base64'));"],cwd=ROOT))
assert len(driver)==7253 and sha(driver)=='131133fb9137d6ef39db079cf81986110244a41e43efcfbf34ef0e347b5a9c33'
assert driver[inputs['notePointer']:inputs['notePointer']+2]==bytes([0x13,1])
program=bytearray(0x3300)
# COM entry selects the paragraph where the original driver begins. Only our
# own wrapper executes outside the original7253-byte driver image.
entry=bytes.fromhex('fa0e5883c02050680030cb');program[:len(entry)]=entry
program[0x100:0x100+len(driver)]=driver
wrapper=bytearray(bytes.fromhex('0e1f0e070e17bc00f0fc'))
def emit(h):wrapper.extend(bytes.fromhex(h))
def call(ip):emit('e8');wrapper.extend(struct.pack('<H',(ip-(0x3000+len(wrapper)+2))&65535))
def byte(at,value):emit('c606');wrapper.extend(struct.pack('<HB',at,value))
def word(at,value):emit('c706');wrapper.extend(struct.pack('<HH',at,value))
for i,event in enumerate(inputs['cases']):
    call(0x576)
    for at,v in [(0x269,1),(0x268,255),(0x258,1),(0x250,1),(0x26a,event['gate']),(0x26b,event['previousCounter'])]:byte(at,v)
    word(0x24e,inputs['notePointer']);call(0x5ac)
    emit('be0000bf');wrapper.extend(struct.pack('<H',0x4000+i*0x2000));emit('b9551cf3a4')
emit('b8004ccd21');assert len(wrapper)<=0x200
program[0x3100:0x3100+len(wrapper)]=wrapper
mount=out/'fixture';mount.mkdir();(mount/'NOTEGATE.COM').write_bytes(program)
save('fixture',{'programSHA256':sha(program),'driverSHA256':sha(driver),'driverFileOffset':0x100,
    'driverParagraphDelta':0x20,'wrapperIP':0x3000,'wrapperBytes':len(wrapper),
    'resultOffsets':[0x4000,0x6000,0x8000],'inputs':inputs,'accepted':False})
subprocess.run(['node','--input-type=module','-e',"import{archiveSource}from'./scripts/lib/local-scenario-source.js';await archiveSource(process.argv[1]);",str(out)],cwd=ROOT,check=True)
cfg=replace(Config.load(),port=a.port,base_url=f'http://127.0.0.1:{a.port}',headless=True,mute=True)
clients=[]
def attach(url,token):
    c=DosboxClient(url,token);clients.append(c);info=c.get('/api/v1/dosbox/info');assert info['pid']==manager.pid;return info
manager=PortableSession(cfg,attach,out,mount)
def wait(read,predicate):
    end=time.monotonic()+20
    while time.monotonic()<end:
        v=read()
        if predicate(v):return v
        time.sleep(.05)
    raise AssertionError('Unfinished owned note gate setup')
try:
    info=manager.start();c=clients[-1];save('engine',info)
    save('tool-identity',{'binarySHA256':sha(cfg.binary.read_bytes()),'scriptSHA256':sha(Path(__file__).read_bytes())})
    wait(lambda:c.get('/api/v1/video/text'),lambda v:'Z:\\>' in v.get('text',''))
    c.post('/api/v1/drive/mount',json={'drive':'C','path':str(mount),'readonly':True})
    c.post('/api/v1/input/type',json={'text':'c:\n','cps':100})
    wait(lambda:c.get('/api/v1/video/text'),lambda v:'C:\\>' in v.get('text',''))
    paused=c.post('/api/v1/debug/pause')['stop']
    bp=c.post('/api/v1/debug/breakpoints',json={'type':'interrupt','int':0x21,'ah':0x4c})
    c.post('/api/v1/input/type',json={'text':'notegate\n','cps':100})
    continued=c.post('/api/v1/debug/continue');assert continued['resumed_from_stop_id']==paused['stop_id']
    stop=c.get('/api/v1/debug/wait',params={'since_stop_id':paused['stop_id'],'timeout_ms':15000},timeout=20)
    save('program-stop',stop)
    assert stop['satisfied'] and stop['breakpoint']['id']==bp['id'] and not stop['protected_mode']
    regs=stop['registers'];assert regs['eax']&65535==0x4c00 and regs['cs']==regs['ds']==regs['ss']
    segment=regs['cs']
    read=c.post('/api/v1/batch',json={'ops':[
        {'op':'mem_read','segment':segment,'offset':at,'len':7253} for at in [0,0x4000,0x6000,0x8000]]})
    save('driver-results',read)
    assert not read['aborted'] and len(read['results'])==4 and all(r['status']=='ok' for r in read['results'])
    for result in read['results']:
        b=base64.b64decode(result['data']);assert len(b)==7253
        assert b[0x2a8:0x8cb]==driver[0x2a8:0x8cb], 'Original driver code changed'
    c.delete('/api/v1/debug/breakpoints',json={'id':bp['id']})
    save('capture',{'completed':True,'accepted':False,'cases':3,'segment':segment,
        'injections':['Private original driver copy','Mutable note/gate/tempo inputs','IF clear;near sequencer calls;private stack'],
        'partialRestore':False,'naturalMachineCheckpoint':False,'nativeTimingAccepted':False})
finally:
    manager.stop()
    for c in clients:c.close()
print(json.dumps({'completed':True,'accepted':False,'output':str(out)}),flush=True)
