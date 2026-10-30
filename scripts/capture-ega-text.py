"""Conditional unpatched EGA transparent text primitive on an owned private DOSBox.
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
jsfont="import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/MAIN.ARC'),'MAIN.ARC')[42].data).toString('base64'));"
font=base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',jsfont]));assert len(font)==2056 and font[:8]==bytes.fromhex('aa55080008000800')
cases=[{'text':'0','x':x,'y':10,'color':14,'surfaceOffset':0,'backPage':False} for x in range(8)]
cases += [{'text':text,'x':x,'y':y,'color':color,'surfaceOffset':offset,'backPage':page} for text,x,y,color,offset,page in [('',0,0,0,0,False),('44',159,180,14,0,False),('24',14,185,0,0,False),('123',7,10,6,1,False),('12',0,10,4,0,True),('A\0B',-1,0,15,0,False)]]
entries={'transparent':0x81f};save('inputs',{'driverSHA256':sha(driver),'fontSHA256':sha(font),'cases':cases,'scope':'Independent authored arguments and original unmodified MAIN42 font;no expected state or fitted timer.'})
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
 body=bytearray(65535);body[:len(driver)]=driver;struct.pack_into('<H',body,0x1e,0x2000);struct.pack_into('<H',body,0x22,0x2020);struct.pack_into('<HH',body,0x2004,0,seg+0x600);body[0x3000:0x3000+len(font)]=font;batch([write(0,body)])
 for entry in entries.values():c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':seg,'offset':entry})
 for i,event in enumerate(cases):
  entry=0x81f;batch([write(0x3800,event['text'].encode('latin1')+b'\0'),write(0x2020,bytes([event['backPage']])),write(0x2004,struct.pack('<HH',event['surfaceOffset'],seg+0x600))]);args=[event['color'],event['y'],event['x'],0x3800,0x3000,seg];wrapper=bytearray(b'\xfa\xfc')
  for word in reversed(args):wrapper+=b'\x68'+struct.pack('<H',word&65535)
  wrapper+=b'\x9a'+struct.pack('<HH',entry,seg);returned=0x4000+len(wrapper);wrapper+=b'\xeb\xfe'
  ip=stop['registers']['eip'];assert 0x8000+ip+6<65535
  batch([write(0x4000,wrapper),write(0x8000+ip,b'\xfa\xea\x00\x40'+struct.pack('<H',seg)),*[{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',seg+0x800),('ds',seg),('es',seg),('ss',seg),('esp',0xfef0)]]])
  c.post('/api/v1/debug/step',json={'count':2});old=c.get('/api/v1/debug/status')['stop']['stop_id'];c.post('/api/v1/debug/continue');stop=c.get('/api/v1/debug/wait',params={'since_stop_id':old,'timeout_ms':15000},timeout=20)
  assert stop['satisfied'] and stop['registers']['cs']==seg and stop['registers']['eip']==entry
  trace=[];ports=[]
  for n in range(20000):
   r=stop['registers'];ip=r['eip'];assert r['cs']==seg and not r['flags']&0x600
   if ip==returned:break
   assert 0x81f<=ip<0x909
   trace.append(ip)
   if driver[ip]==0xef:ports.append({'ip':ip,'port':r['edx']&65535,'word':r['eax']&65535})
   result=c.post('/api/v1/debug/step',json={'count':1});assert result['status']=='ok';stop=result['stop']
  else:raise AssertionError('Unfinished native text')
  if stop['registers']['esp']!=0xfef0:save('failed-stack',{'case':i,'stop':stop,'trace':trace,'ports':ports})
  assert stop['registers']['esp']==0xfef0,stop['registers']
  state=batch([{'op':'mem_read','segment':seg,'offset':0,'len':len(driver)}])
  save(f'case-{i:02}',{'index':i,'input':event,'trace':trace,'ports':ports,'final':stop,'driver':state})
  print(json.dumps({'case':i,'x':event['x'],'instructions':len(trace),'ports':len(ports)}),flush=True)
 save('capture',{'completed':True,'caseCount':len(cases),'driverSHA256':sha(driver),'fontSHA256':sha(font),'captureToolSHA256':sha(Path(__file__).read_bytes()),'segment':seg,'pid':manager.pid,'instanceId':info['instance_id'],'scope':'Original opcode/OUT counts under IF/DF clear in fresh private allocation. Original font and a RAM target nonbranching write stand-in;not EGA pixels,natural timing or machine restore.'})
finally:
 if manager.running:manager.stop()
 for c in clients:c.close()
