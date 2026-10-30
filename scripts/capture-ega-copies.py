"""Original signed-copy work on a private DOSBox. RAM surfaces, not pixels/time.
Inputs are independently declared; REP stepping is recorded, never fitted.
"""
import argparse,base64,hashlib,json,os,socket,struct,subprocess,sys
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--port',type=int,default=8400);a=p.parse_args();assert a.port!=8386
out=Path(a.output);assert out.resolve().is_relative_to((ROOT/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,v):(out/(n+'.json')).write_text(json.dumps(v,indent=2)+'\n')
source=Path(__file__).read_bytes();(out/'capture-source.py').write_bytes(source)
js="import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'),'IT.DRV')[1].data).toString('base64'));"
driver=base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',js]));assert len(driver)==2599
# [width,height,sourceY,destinationY,sourceX,destinationX,sourceVideo,destinationVideo]
raw=[[8,1,0,0,0,0,False,True],[16,16,-12,-12,0,0,False,True],
 [128,128,-30,-30,0,0,False,True],[8,8,-56,-56,0,0,False,True],
 [320,8,-56,-56,0,0,False,True],[320,168,0,0,0,0,False,True],
 [16,16,1,1,-8,319,False,True],[16,16,0,198,0,0,False,True],
 [16,16,0,200,0,0,False,True],[16,16,0,201,0,0,False,True],
 [7,3,0,0,0,0,False,True],[9,2,1,1,0,0,False,False],
 [24,2,-1,0,0,0,True,False],[24,2,0,1,0,0,True,True],
 [16,16,0,32767,0,0,False,True],[16,16,0,-32768,0,0,False,True]]
keys=['width','height','sourceY','destinationY','sourceX','destinationX','sourceVideo','destinationVideo']
cases=[dict(zip(keys,v),sourceStrideBytes=40,destinationStrideBytes=40) for v in raw]
save('inputs',{'driverSHA256':sha(driver),'cases':cases,'scope':'Authored call arguments;no expected counts,final state or time feeds native execution.'})
bridge=Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']);sys.path.insert(0,str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.lifecycle import InstanceManager
from dosbox_mcp.client import DosboxClient
cfg=replace(Config.load(),port=a.port,base_url=f'http://127.0.0.1:{a.port}',headless=True,mute=True)
with socket.socket() as s:s.bind(('127.0.0.1',a.port))
clients=[]
def attach(url,token):
 c=DosboxClient(url,token);clients.append(c);return c.get('/api/v1/dosbox/info')
manager=InstanceManager(cfg,attach=attach)
def identity(path):
 b=path.read_bytes();return {'path':str(path),'bytes':len(b),'sha256':sha(b)}
save('configuration',{'binary':identity(cfg.binary),'bridgeFiles':[identity(bridge/'dosbox_mcp'/name) for name in ['config.py','lifecycle.py','client.py']],'argv':manager.build_argv(),'headless':True,'mute':True,'protocol':cfg.protocol,'port':a.port,'isolatedConfiguration':True,'environment':{'SDL_VIDEODRIVER':'dummy','SDL_AUDIODRIVER':'dummy','HOME':'private manager directory','XDG_CONFIG_HOME':'private manager directory'},'cpuConfiguration':'Pinned binary defaults;normal core asserted independently. No elapsed-time comparison.','scope':'Private far calls with IF/DF clear;RAM source/destination stand-ins;no machine checkpoint.'})
stop=None;index=None;trace=[];ports=[]
try:
 info=manager.start();c=clients[-1];assert info['pid']==manager.pid;save('engine',info);assert info['capabilities']['debugger']['limits']['effective_core']=='normal'
 c.post('/api/v1/debug/pause');stop=c.get('/api/v1/debug/status')['stop'];assert not stop['protected_mode']
 allocations=[c.post('/api/v1/memory/allocate',json={'size':65535,'area':'CONV'}) for _ in range(4)];save('allocations',allocations);assert all(x['addr']%16==0 for x in allocations)
 seg,sourceSeg,destSeg,jumpSeg=[x['addr']>>4 for x in allocations]
 def write(segment,offset,data):return {'op':'mem_write','segment':segment,'offset':offset,'data':base64.b64encode(data).decode()}
 def batch(ops):
  r=c.post('/api/v1/batch',json={'ops':ops});assert not r['aborted'] and all(x['status']=='ok' for x in r['results']);return r
 c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':seg,'offset':0x1ef})
 for index,event in enumerate(cases):
  body=bytearray(65535);body[:len(driver)]=driver;struct.pack_into('<H',body,0x1e,0x2000)
  # Active descriptor2000;inactive descriptor2020/2040. Descriptor identity
  # controls native branch selection;each far pointer targets private RAM.
  fromHandle=0x2000 if event['sourceVideo'] else 0x2020
  toHandle=0x2000 if event['destinationVideo'] else 0x2040
  for handle,target in [(0x2000,destSeg),(0x2020,sourceSeg),(0x2040,destSeg)]:
   struct.pack_into('<H',body,handle,40);struct.pack_into('<HHH',body,handle+4,0x1000,target,8000)
  args=[event['height'],event['width'],event['destinationY'],event['destinationX'],toHandle,event['sourceY'],event['sourceX'],fromHandle]
  wrapper=bytearray(b'\xfa\xfc')
  for word in reversed(args):wrapper+=b'\x68'+struct.pack('<H',word&65535)
  wrapper+=b'\x9a'+struct.pack('<HH',0x1ef,seg);returned=0x4000+len(wrapper);wrapper+=b'\xeb\xfe';body[0x4000:0x4000+len(wrapper)]=wrapper
  ip=stop['registers']['eip'];assert ip+6<65535
  batch([write(seg,0,body),write(jumpSeg,ip,b'\xfa\xea\x00\x40'+struct.pack('<H',seg)),*[{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',jumpSeg),('ds',seg),('es',seg),('ss',seg),('esp',0xfef0)]]])
  c.post('/api/v1/debug/step',json={'count':2});old=c.get('/api/v1/debug/status')['stop']['stop_id'];c.post('/api/v1/debug/continue');stop=c.get('/api/v1/debug/wait',params={'since_stop_id':old,'timeout_ms':15000},timeout=20)
  assert stop['satisfied'] and stop['registers']['cs']==seg and stop['registers']['eip']==0x1ef
  entry=stop;trace=[];ports=[]
  for _ in range(100000):
   r=stop['registers'];ip=r['eip'];assert r['cs']==seg and not r['flags']&0x600
   if ip==returned:break
   assert 0x1ef<=ip<0x35d
   trace.append([ip,r['ecx']&65535])
   if driver[ip]==0xef:ports.append({'ip':ip,'port':r['edx']&65535,'word':r['eax']&65535})
   result=c.post('/api/v1/debug/step',json={'count':1});assert result['status']=='ok';stop=result['stop']
  else:raise AssertionError('Unfinished native copy')
  assert stop['registers']['esp']==0xfef0
  state=batch([{'op':'mem_read','segment':seg,'offset':0,'len':len(driver)}])
  save(f'case-{index:02}',{'index':index,'input':event,'args':args,'entry':entry,'trace':trace,'ports':ports,'final':stop,'driver':state})
  print(json.dumps({'case':index,'steps':len(trace),'ports':len(ports)}),flush=True)
 save('capture',{'completed':True,'caseCount':len(cases),'driverSHA256':sha(driver),'captureToolSHA256':sha(source),'segment':seg,'sourceSegment':sourceSeg,'destinationSegment':destSeg,'jumpSegment':jumpSeg,'pid':manager.pid,'instanceId':info['instance_id'],'scope':'Original opcode/OUT/REP execution with private RAM targets. Self-modifying driver operands checked separately;not EGA pixels,natural timing or machine restore.'})
except BaseException as error:save('capture-failure',{'case':index,'error':repr(error),'stop':stop,'trace':trace,'ports':ports});raise
finally:
 if manager.running:manager.stop()
 for c in clients:c.close()
