"""Conditional original EGA primitive pixels on one owned private emulator.
No shared-session changes,checkpoint restores,expected-output inputs or natural
CPU/IRQ timing claims. The original driver is executed,not an analysis image.
"""
import argparse,base64,hashlib,json,os,secrets,shutil,socket,struct,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
p=argparse.ArgumentParser()
p.add_argument('--output',required=True)
p.add_argument('--port',type=int,default=8403)
p.add_argument('--one-case',action='store_true')
a=p.parse_args()
assert 1024<a.port<65536 and a.port!=8386
out=Path(a.output)
assert out.resolve().is_relative_to((ROOT/'.local').resolve())
out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,value):(out/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
def node(code,*args):return subprocess.check_output(['node','--input-type=module','-e',code,*args])
node("import{archiveSource}from'./scripts/lib/local-scenario-source.js';await archiveSource(process.argv[1]);",str(out))
raw=node("import{originalGame}from'./tests/helpers/original-game.js';const r=await originalGame();process.stdout.write(Buffer.from(r.archives.get('IT.DRV')[1].data).toString('base64'));")
driver=base64.b64decode(raw)
assert len(driver)==2599 and sha(driver)=='6ee03bd93f3979546d5b5c1511e377685e2aa5401caaf407c3308bca0b812aee'
bridge=Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT'])
sys.path.insert(0,str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.client import DosboxClient
binary=Config.load().binary
assert binary and binary.is_file()
with socket.socket() as s:s.bind(('127.0.0.1',a.port))
run=out/'portable';run.mkdir()
owned_binary=run/'dosbox_with_debugger';shutil.copy2(binary,owned_binary)
# A portable primary config beside the copied executable isolates paths on macOS
# without overriding HOME or changing the shared bridge's configuration.
park=bytes.fromhex('bb0010b44acd21fafcebfe')
(run/'PARK.COM').write_bytes(park)
assert not any(ch in str(run.resolve()) for ch in ['"','\n','\r'])
(run/'dosbox-automation.conf').write_text('[webserver]\nwebserver_enabled = true\nwebserver_bind_address = 127.0.0.1\nwebserver_allow_remote = false\nwebserver_require_auth = true\nwebserver_token_file = false\nwebserver_osd = false\nwebserver_port = '+str(a.port)+'\nmount_allowed_bases = '+str(run.resolve())+'\n[debug]\ndebugger_window = false\n[cpu]\ncore = normal\ncpu_cycles = 3000\n[autoexec]\nmount c "'+str(run.resolve())+'" -ro\nc:\nPARK.COM\n')
cases=[{'x':x,'y':y,'width':32,'height':18} for x,y in [(248,-13),(248,-19),(248,-18),(248,195),(312,0),(248,0)]]
if a.one_case:cases=cases[:1]
seed=107
pattern=bytes(((i%8000)*17+((i%8000)>>5)*11+(i//8000)*53+seed)&255 for i in range(32000))
save('inputs',{'cases':cases,'sourcePattern':{'seed':seed,'planes':4,'planeBytes':8000,'formula':'((i%8000)*17+((i%8000)>>5)*11+(i//8000)*53+seed)&255'},'sourceSHA256':sha(pattern),'driverSHA256':sha(driver),'sourceStrideBytes':40,'destinationStrideBytes':40,'sourceVideo':False,'destinationVideo':True,'destinationSegment':0xa000,'sourceOffset':0x1000,'destinationOffset':0,'BIOSVideoMode':13,'scope':'Authored inputs and RAM pattern;no expected final state selects them.'})
env=dict(os.environ)
env['SDL_VIDEODRIVER']='dummy';env['SDL_AUDIODRIVER']='dummy'
token=secrets.token_hex(32);env['DOSBOX_API_TOKEN']=token
argv=[str(owned_binary.resolve()),'--nolocalconf']
save('configuration',{'binary':{'path':str(binary),'bytes':binary.stat().st_size,'sha256':sha(binary.read_bytes())},'portableBinarySHA256':sha(owned_binary.read_bytes()),'argv':argv,'configSHA256':sha((run/'dosbox-automation.conf').read_bytes()),'clientSHA256':sha((bridge/'dosbox_mcp/client.py').read_bytes()),'port':a.port,'sharedPortUntouched':8386,'environment':{'SDL_VIDEODRIVER':'dummy','SDL_AUDIODRIVER':'dummy','authentication':'private generated environment token,not recorded','configuration':'portable primary beside owned binary;no HOME override'},'scope':'Conditional original primitive with CLI/CLD,authored RAM source and real EGA destination;not natural game timing or a complete checkpoint.'})
proc=None;c=None;stop=None;completed=0;entry=None;returned_stop=None;entry_memory=None;args=None
log=(out/'emulator.log').open('wb')
try:
 proc=subprocess.Popen(argv,cwd=run,env=env,stdout=log,stderr=subprocess.STDOUT)
 c=DosboxClient(f'http://127.0.0.1:{a.port}',token)
 for _ in range(150):
  assert proc.poll() is None,'Owned emulator exited during startup'
  try:info=c.get('/api/v1/dosbox/info',timeout=1);break
  except Exception:time.sleep(.1)
 else:raise AssertionError('Owned emulator did not become ready')
 save('engine',info)
 startup=c.post('/api/v1/wait',json={'for':'program','pattern':'PARK','timeout_ms':15000},timeout=20)
 assert startup['satisfied']
 c.post('/api/v1/wait',json={'for':'frames','count':3,'timeout_ms':15000},timeout=20)
 save('startup',{'program':c.get('/api/v1/status'),'wait':startup,'parkSHA256':sha(park),'parkBytes':park.hex()})
 c.post('/api/v1/debug/pause');stop=c.get('/api/v1/debug/status')['stop']
 assert not stop['protected_mode']
 assert stop['registers']['eip']==0x109 and not stop['registers']['flags']&0x601,'Private guest did not reach its non-ROM no-interrupt loop'
 parked=c.post('/api/v1/batch',json={'ops':[{'op':'mem_read','segment':stop['registers']['cs'],'offset':0x100,'len':len(park)}]})
 assert base64.b64decode(parked['results'][0]['data'])==park
 save('parked',{'stop':stop,'code':parked})
 allocations=[c.post('/api/v1/memory/allocate',json={'size':65535,'area':'CONV'}) for _ in range(3)]
 save('allocations',allocations)
 assert all(v['addr']%16==0 for v in allocations)
 seg,source_seg,jump_seg=[v['addr']>>4 for v in allocations]
 def write(segment,offset,data):return {'op':'mem_write','segment':segment,'offset':offset,'data':base64.b64encode(data).decode()}
 def batch(ops):
  v=c.post('/api/v1/batch',json={'ops':ops})
  assert not v['aborted'] and all(q['status']=='ok' for q in v['results'])
  return v
 for index,event in enumerate(cases):
  baseline_info=c.get("/api/v1/video/frame/info")
  body=bytearray(65535);body[:len(driver)]=driver;struct.pack_into('<H',body,0x1e,0x2000)
  for handle,offset,target in [(0x2000,0,0xa000),(0x2020,0x1000,source_seg)]:
   struct.pack_into('<H',body,handle,40);struct.pack_into('<HHH',body,handle+4,offset,target,8000)
  # Set real EGA mode and clear it;BIOS is setup,not part of the compared call.
  args=[18,32,event['y'],event['x'],0x2000,event['y'],event['x'],0x2020]
  wrapper=bytearray(b'\xb8\x0d\x00\xcd\x10\xfa\xfc')
  for word in reversed(args):wrapper+=b'\x68'+struct.pack('<H',word&65535)
  wrapper+=b'\x9a'+struct.pack('<HH',0x1ef,seg)
  returned=0x4000+len(wrapper);wrapper+=b'\xeb\xfe';body[0x4000:0x4000+len(wrapper)]=wrapper
  ip=stop['registers']['eip'];assert ip+6<65535
  batch([write(seg,0,body),write(source_seg,0x1000,pattern),write(jump_seg,ip,b'\xfa\xea\x00\x40'+struct.pack('<H',seg)),*[{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',jump_seg),('ds',seg),('es',seg),('ss',seg),('esp',0xfef0)]]])
  c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':seg,'offset':0x1ef,'once':True})
  c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':seg,'offset':returned,'once':True})
  c.post('/api/v1/debug/step',json={'count':2})
  before=c.get('/api/v1/debug/status')['stop']['stop_id'];c.post('/api/v1/debug/continue')
  entry=c.get('/api/v1/debug/wait',params={'since_stop_id':before,'timeout_ms':15000},timeout=20)
  assert entry['satisfied'] and entry['registers']['cs']==seg and entry['registers']['eip']==0x1ef
  assert entry['registers']['ds']==seg and not entry['registers']['flags']&0x600
  entry_memory=batch([{'op':'mem_read','segment':seg,'offset':0,'len':len(driver)},{'op':'mem_read','segment':source_seg,'offset':0x1000,'len':32000},{'op':'mem_read','segment':seg,'offset':entry['registers']['esp']+4,'len':16}])
  assert base64.b64decode(entry_memory['results'][0]['data'])[0x1ef:0x35d]==driver[0x1ef:0x35d]
  assert base64.b64decode(entry_memory['results'][1]['data'])==pattern
  assert list(struct.unpack('<8H',base64.b64decode(entry_memory['results'][2]['data'])))==[v&65535 for v in args]
  before=entry['stop_id'];c.post('/api/v1/debug/continue')
  returned_stop=c.get('/api/v1/debug/wait',params={'since_stop_id':before,'timeout_ms':15000},timeout=20)
  assert returned_stop['satisfied'] and returned_stop['registers']['cs']==seg and returned_stop['registers']['eip']==returned
  assert returned_stop['registers']['esp']==0xfef0
  # Let the display consume the completed VRAM writes. The wrapper loops with
  # IF clear and cannot change the image;no game logic or expected data runs.
  c.post('/api/v1/debug/continue')
  waits=[];prior_hash=None
  for _ in range(20):
   wait=c.post('/api/v1/wait',json={'for':'frames','count':3,'timeout_ms':15000},timeout=20)
   assert wait['satisfied']
   frame_info=c.get('/api/v1/video/frame/info');waits.append({'wait':wait,'frameInfo':frame_info})
   ready=frame_info['video_mode']['bios_mode_number']==13 and frame_info['width']==320 and frame_info['height']==200 and frame_info['frame_hash']!=baseline_info['frame_hash']
   if ready and frame_info['frame_hash']==prior_hash:break
   prior_hash=frame_info['frame_hash'] if ready else None
  else:raise AssertionError('Native raw EGA image did not become current and stable')
  c.post('/api/v1/debug/pause');stop=c.get('/api/v1/debug/status')['stop']
  assert stop['registers']['cs']==seg
  assert frame_info['video_mode']['is_graphics_mode']
  assert frame_info['video_mode']['bios_mode_number']==13
  png=c.get('/api/v1/video/frame',params={'format':'png','mode':'raw'})
  assert isinstance(png,bytes) and png[:8]==b'\x89PNG\r\n\x1a\n'
  (out/f'case-{index:02}.png').write_bytes(png)
  save(f'case-{index:02}',{'index':index,'input':event,'args':args,'entry':entry,'entryMemory':entry_memory,'returned':returned_stop,'baselineFrameInfo':baseline_info,'scanoutWaits':waits,'captureStop':stop,'frameInfo':frame_info,'pngSHA256':sha(png)})
  completed+=1;print(json.dumps({'case':index,'x':event['x'],'y':event['y'],'pngBytes':len(png)}),flush=True)
 assert completed==len(cases)>0
 node("import{checkSource}from'./scripts/lib/local-scenario-source.js';await checkSource(process.argv[1],p=>p.startsWith('src/')||p.startsWith('scripts/')||p.startsWith('tests/'));",str(out))
 save('capture',{'completed':True,'accepted':False,'nativeComparison':'conditional original primitive pixels only','cases':completed,'oneCase':a.one_case,'pid':proc.pid,'driverSHA256':sha(driver),'scope':'Original driver real EGA pixels with authored source;not natural bank/campaign timing,hidden-page aliasing or machine checkpoint restoration.'})
except BaseException as error:
 save('capture-failure',{'completed':False,'cases':completed,'error':repr(error),'stop':stop,'entry':entry,'entryMemory':entry_memory,'returned':returned_stop,'args':args});raise
finally:
 if c:c.close()
 if proc and proc.poll() is None:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=5)
 log.close()
 save('lifecycle',{'ownedPID':proc.pid if proc else None,'terminal':proc is None or proc.poll() is not None,'returnCode':proc.returncode if proc else None,'sharedSessionChanged':False})
