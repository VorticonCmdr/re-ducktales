"""Observe original mountain erase call plans with an explicit copy-effect stub.
Conditional routine inputs,not natural timing,pixels or a machine checkpoint.
"""
from pathlib import Path
from dataclasses import replace
import argparse,base64,hashlib,json,os,socket,struct,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--port',type=int,default=8398);a=p.parse_args();assert a.port!=8386
out=Path(a.output);assert out.resolve().is_relative_to((ROOT/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,value):(out/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
source=Path(__file__).read_bytes();(out/'capture-source.py').write_bytes(source)
parent=Path('reference/mountain-draw-work.json');manifest=json.loads(parent.read_text());cases=[];initials=[]
for i in range(14):
 role=f'frame-{i:02}-before-erase';spec=manifest['artifacts'][role];b=Path(spec['path']).read_bytes();assert sha(b)==spec['sha256'];r=json.loads(b);assert not r['state']['aborted'];assert all(x['status']=='ok' for x in r['state']['results']);data=base64.b64decode(r['state']['results'][1]['data']);assert len(data)==65536
 bp=r['state']['results'][0]['registers']['ebp']&65535;first=data[(bp-0x34)&65535];cases.append({'id':role,'initial':spec,'firstRow':first,'patches':[]});initials.append(data)
base=initials[0];page=struct.unpack_from('<H',base,0x370a)[0];assert page in [0,1];hazards=struct.unpack_from('<H',base,0x5d26)[0]
def variant(name,first,patches):cases.append({'id':name,'initial':cases[0]['initial'],'firstRow':first,'patches':patches});initials.append(base)
variant('forced-page-restore',0,[[0x4cf2,2,1]])
variant('old-action5',0,[[0x3706+page*2,2,5]])
variant('old-action6',0,[[0x3706+page*2,2,6]])
variant('wide-actor21',0,[[0x3734+page*2,2,21],[0x36ea+page*2,2,8],[0x36ee+page*2,2,10]])
variant('wide-actor27-right',0,[[0x3734+page*2,2,27],[0x36ea+page*2,2,319],[0x36ee+page*2,2,100]])
variant('all-row-types',0,[[hazards+r*6,1,t] for r,t in enumerate([2,3,4,6,9])]+[[hazards+2*6+1,1,0],[hazards+4*6+1,1,1]])
variant('row-type4-state1',0,[[hazards,1,4],[hazards+1,1,1]])
variant('row-type4-state3',0,[[hazards,1,4],[hazards+1,1,3]])
variant('row-type4-state4',0,[[hazards,1,4],[hazards+1,1,4]])
variant('enemy2-other-facing',0,[[hazards,1,2],[hazards+1,1,10]])
for state in [0,1,2,4,5]:variant(f'cloud-{state}-right',2,[[0x17db,1,state],[0x17dc,2,319]])
for state in [0,1,2,3]:variant(f'rock-{state}-bottom',0,[[0x17e1,1,state],[0x17e2,2,319],[0x3742,2,0],[0x3744,2,-30]])
variant('rock-top-left',22,[[0x17e1,1,1],[0x17e2,2,0],[0x3742,2,25],[0x3744,2,0]])
assert len(cases)==34
js="import{readFile}from'node:fs/promises';import{originalGame}from'./tests/helpers/original-game.js';const{image}=await originalGame();console.log(JSON.stringify({image:Buffer.from(image).toString('base64'),exe:Buffer.from(await readFile('game/DUCKTALE.EXE')).toString('base64')}));"
assets=json.loads(subprocess.check_output(['node','--input-type=module','-e',js]));image=base64.b64decode(assets['image']);exe=base64.b64decode(assets['exe']);overlay=exe[0x17600:0x17600+12514];body=overlay[512:];assert len(body)==12002 and sha(body)=='b50591460d43e848d52b49ee7b843065413d877dca8dc75455ce7dca2a7f2bd0'
save('inputs',{'parent':{'path':str(parent),'sha256':sha(parent.read_bytes())},'cases':cases,'executableSHA256':sha(exe),'overlayBodySHA256':sha(body),'injections':['Independent per-routine initial DS snapshots and declared synthetic patches.','Copy vector DS1fec redirected to a volatile-register-preserving RETF16 observer.','Private CS/DS/SS/SP;IF/DF clear;healthy stack threshold.'],'scope':'No original machine checkpoint or continuous game replay;no fitted timing inputs.'})
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
 batch([write(codeSeg,0,program),write(codeSeg,0xf100,b'\xca\x10\x00')])
 c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':codeSeg+0xc17,'offset':0x156a})
 for index,(event,initial) in enumerate(zip(cases,initials)):
  data=bytearray(initial[:65535])
  for at,width,value in event['patches']:
   if width==1:data[at]=value&255
   else:struct.pack_into('<H',data,at,value&65535)
  struct.pack_into('<HH',data,0x1fec,0xf100,codeSeg);struct.pack_into('<H',data,0x295c,0)
  wrapper=b'\xfa\xfc\x68'+struct.pack('<H',event['firstRow'])+b'\x9a'+struct.pack('<HH',0x156a,codeSeg+0xc17)+b'\xeb\xfe';returned=0xf20a
  ip=stop['registers']['eip'];assert ip+6<65535
  batch([write(dataSeg,0,data),write(codeSeg,0xf200,wrapper),write(jumpSeg,ip,b'\xfa\xea\x00\xf2'+struct.pack('<H',codeSeg)),*[{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',jumpSeg),('ds',dataSeg),('es',dataSeg),('ss',dataSeg),('esp',0xfef0)]]])
  c.post('/api/v1/debug/step',json={'count':2});old=c.get('/api/v1/debug/status')['stop']['stop_id'];c.post('/api/v1/debug/continue');stop=c.get('/api/v1/debug/wait',params={'since_stop_id':old,'timeout_ms':15000},timeout=20)
  assert stop['satisfied'] and stop['registers']['cs']==codeSeg+0xc17 and stop['registers']['eip']==0x156a
  entry=stop;trace=[];copies=[]
  for _ in range(20000):
   r=stop['registers'];at=(r['cs']-codeSeg)*16+r['eip'];assert not r['flags']&0x600
   if at==returned:break
   assert 0x5f7e<=at<0x5f91 or 0xd6da<=at<0xd7dc or 0xe99a<=at<0xee79 or at==0xf100,hex(at)
   trace.append(at)
   if at==0xf100:
    raw=batch([{'op':'mem_read','segment':dataSeg,'offset':r['esp']+4,'len':16}]);copies.append(list(struct.unpack('<8H',base64.b64decode(raw['results'][0]['data']))))
   result=c.post('/api/v1/debug/step',json={'count':1});assert result['status']=='ok';stop=result['stop']
  else:raise AssertionError('Unfinished native erase helper')
  assert stop['registers']['esp']==0xfeee
  after=batch([{'op':'mem_read','segment':dataSeg,'offset':0,'len':65535},{'op':'mem_read','segment':codeSeg,'offset':0,'len':len(program)}]);assert base64.b64decode(after['results'][1]['data'])==program,'Original mountain code changed'
  save(f'case-{index:02}',{'index':index,'input':event,'entry':entry,'trace':trace,'copies':copies,'final':stop,'after':after});print(json.dumps({'case':index,'id':event['id'],'copies':len(copies)}),flush=True)
 save('capture',{'completed':True,'caseCount':len(cases),'sourceSHA256':sha(source),'executableSHA256':sha(exe),'overlayBodySHA256':sha(body),'codeSegment':codeSeg,'dataSegment':dataSeg,'jumpSegment':jumpSeg,'programSHA256':sha(program),'programBytes':len(program),'pid':manager.pid,'instanceId':info['instance_id'],'stackScratch':[0xfeb0,0xfef0],'scope':'Conditional original erase helper with copy-effect stub. No original copy primitive,graphics pixels,natural cadence or whole-machine restore.'})
except BaseException as error:save('capture-failure',{'case':index,'error':repr(error),'stop':stop,'trace':trace,'copies':copies});raise
finally:
 if manager.running:manager.stop()
 for c in clients:c.close()
