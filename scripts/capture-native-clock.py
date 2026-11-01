"""Calibrate a private read-only PIC timestamp API. No game or guest writes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from dataclasses import replace
from native_portable_session import PortableSession

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser()
p.add_argument('--engine',required=True)
p.add_argument('--engine-source',required=True)
p.add_argument('--port',type=int,required=True)
p.add_argument('--output',required=True)
a=p.parse_args()
out=(ROOT/a.output).resolve()
assert out.is_relative_to((ROOT/'.local').resolve())
assert a.port!=8386
with socket.socket() as probe:probe.bind(('127.0.0.1',a.port))
out.mkdir(parents=True,exist_ok=False)
sys.path.insert(0,str(Path(os.environ['DUCKTALES_DOSBOX_MCP_ROOT']).resolve()))
from dosbox_mcp.config import Config
from dosbox_mcp.client import DosboxClient
engine_root=Path(a.engine_source).resolve()
assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=engine_root)
cfg=replace(Config.load(),binary=Path(a.engine).resolve(),port=a.port,base_url=f'http://127.0.0.1:{a.port}',headless=True,mute=True)
assert cfg.binary.is_file()
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(name,value):(out/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
files={name:sha((engine_root/name).read_bytes()) for name in [
    'src/lua/lua_api.cpp','src/hardware/pic.h','src/cpu/core_normal.cpp',
    'src/cpu/core_normal/string.h','src/hardware/timer.cpp',
    'src/webserver/batch.cpp','src/webserver/private/batch.h']}
save('observer-engine',{'revision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=engine_root,text=True).strip(),
    'sourceRoot':str(engine_root),'files':files,'binarySHA256':sha(cfg.binary.read_bytes()),
    'scope':'Private read-only PIC timestamp observer. No shared instance/configuration changes.'})
subprocess.run(['node','--input-type=module','-e',
    "import{archiveSource}from'./scripts/lib/local-scenario-source.js';await archiveSource(process.argv[1]);",str(out)],cwd=ROOT,check=True)
clients=[]
def attach(url,token):
    assert url==cfg.base_url
    c=DosboxClient(url,token);clients.append(c)
    assert c.get('/api/v1/dosbox/info')['pid']==manager.pid
    return c
manager=PortableSession(cfg,attach,out,ROOT/'game')
try:
    c=manager.start()
    save('engine',c.get('/api/v1/dosbox/info'))
    save('frame-info',c.get('/api/v1/video/frame/info'))
    script=(ROOT/'scripts/native-clock-observer.lua').read_text()
    save('script',{'source':script,'sha256':sha(script.encode())})
    save('load',c.post_text('/api/v1/script/load',script,params={'name':'native-clock-calibration'}))
    save('start',c.post('/api/v1/script/start'))
    deadline=time.monotonic()+20
    while time.monotonic()<deadline:
        result=c.get('/api/v1/script/status')
        if result['state'] in ['completed','error']:break
        time.sleep(.02)
    else:raise AssertionError('Unfinished native clock calibration')
    save('result',result)
    assert result['state']=='completed' and not result['output_truncated']
    assert result['output']['completed']
    rows=[line.split(',') for line in result['output']['samplesCSV'].splitlines()]
    assert len(rows)==61 and all(len(r)==3 for r in rows)
    for i,row in enumerate(rows):
        assert int(row[0])==i+1
        if i:
            assert int(row[1])==int(rows[i-1][1])+1
            assert float(row[2])>float(rows[i-1][2])
    stop=c.post('/api/v1/debug/pause')['stop']
    first=c.post('/api/v1/batch',json={'ops':[{'op':'cpu_read'},{'op':'cpu_read'}]})
    second=c.post('/api/v1/batch',json={'ops':[{'op':'cpu_read'}]})
    save('atomic-clock',{'stop':stop,'first':first,'second':second})
    values=first['results']+second['results']
    assert not first['aborted'] and not second['aborted'] and len(values)==3
    assert all(v['status']=='ok' and v['registers']==stop['registers'] for v in values)
    assert all(isinstance(v.get('emulated_time_ms'),(int,float)) for v in values)
    assert len(set(v['emulated_time_ms'] for v in values))==1
    save('capture',{'completed':True,'expectedSamples':61,'expectedFrameSpan':60,'inputs':[],
        'guestWrites':[],'partialRestore':False,'scope':'Shell-only read-only timestamp calibration;not game clock phase or cadence acceptance.'})
finally:
    manager.stop()
    for c in clients:c.close()
print(json.dumps({'completed':True,'output':str(out)}))
