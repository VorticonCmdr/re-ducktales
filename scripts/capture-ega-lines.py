"""Conditional unpatched EGA line primitives on an owned private DOSBox.
Counts single-stepped original opcodes. RAM write stand-in;not pixel/cadence evidence.
"""
import argparse,base64,hashlib,json,os,socket,struct,subprocess,sys
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--port',type=int,default=8394);a=p.parse_args()
out=Path(a.output);assert out.resolve().is_relative_to((ROOT/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
bridge=Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']);sys.path.insert(0,str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.lifecycle import InstanceManager
from dosbox_mcp.client import DosboxClient
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,v):(out/(n+'.json')).write_text(json.dumps(v,indent=2)+'\n')
js="import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'),'IT.DRV')[1].data).toString('base64'));"
driver=base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',js]));assert len(driver)==2599
(out/'capture-source.py').write_bytes(Path(__file__).read_bytes())
# Direct far-call words in BP+6 order. Independent authored cases,not fitted counts.
cases=[{'kind':'point','args':v} for v in [[10,12],[-1,12],[200,12],[10,-1],[10,320]]]
cases += [{'kind':'vertical','args':v} for v in [[15,12,10],[12,15,10],[2,-3,10],[205,198,10],[8,4,-1],[8,4,320],[-1,-5,10],[210,205,10]]]
cases += [{'kind':'horizontal','args':v} for v in [[10,12,15],[10,15,12],[10,-3,2],[10,315,325],[-1,4,8],[200,4,8],[10,-5,-1],[10,325,330],[10,0,319],[10,8,15],[10,7,7],[10,7,8]]]
# axis,major direction,minor direction,count,2major,2minor,y,x
cases += [{'kind':'diagonal','args':v} for v in [[1,1,1,7,14,6,10,12],[1,-1,-1,7,14,6,10,12],[0,1,1,7,14,6,10,12],[0,-1,-1,7,14,6,10,12],[1,1,-1,7,14,14,10,12],[1,1,1,7,14,6,-2,-2],[0,1,-1,7,14,6,198,318]]]
entries={'point':0x515,'vertical':0x69b,'horizontal':0x73f,'diagonal':0x589};save('inputs',{'driverSHA256':sha(driver),'cases':cases,'scope':'Independent original far-call arguments;no expected state or timer data.'})
cfg=replace(Config.load(),port=a.port,base_url=f'http://127.0.0.1:{a.port}',headless=True,mute=True);assert a.port!=8386
with socket.socket() as s:s.bind(('127.0.0.1',a.port))
clients=[]
def attach(url,token):
 c=DosboxClient(url,token);clients.append(c);return c.get('/api/v1/dosbox/info')
manager=InstanceManager(cfg,attach=attach)
try:
 info=manager.start();c=clients[-1];assert info['pid']==manager.pid;save('engine',info)
 c.post('/api/v1/debug/pause');stop=c.get('/api/v1/debug/status')['stop'];assert not stop['protected_mode']
 allocation=c.post('/api/v1/memory/allocate',json={'size':65535,'area':'CONV'});save('allocation',allocation);seg=allocation['addr']>>4;assert allocation['addr']%16==0
 def write(offset,data):return {'op':'mem_write','segment':seg,'offset':offset,'data':base64.b64encode(data).decode()}
 def batch(ops):
  r=c.post('/api/v1/batch',json={'ops':ops});assert not r['aborted'] and all(x['status']=='ok' for x in r['results']);return r
 body=bytearray(65535);body[:len(driver)]=driver;struct.pack_into('<H',body,0x1e,0x2000);body[0x24]=6;struct.pack_into('<HH',body,0x2004,0x6000,seg);batch([write(0,body)])
 for entry in entries.values():c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':seg,'offset':entry})
 for i,event in enumerate(cases):
  entry=entries[event['kind']];wrapper=bytearray(b'\xfa\xfc')
  for word in reversed(event['args']):wrapper+=b'\x68'+struct.pack('<H',word&65535)
  wrapper+=b'\x9a'+struct.pack('<HH',entry,seg);returned=0x4000+len(wrapper);wrapper+=b'\xeb\xfe'
  ip=stop['registers']['eip'];assert 0x8000+ip+6<65535
  batch([write(0x4000,wrapper),write(0x8000+ip,b'\xfa\xea\x00\x40'+struct.pack('<H',seg)),*[{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',seg+0x800),('ds',seg),('es',seg),('ss',seg),('esp',0xfef0)]]])
  c.post('/api/v1/debug/step',json={'count':2});old=c.get('/api/v1/debug/status')['stop']['stop_id'];c.post('/api/v1/debug/continue');stop=c.get('/api/v1/debug/wait',params={'since_stop_id':old,'timeout_ms':15000},timeout=20)
  assert stop['satisfied'] and stop['registers']['cs']==seg and stop['registers']['eip']==entry
  trace=[];ports=[]
  for n in range(20000):
   r=stop['registers'];ip=r['eip'];assert r['cs']==seg and not r['flags']&0x600
   if ip==returned:break
   assert entry<=ip<{'point':0x589,'vertical':0x73f,'horizontal':0x81f,'diagonal':0x69b}[event['kind']]
   trace.append(ip)
   if driver[ip]==0xef:ports.append({'ip':ip,'port':r['edx']&65535,'word':r['eax']&65535})
   result=c.post('/api/v1/debug/step',json={'count':1});assert result['status']=='ok';stop=result['stop']
  else:raise AssertionError('Unfinished native line')
  assert stop['registers']['esp']==0xfef0
  state=batch([{'op':'mem_read','segment':seg,'offset':0,'len':len(driver)}])
  save(f'case-{i:02}',{'index':i,'input':event,'trace':trace,'ports':ports,'final':stop,'driver':state})
  print(json.dumps({'case':i,'kind':event['kind'],'instructions':len(trace),'ports':len(ports)}),flush=True)
 save('capture',{'completed':True,'caseCount':len(cases),'driverSHA256':sha(driver),'captureToolSHA256':sha(Path(__file__).read_bytes()),'segment':seg,'pid':manager.pid,'instanceId':info['instance_id'],'scope':'Original opcode/OUT counts under IF/DF clear in fresh private allocation. RAM target is a nonbranching write stand-in;not EGA pixels,natural timing or machine restore.'})
finally:
 if manager.running:manager.stop()
 for c in clients:c.close()
