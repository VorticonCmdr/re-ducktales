"""Observe original mountain HUD call plans with explicit drawing stubs.
Conditional HUD call inputs,not natural timing,pixels or a machine checkpoint.
"""
from pathlib import Path
from dataclasses import replace
import argparse,base64,hashlib,json,os,socket,struct,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--port',type=int,default=8401);a=p.parse_args();assert a.port!=8386
out=Path(a.output);assert out.resolve().is_relative_to((ROOT/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,value):(out/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
source=Path(__file__).read_bytes();(out/'capture-source.py').write_bytes(source)
parent=Path('reference/mountain-draw-work.json');manifest=json.loads(parent.read_text());cases=[];initials=[]
spec=manifest['artifacts']['frame-00-before-erase'];raw=Path(spec['path']).read_bytes();assert sha(raw)==spec['sha256'];base=base64.b64decode(json.loads(raw)['state']['results'][1]['data']);assert len(base)==65536
patches=[[],[[0x4e0e,1,9]],[[0x4e0e,1,10]],[[0x4e0e,1,30]],[[0x4e0e,1,-1]],[[0x4e0e,1,-128]],[[0x8cc0,2,0],[0x8cc2,2,0x8000]],[[0x8cc0,2,65535],[0x8cc2,2,65535]],[[0x8cc0,2,0],[0x8cc2,2,0]],[[0x4d34,1,0]],[[0x4d34,1,1]],[[0x4d34,1,2]]]
for i,patch in enumerate(patches):cases.append({'id':f'hud-{i:02}','initial':spec,'patches':patch});initials.append(base)
assert len(cases)==12
js="import{readFile}from'node:fs/promises';import{originalGame}from'./tests/helpers/original-game.js';const{image}=await originalGame();console.log(JSON.stringify({image:Buffer.from(image).toString('base64'),exe:Buffer.from(await readFile('game/DUCKTALE.EXE')).toString('base64')}));"
assets=json.loads(subprocess.check_output(['node','--input-type=module','-e',js]));image=base64.b64decode(assets['image']);exe=base64.b64decode(assets['exe']);overlay=exe[0x17600:0x17600+12514];body=overlay[512:];assert len(body)==12002 and sha(body)=='b50591460d43e848d52b49ee7b843065413d877dca8dc75455ce7dca2a7f2bd0'
save('inputs',{'parent':{'path':str(parent),'sha256':sha(parent.read_bytes())},'cases':cases,'executableSHA256':sha(exe),'overlayBodySHA256':sha(body),'injections':['Independent per-routine initial DS snapshots and declared synthetic patches.','Sprite vector DS1ff0 redirected to RETF2;resident line4190 and formatter1e67 replaced with preserving RETF observers;private color pointer.','Private CS/DS/SS/SP;IF/DF clear;healthy stack threshold.'],'scope':'No original machine checkpoint or continuous game replay;no fitted timing inputs.'})
bridge=Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']);sys.path.insert(0,str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.lifecycle import InstanceManager
from dosbox_mcp.client import DosboxClient
with socket.socket() as s:s.bind(('127.0.0.1',a.port))
cfg=replace(Config.load(),port=a.port,base_url=f'http://127.0.0.1:{a.port}',headless=True,mute=True);clients=[]
def attach(url,token):
 c=DosboxClient(url,token);clients.append(c);return c.get('/api/v1/dosbox/info')
manager=InstanceManager(cfg,attach=attach);stop=None;index=None;trace=[];copies=[]
def identity(path):
 b=path.read_bytes();return {'path':str(path),'bytes':len(b),'sha256':sha(b)}
save('configuration',{'binary':identity(cfg.binary),'bridgeFiles':[identity(bridge/'dosbox_mcp'/name) for name in ['config.py','lifecycle.py','client.py']],'argv':manager.build_argv(),'headless':cfg.headless,'mute':cfg.mute,'protocol':cfg.protocol,'port':cfg.port,'isolatedConfiguration':True,'environment':{'SDL_VIDEODRIVER':'dummy','SDL_AUDIODRIVER':'dummy','HOME':'private InstanceManager directory','XDG_CONFIG_HOME':'private InstanceManager directory'},'cpuConfiguration':'Pinned binary defaults;normal core independently asserted from engine capabilities. No elapsed-time comparison.','interrupts':'IF/DF cleared by each wrapper;private DS=SS;stack threshold zero.','mounts':'No disks mounted;original relocated bytes injected into owned conventional allocations.'})
try:
 info=manager.start();c=clients[-1];save('engine',info);assert info['pid']==manager.pid
 c.post('/api/v1/debug/pause');stop=c.get('/api/v1/debug/status')['stop'];assert not stop['protected_mode']
 allocations=[c.post('/api/v1/memory/allocate',json={'size':65535,'area':'CONV'}) for _ in range(3)];save('allocations',allocations);assert all(x['addr']%16==0 for x in allocations);codeSeg,dataSeg,jumpSeg=[x['addr']>>4 for x in allocations]
 def write(seg,offset,data):return {'op':'mem_write','segment':seg,'offset':offset,'data':base64.b64encode(data).decode()}
 def batch(ops):
  r=c.post('/api/v1/batch',json={'ops':ops});assert not r['aborted'] and all(x['status']=='ok' for x in r['results']);return r
 word=lambda data,at:struct.unpack_from('<H',data,at)[0]
 program=bytearray(image[:0xc170])+bytearray(body);cursor=word(exe,8)*16+word(exe,22)*16+0x125
 for region in range(16):
  count=word(exe,cursor);cursor+=2
  for _ in range(count):
   at=word(exe,cursor)+region*65536;cursor+=2
   if at<0xc170:struct.pack_into('<H',program,at,(word(program,at)+codeSeg)&65535)
 assert cursor==(word(exe,4)-1)*512+(word(exe,2) or 512)
 assert word(overlay,6)==68
 for i in range(word(overlay,6)):
  off,seg=struct.unpack_from('<HH',overlay,word(overlay,24)+i*4);at=seg*16+off;assert 0xc170<=at<len(program)-1;struct.pack_into('<H',program,at,(word(program,at)+codeSeg)&65535)
 program[0x4190]=0xcb;program[0x1e67]=0xcb
 batch([write(codeSeg,0,program),write(codeSeg,0xf100,b'\xca\x02\x00')])
 c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':codeSeg+0xc17,'offset':0x1744})
 for index,(event,initial) in enumerate(zip(cases,initials)):
  data=bytearray(initial[:65535])
  for at,width,value in event['patches']:
   if width==1:data[at]=value&255
   else:struct.pack_into('<H',data,at,value&65535)
  struct.pack_into('<HH',data,0x1ff0,0xf100,codeSeg);struct.pack_into('<H',data,0x295c,0);struct.pack_into('<HH',data,0x2034,0x3000,dataSeg);data[0x3000]=14
  wrapper=b'\xfa\xfc\x9a'+struct.pack('<HH',0x1744,codeSeg+0xc17)+b'\xeb\xfe';returned=0xf207
  ip=stop['registers']['eip'];assert ip+6<65535
  batch([write(dataSeg,0,data),write(codeSeg,0xf200,wrapper),write(jumpSeg,ip,b'\xfa\xea\x00\xf2'+struct.pack('<H',codeSeg)),*[{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',jumpSeg),('ds',dataSeg),('es',dataSeg),('ss',dataSeg),('esp',0xfef0)]]])
  c.post('/api/v1/debug/step',json={'count':2});old=c.get('/api/v1/debug/status')['stop']['stop_id'];c.post('/api/v1/debug/continue');stop=c.get('/api/v1/debug/wait',params={'since_stop_id':old,'timeout_ms':15000},timeout=20)
  assert stop['satisfied'] and stop['registers']['cs']==codeSeg+0xc17 and stop['registers']['eip']==0x1744
  entry=stop;trace=[];copies=[]
  for _ in range(20000):
   r=stop['registers'];at=(r['cs']-codeSeg)*16+r['eip'];assert not r['flags']&0x600
   if at==returned:break
   assert 0x5f7e<=at<0x5f91 or 0xd8b4<=at<0xda0e or at in [0xf100,0x4190,0x1e67],hex(at)
   trace.append(at)
   if at in [0xf100,0x4190,0x1e67]:
    kind,count={0xf100:('draw',1),0x4190:('line',4),0x1e67:('number',7)}[at]
    raw=batch([{'op':'mem_read','segment':dataSeg,'offset':r['esp']+4,'len':count*2},{'op':'mem_read','segment':dataSeg,'offset':0x3000,'len':1}]);call={'kind':kind,'args':list(struct.unpack('<'+str(count)+'H',base64.b64decode(raw['results'][0]['data'])))}
    if kind=='line':call['color']=base64.b64decode(raw['results'][1]['data'])[0]
    copies.append(call)
   result=c.post('/api/v1/debug/step',json={'count':1});assert result['status']=='ok';stop=result['stop']
  else:raise AssertionError('Unfinished native HUD helper')
  assert stop['registers']['esp']==0xfef0
  after=batch([{'op':'mem_read','segment':dataSeg,'offset':0,'len':65535},{'op':'mem_read','segment':codeSeg,'offset':0,'len':len(program)}]);assert base64.b64decode(after['results'][1]['data'])==program,'Original mountain code changed'
  save(f'case-{index:02}',{'index':index,'input':event,'entry':entry,'trace':trace,'calls':copies,'final':stop,'after':after});print(json.dumps({'case':index,'id':event['id'],'calls':len(copies)}),flush=True)
 save('capture',{'completed':True,'caseCount':len(cases),'sourceSHA256':sha(source),'executableSHA256':sha(exe),'overlayBodySHA256':sha(body),'codeSegment':codeSeg,'dataSegment':dataSeg,'jumpSegment':jumpSeg,'programSHA256':sha(program),'programBytes':len(program),'pid':manager.pid,'instanceId':info['instance_id'],'stackScratch':[0xfeb0,0xfef0],'scope':'Conditional original HUD with declared line/number/sprite effect stubs. No primitive execution,pixels,natural cadence or whole-machine restore.'})
except BaseException as error:save('capture-failure',{'case':index,'error':repr(error),'stop':stop,'trace':trace,'calls':copies});raise
finally:
 if manager.running:manager.stop()
 for c in clients:c.close()
