"""Conditional original numeric formatter calls, on one owned private DOSBox."""
import argparse,base64,hashlib,json,os,socket,struct,subprocess,sys
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--port',type=int,default=8397);a=p.parse_args()
assert a.port!=8386,'Never mutate the shared emulator'
out=Path(a.output);assert out.resolve().is_relative_to((ROOT/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
bridge=Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']);sys.path.insert(0,str(bridge))
from dosbox_mcp.config import Config
from dosbox_mcp.lifecycle import InstanceManager
from dosbox_mcp.client import DosboxClient
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,v):(out/(n+'.json')).write_text(json.dumps(v,indent=2)+'\n')
source=Path(__file__).read_bytes();(out/'capture-source.py').write_bytes(source)
js="import{readFile}from'node:fs/promises';import{originalGame}from'./tests/helpers/original-game.js';const{image,archives}=await originalGame();console.log(JSON.stringify({image:Buffer.from(image).toString('base64'),exe:Buffer.from(await readFile('game/DUCKTALE.EXE')).toString('base64'),driver:Buffer.from(archives.get('IT.DRV')[1].data).toString('base64'),font:Buffer.from(archives.get('MAIN.ARC')[42].data).toString('base64')}));"
assets=json.loads(subprocess.check_output(['node','--input-type=module','-e',js]));image=base64.b64decode(assets['image']);exe=base64.b64decode(assets['exe']);driver=base64.b64decode(assets['driver']);font=base64.b64decode(assets['font']);assert len(image)==87664 and len(driver)==2599 and len(font)==2056
# Authored inputs,independent of translated results. Values cover all decimal,
# signed32 and high-word loop boundaries relevant to the divisor10 formatter.
values=[0,1,9,10,24,44,65535,65536,655359,655360,2147483647,2147483648,4294967295,-1,-10,-2147483648]
cases=[{'value':v,'x':14 if v==24 else 175,'y':185 if v==24 else 180,'color':0 if v==24 else 14,'background':15 if v==24 else 4,'rightAlign':v!=24} for v in values]
save('inputs',{'cases':cases,'executableSHA256':sha(exe),'driverSHA256':sha(driver),'fontSHA256':sha(font),'scope':'Independent values and caller arguments;no expected output or fitted clocks'})
with socket.socket() as s:s.bind(('127.0.0.1',a.port))
cfg=replace(Config.load(),port=a.port,base_url=f'http://127.0.0.1:{a.port}',headless=True,mute=True)
clients=[]
def attach(url,token):
 c=DosboxClient(url,token);clients.append(c);return c.get('/api/v1/dosbox/info')
manager=InstanceManager(cfg,attach=attach);stop=None;trace=[];ports=[];index=None
try:
 info=manager.start();c=clients[-1];assert info['pid']==manager.pid;save('engine',info)
 c.post('/api/v1/debug/pause');stop=c.get('/api/v1/debug/status')['stop'];assert not stop['protected_mode']
 allocations=[c.post('/api/v1/memory/allocate',json={'size':65535,'area':'CONV'}) for _ in range(3)];save('allocations',allocations)
 assert all(v['addr']%16==0 for v in allocations)
 codeSeg,dataSeg,jumpSeg=[v['addr']>>4 for v in allocations]
 def write(seg,offset,data):return {'op':'mem_write','segment':seg,'offset':offset,'data':base64.b64encode(data).decode()}
 def batch(ops):
  r=c.post('/api/v1/batch',json={'ops':ops});assert not r['aborted'] and all(x['status']=='ok' for x in r['results']);return r
 loaded=bytearray(image);word=lambda data,at:struct.unpack_from('<H',data,at)[0]
 cursor=word(exe,8)*16+word(exe,22)*16+0x125
 for region in range(16):
  count=word(exe,cursor);cursor+=2
  for _ in range(count):
   at=word(exe,cursor)+region*65536;cursor+=2;struct.pack_into('<H',loaded,at,(word(loaded,at)+codeSeg)&65535)
 assert cursor==(word(exe,4)-1)*512+(word(exe,2) or 512)
 program=bytearray(0xb000);program[:0x8b26]=loaded[:0x8b26];program[0xa000:0xa000+len(driver)]=driver
 struct.pack_into('<H',program,0xa01e,0x2000);struct.pack_into('<H',program,0xa022,0x2020)
 data=bytearray(65535);data[0x3000:0x3000+len(font)]=font
 struct.pack_into('<HH',data,0x1ef6,0x3000,dataSeg);struct.pack_into('<HH',data,0x2008,0x81f,codeSeg+0xa00)
 struct.pack_into('<HH',data,0x2004,0,dataSeg+0x600);struct.pack_into('<H',data,0x295c,0)
 batch([write(codeSeg,0,program),write(dataSeg,0,data)])
 c.post('/api/v1/debug/breakpoints',json={'type':'execute','segment':codeSeg+0x1c4,'offset':0x227})
 for index,event in enumerate(cases):
  args=[event['x'],event['y'],event['value']&65535,(event['value']>>16)&65535,event['color'],event['background'],int(event['rightAlign'])]
  wrapper=bytearray(b'\xfa\xfc')
  for w in reversed(args):wrapper+=b'\x68'+struct.pack('<H',w&65535)
  wrapper+=b'\x9a'+struct.pack('<HH',0x227,codeSeg+0x1c4);returned=0xc000+len(wrapper);wrapper+=b'\xeb\xfe'
  ip=stop['registers']['eip'];assert ip+6<65535
  batch([write(codeSeg,0xc000,wrapper),write(jumpSeg,ip,b'\xfa\xea\x00\xc0'+struct.pack('<H',codeSeg)),*[{'op':'cpu_write','register':r,'value':v} for r,v in [('cs',jumpSeg),('ds',dataSeg),('es',dataSeg),('ss',dataSeg),('esp',0xfef0)]]])
  c.post('/api/v1/debug/step',json={'count':2});old=c.get('/api/v1/debug/status')['stop']['stop_id'];c.post('/api/v1/debug/continue');stop=c.get('/api/v1/debug/wait',params={'since_stop_id':old,'timeout_ms':15000},timeout=20)
  assert stop['satisfied'] and stop['registers']['cs']==codeSeg+0x1c4 and stop['registers']['eip']==0x227
  entry=stop;trace=[];ports=[];textCall=None
  for _ in range(20000):
   r=stop['registers'];physical=(r['cs']-codeSeg)*16+r['eip'];assert not r['flags']&0x600
   if physical==returned:break
   assert (0x1e67<=physical<0x1ee7 or 0x5f7e<=physical<0x5f91 or 0x8978<=physical<0x8a14 or 0x8a48<=physical<0x8aea or 0x8b02<=physical<0x8b26 or 0xa81f<=physical<0xa909),hex(physical)
   if physical==0xa81f:
    assert textCall is None
    raw=batch([{'op':'mem_read','segment':dataSeg,'offset':r['esp']+4,'len':12}]);words=struct.unpack('<6H',base64.b64decode(raw['results'][0]['data']))
    text=batch([{'op':'mem_read','segment':dataSeg,'offset':words[3],'len':11}]);textCall={'words':words,'string':base64.b64decode(text['results'][0]['data']).split(b'\0')[0].decode('latin1')}
   trace.append(physical)
   if physical>=0xa000 and program[physical]==0xef:ports.append({'ip':physical,'port':r['edx']&65535,'word':r['eax']&65535})
   result=c.post('/api/v1/debug/step',json={'count':1});assert result['status']=='ok';stop=result['stop']
  else:raise AssertionError('Unfinished native number formatter')
  assert stop['registers']['esp']==0xfef0-len(args)*2
  assert textCall is not None
  memory=batch([{'op':'mem_read','segment':codeSeg,'offset':0,'len':len(program)}]);assert base64.b64decode(memory['results'][0]['data'])==program,'Unexpected original code modification'
  save(f'case-{index:02}',{'index':index,'input':event,'entry':entry,'trace':trace,'ports':ports,'textCall':textCall,'final':stop,'code':memory})
  print(json.dumps({'case':index,'value':event['value'],'text':textCall['string'],'instructions':len(trace),'ports':len(ports)}),flush=True)
 save('capture',{'completed':True,'caseCount':len(cases),'sourceSHA256':sha(source),'executableSHA256':sha(exe),'driverSHA256':sha(driver),'fontSHA256':sha(font),'codeSegment':codeSeg,'dataSegment':dataSeg,'jumpSegment':jumpSeg,'programSHA256':sha(program),'programBytes':len(program),'pid':manager.pid,'instanceId':info['instance_id'],'scope':'Original relocated formatter/helpers and driver;IF/DF clear,DS=SS,healthy private stack. RAM surface,not screen pixels/cadence/whole machine checkpoint.'})
except BaseException as error:
 save('capture-failure',{'case':index,'error':repr(error),'stop':stop,'trace':trace,'ports':ports});raise
finally:
 if manager.running:manager.stop()
 for c in clients:c.close()
