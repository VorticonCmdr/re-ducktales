"""Fresh actual-browser comparison against independent historical inputs.
Keeps the expected producer and current consumer source identities distinct.
"""
from pathlib import Path
import argparse, subprocess, json, hashlib, zipfile, io, datetime, os, sys
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--manifest',required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];os.chdir(root)
out=Path(a.output);assert out.resolve().is_relative_to((root/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
rev=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
archive=subprocess.check_output(['git','archive','--format=zip',rev]);(out/'sources.zip').write_bytes(archive)
with zipfile.ZipFile(io.BytesIO(archive)) as z:files={n:sha(z.read(n)) for n in z.namelist() if not n.endswith('/')}
loaded={n:h for n,h in files.items() if n.startswith(('src/','tests/browser/')) or n in ['playwright.config.js','playwright.campaign.config.js','vite.config.js','vite.campaign.config.js','package.json','package-lock.json']}
def validate():
 for n,h in loaded.items():assert sha(Path(n).read_bytes())==h,'Loaded source differs from archive:'+n
validate()
(out/'source-revision.json').write_text(json.dumps({'commit':rev,'files':files,'archiveSha256':sha(archive)},indent=2)+'\n')
(out/'capture-source.py').write_bytes(Path(__file__).read_bytes())
m=json.loads(Path(a.manifest).read_text());protected={v['path']:sha(Path(v['path']).read_bytes()) for v in m['artifacts'].values()}
protected.update({str(f):sha(f.read_bytes()) for f in Path('reference').glob('*.json')})
command=['node','node_modules/@playwright/test/cli.js','test','tests/browser/mixed-campaign.spec.js','--config','playwright.campaign.config.js','--output='+str(out/'browser')]
env={k:v for k,v in os.environ.items() if not k.startswith('DUCKTALES_')};env['DUCKTALES_EASY_CAMPAIGN_MANIFEST']=a.manifest
status={'sourceCommit':rev,'sourceFileCount':len(files),'manifest':a.manifest,'manifestSHA256':sha(Path(a.manifest).read_bytes()),'command':command,'captureToolSHA256':sha(Path(__file__).read_bytes()),'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'protectedArtifacts':protected,'scope':'Independent old DOM inputs and expectations compared with fresh current-runtime browser execution;no expected-state injection.'}
try:
 with (out/'browser.log').open('w') as f:r=subprocess.run(command,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=660)
 status['exitCode']=r.returncode
 validate()
 for n,h in protected.items():assert sha(Path(n).read_bytes())==h,'Historical evidence changed:'+n
 status['loadedSourcesUnchanged']=True;status['historicalArtifactsPreserved']=True
 print(json.dumps({k:v for k,v in status.items() if k!='protectedArtifacts'}),flush=True)
finally:
 status['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'runner-status.json').write_text(json.dumps(status,indent=2)+'\n')
if status['exitCode']!=0:sys.exit(status['exitCode'])
