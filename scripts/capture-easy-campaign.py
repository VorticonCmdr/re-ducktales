"""Archive a fresh exploratory Easy capture; never treat its sentinel as acceptance."""
from pathlib import Path
import argparse,subprocess,json,hashlib,zipfile,io,os,datetime,sys
root=Path(__file__).resolve().parents[1];os.chdir(root)
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--prefix');p.add_argument('--through',choices=['all-recorded','photography-return'],default='all-recorded');a=p.parse_args()
assert not subprocess.check_output(['git','status','--porcelain'],text=True).strip(),'SETUP: commit clean capture source'
out=Path(a.output);assert out.resolve().is_relative_to((root/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
rev=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();archive=subprocess.check_output(['git','archive','--format=zip',rev]);(out/'sources.zip').write_bytes(archive)
with zipfile.ZipFile(io.BytesIO(archive)) as z:files={n:sha(z.read(n)) for n in z.namelist() if not n.endswith('/')}
(out/'source-revision.json').write_text(json.dumps({'commit':rev,'files':files,'archiveSha256':sha(archive)},indent=2)+'\n');(out/'capture-source.py').write_bytes(Path(__file__).read_bytes())
protected={str(p):sha(p.read_bytes()) for p in Path('reference').glob('*.json')}
settings={'DUCKTALES_CAPTURE_EASY_CAMPAIGN':'1','DUCKTALES_CAMPAIGN_PHYSICAL':'1','DUCKTALES_CAMPAIGN_PLAYER_WAYPOINTS':'1'}
if a.prefix:
 prefix=Path(a.prefix);assert prefix.is_dir(),'SETUP: missing input prefix'
 settings.update(DUCKTALES_CAMPAIGN_REPLAY_PREFIX=str(prefix),DUCKTALES_CAMPAIGN_REPLAY_THROUGH=a.through)
 protected.update({str(p):sha(p.read_bytes()) for p in prefix.glob('*.json')})
command=['node','node_modules/@playwright/test/cli.js','test','tests/browser/mixed-campaign.spec.js','--config','playwright.campaign.config.js','--output='+str(out/'browser')]
env={k:v for k,v in os.environ.items() if not k.startswith('DUCKTALES_')};env.update(settings)
status={'sourceCommit':rev,'sourceFileCount':len(files),'command':command,'environment':settings,'protectedArtifacts':protected,'captureToolSHA256':sha(Path(__file__).read_bytes()),'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Exploratory actual-browser player capture,not acceptance. Optional prefix replays inputs from startup;no memory/state restore. Host watchdog does not supply simulation time.'}
try:
 with (out/'browser.log').open('w') as f:r=subprocess.run(command,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=1000)
 status['exitCode']=r.returncode
 for n,h in files.items():
  if n.startswith(('src/','tests/browser/')) or n in ['package.json','playwright.config.js','playwright.campaign.config.js','vite.config.js','vite.campaign.config.js']:assert sha(Path(n).read_bytes())==h,'Loaded capture source changed:'+n
 for n,h in protected.items():assert sha(Path(n).read_bytes())==h,'Protected evidence changed:'+n
 status.update(loadedSourcesUnchanged=True,historicalArtifactsPreserved=True)
 cases=list((out/'browser').rglob('environment.json'));assert len(cases)==1,'Missing or ambiguous capture'
 raw=cases[0].parent;e=json.loads(cases[0].read_text());checks=json.loads((raw/'campaign-checkpoints.json').read_text())
 status.update(routeCompleted=e['routeCompleted'],observerError=e['observerError'],checkpointCount=len(checks),captureRoot=str(raw))
 assert r.returncode==1 and e['routeCompleted'] and e['observerError'] is None and checks and checks[-1]['name']=='ending','Exploratory route did not complete'
 assert 'EXPLORATORY linked campaign saved;not acceptance' in (out/'browser.log').read_text(),'Missing deliberate capture sentinel'
 status['captureCompleted']=True
 print(json.dumps({k:v for k,v in status.items() if k!='protectedArtifacts'}),flush=True)
finally:
 status['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'runner-status.json').write_text(json.dumps(status,indent=2)+'\n')
