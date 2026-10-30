"""Capture the clean combined current-campaign gate and preserve prior evidence."""
from pathlib import Path
import argparse,subprocess,json,hashlib,zipfile,datetime,os
root=Path(__file__).resolve().parents[1];os.chdir(root)
p=argparse.ArgumentParser();p.add_argument('--cave-composition',action='store_true');p.add_argument('--bios-clock',action='store_true');p.add_argument('--output',required=True);a=p.parse_args()
assert not subprocess.check_output(['git','status','--porcelain'],text=True).strip(),'SETUP: commit clean integration source'
out=Path(a.output);assert out.resolve().is_relative_to((root/'.local').resolve());out.mkdir(parents=True,exist_ok=False)
sha=lambda b:hashlib.sha256(b).hexdigest()
rev=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();archive=subprocess.check_output(['git','archive','--format=zip',rev]);(out/'sources.zip').write_bytes(archive)
with zipfile.ZipFile(out/'sources.zip')as z:files={n:sha(z.read(n))for n in z.namelist()if not n.endswith('/')}
(out/'source-revision.json').write_text(json.dumps({'commit':rev,'files':files,'archiveSha256':sha(archive)},indent=2)+'\n')
captureSource=Path(__file__).read_bytes();(out/'capture-source.py').write_bytes(captureSource)
old=Path('.local/bios-clock-campaign-integration-02/runner-status.json' if a.cave_composition else '.local/mountain-phase-campaign-integration-01/runner-status.json' if a.bios_clock else '.local/jungle-text-campaign-integration-01/runner-status.json');assert old.exists(),'SETUP: missing historical protected inventory'
protected=dict(json.loads(old.read_text())['protectedArtifacts']);protected.update({str(p):sha(p.read_bytes())for p in Path('reference').glob('*.json')})
for name in ['mountain-phase-campaign','mountain-phase','mountain-hud-work','mountain-erase-work','ega-signed-copy-work','mountain-phase-runtime','speaker-playback-current','speaker-engine','hud-number-work','ega-text-native','jungle-text-campaign']+(['bios-clock','bios-clock-campaign','bios-clock-speaker-playback']if (a.bios_clock or a.cave_composition) else [])+(['cave-composition-campaign','cave-composition-work','cave-composition-integration','cave-composition-speaker-playback','cave-minimap-work']if a.cave_composition else []):
 for spec in json.loads(Path('reference/'+name+'.json').read_text())['artifacts'].values():
  f=Path(spec['path']);assert f.exists(),'SETUP: missing '+str(f);protected[str(f)]=sha(f.read_bytes())
for name,h in protected.items():assert sha(Path(name).read_bytes())==h,'Prior evidence changed:'+name
def ownedOutputs():
 result={p for p in Path('.local').iterdir()if p.is_dir()and p.name.startswith(('current-jungle-lines-','mountain-phase-integration-','bios-clock-integration-','cave-composition-integration-'))}
 parent=Path('.local/current-campaign-verification')
 if parent.exists():result.update(p for p in parent.iterdir()if p.is_dir())
 return result
before=ownedOutputs();command=['npm','run','verify:current-campaign'];status={'sourceCommit':rev,'sourceFileCount':len(files),'command':command,'captureToolSHA256':sha(captureSource),'completed':False,'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'protectedArtifacts':protected,'scope':'Clean cave room/minimap complete Easy gate;fresh startup producer and independent full browser consumer,strict native/component/browser regressions and omissions. Not full Hard,variable-seed whole-campaign or native cadence parity.' if a.cave_composition else 'Clean BIOS clock and mountain-phase Easy gate;registered unchanged-input complete browser pass,fresh clock/jungle/mountain controls and required negatives. No variable-seed whole campaign,full Hard or native clock-phase parity.' if a.bios_clock else 'Clean mountain-phase Easy gate;registered independent complete browser pass,fresh jungle/mountain controls and omission negatives. Not full Hard or native whole-game parity.'}
try:
 with(out/'verification.log').open('w')as f:r=subprocess.run(command,env={k:v for k,v in os.environ.items()if not k.startswith('DUCKTALES_')},stdout=f,stderr=subprocess.STDOUT,timeout=1200)
 status['exitCode']=r.returncode
 for name,h in files.items():assert sha(Path(name).read_bytes())==h,'Integration source changed:'+name
 for name,h in protected.items():assert sha(Path(name).read_bytes())==h,'Evidence changed:'+name
 status['historicalArtifactsPreserved']=True;status['loadedSourcesUnchanged']=True
 status['generatedRoots']=sorted(str(p)for p in ownedOutputs()-before)
 assert r.returncode==0,'Required current-campaign gate failed'
 status['completed']=True;print(json.dumps({k:v for k,v in status.items()if k!='protectedArtifacts'}),flush=True)
except BaseException as e:status['error']=repr(e);raise
finally:
 status['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'runner-status.json').write_text(json.dumps(status,indent=2)+'\n')
