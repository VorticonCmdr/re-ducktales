"""Conditional original-driver calls on an isolated DOSBox instance.
Unpatched resource5;manual IRQ schedule,IF clear,private IRET chain stand-in.
This is not a natural machine checkpoint or a waveform comparison.
"""
import argparse,base64,hashlib,json,os,re,socket,struct,subprocess,sys,time
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--port',type=int,default=8391);a=p.parse_args()
out=(ROOT/a.output).resolve();assert out.is_relative_to((ROOT/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
bridge=Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']).resolve();sys.path.insert(0,str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.lifecycle import InstanceManager
from dosbox_mcp.client import DosboxClient
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,d):(out/(name+'.json')).write_text(json.dumps(d,indent=2)+'\n')
code="import{readFile}from'node:fs/promises';import{parseArchive}from'./src/assets.js';process.stdout.write(Buffer.from(parseArchive(await readFile('game/IT.DRV'),'IT.DRV')[5].data).toString('base64'));"
driver=base64.b64decode(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT))
assert len(driver)==7253 and sha(driver)=='131133fb9137d6ef39db079cf81986110244a41e43efcfbf34ef0e347b5a9c33'
cfg=replace(Config.load(),port=a.port,base_url=f'http://127.0.0.1:{a.port}',headless=True,mute=True)
assert a.port!=8386
with socket.socket() as s:s.bind(('127.0.0.1',a.port))
clients=[]
def attach(url,token):
 assert url==cfg.base_url
 c=DosboxClient(url,token);clients.append(c);info=c.get('/api/v1/dosbox/info');assert info['pid']==manager.pid;return info
manager=InstanceManager(cfg,attach=attach)
schedule=[{'reset':True},{'request':8},{'request':9},{'irqs':24},{'request':0x3808},{'irqs':300},{'request':0x1808},{'irqs':36},{'request':0x8008},{'irqs':24},{'request':0},{'irqs':24}]
save('inputs',{'initialPort61Control':0,'schedule':schedule,'scope':'Inputs are authored independently of expected results.'})
owned=set();records=[]
try:
 info=manager.start();client=clients[-1];save('engine',info)
 client.post('/api/v1/debug/pause');state=client.get('/api/v1/debug/status');assert state['debugging'];stop=state['stop'];assert not stop['protected_mode']
 allocation=client.post('/api/v1/memory/allocate',json={'size':65535,'area':'CONV'});save('allocation',allocation);seg=allocation['addr']>>4;assert allocation['addr']%16==0
 def batch(ops):
  r=client.post('/api/v1/batch',json={'ops':ops});assert not r['aborted'] and len(r['results'])==len(ops);assert all(x['status']=='ok' for x in r['results']);return r
 def write(offset,data):return {'op':'mem_write','segment':seg,'offset':offset,'data':base64.b64encode(data).decode()}
 body=bytearray(65535);body[:len(driver)]=driver
 struct.pack_into('<HHHH',body,0x288,0x4300,seg,0x5000,seg);body[0x4300]=0xcf;body[0x4100:0x4102]=b'\xeb\xfe'
 batch([write(0,body),{'op':'port_write','port':0x61,'value':0}])
 # Ground every execute breakpoint in a decoded original OUT instruction.
 outs={}
 for lo,hi in [(0x2a8,0x47c),(0x576,0x8cb)]:
  part=out/f'code-{lo:x}.bin';part.write_bytes(driver[lo:hi])
  asm=subprocess.check_output(['ndisasm','-b','16','-o',hex(lo),str(part)],text=True)
  for line in asm.splitlines():
   m=re.match(r'([0-9A-F]+)\s+(E6[0-9A-F]{2})\s+out byte 0x([0-9a-f]+),al',line)
   if m:outs[int(m[1],16)]=int(m[3],16)
 assert {0x20,0x42,0x61}.issubset(set(outs.values()))
 for ip in [0x4100,*outs]:
  b=client.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':seg,'offset':ip});owned.add(b['id'])
 def call(event):
  global stop
  wrapper=bytearray(b'\xfa')
  if 'request' in event:
   wrapper+=b'\xb8'+struct.pack('<H',event['request'])+b'\x50\x9a\x08\x04'+struct.pack('<H',seg)+b'\x83\xc4\x02'
  elif 'reset' in event:wrapper+=b'\xe8'+struct.pack('<H',(0x576-(0x4000+len(wrapper)+3))&65535)
  else:wrapper+=b'\x9c\x9a\xa8\x02'+struct.pack('<H',seg)
  wrapper+=b'\xe9'+struct.pack('<H',(0x4100-(0x4000+len(wrapper)+3))&65535)
  ip=stop['registers']['eip'];assert 0x8000+ip+6<65535
  ops=[write(0x4000,wrapper),write(0x8000+ip,b'\xfa\xea\x00\x40'+struct.pack('<H',seg))]
  ops += [{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',seg+0x800),('ds',seg),('es',seg),('ss',seg),('esp',0xfef0)]]
  batch(ops);client.post('/api/v1/debug/step',json={'count':2});stop=client.get('/api/v1/debug/status')['stop'];assert stop['registers']['cs']==seg and stop['registers']['eip']==0x4000
  io=[]
  for _ in range(2000):
   old=stop['stop_id'];r=client.post('/api/v1/debug/continue');assert r['resumed_from_stop_id']==old
   stop=client.get('/api/v1/debug/wait',params={'since_stop_id':old,'timeout_ms':15000},timeout=20)
   assert stop['satisfied'] and stop['breakpoint']['id'] in owned and not stop['protected_mode']
   ip=stop['registers']['eip'];assert stop['registers']['cs']==seg
   if ip==0x4100:break
   assert ip in outs;io.append({'ip':ip,'port':outs[ip],'value':stop['registers']['eax']&255})
  else:raise AssertionError('Unfinished native driver call')
  assert stop['registers']['esp']==0xfef0
  return io
 for index,event in enumerate(schedule):
  io=[]
  for _ in range(event.get('irqs',1)):io+=call({'irq':True} if 'irqs' in event else event)
  state=batch([{'op':'cpu_read'},{'op':'mem_read','segment':seg,'offset':0,'len':7253},{'op':'mem_read','segment':seg,'offset':0x5000,'len':4}])
  record={'index':index,'input':event,'io':io,'state':state};records.append(record);save(f'case-{index:02}',record)
 save('capture',{'completed':True,'segment':seg,'driverSha256':sha(driver),'scriptSha256':sha(Path(__file__).read_bytes()),'engineInstanceId':info['instance_id'],'pid':manager.pid,'port':a.port,'caseCount':len(records),'irqCount':sum(x.get('irqs',0) for x in schedule),'injections':['Private allocated driver copy and call/IRQ wrappers;original driver instructions remain unpatched.','IF disabled;manually invoked IRQs;old-handler vector points to a private IRET.','Clock pointer addresses a private zero-initialized dword.'],'comparisonRules':'All7253 driver bytes and private clock exact;all PIT/PIC OUT bytes exact. Port61 OUT comparison uses control bits0/1 only;hardware status/refresh bits are excluded.','partialRestore':False,'naturalMachineCheckpoint':False})
 print(json.dumps({'completed':True,'cases':len(records),'output':str(out)}),flush=True)
finally:
 if manager.running:manager.stop()
 for c in clients:c.close()
