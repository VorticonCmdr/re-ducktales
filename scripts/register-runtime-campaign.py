"""Register a completed runtime comparison; never regenerate expectations."""
from pathlib import Path
import argparse,json,hashlib
p=argparse.ArgumentParser();p.add_argument('--bios-clock',action='store_true');p.add_argument('--comparison',required=True);p.add_argument('--baseline',required=True);p.add_argument('--manifest',required=True);a=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
def spec(p):
 p=Path(p);b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
root=Path(a.comparison);m=json.loads(Path(a.baseline).read_text());status=json.loads((root/'runner-status.json').read_text());source=json.loads((root/'source-revision.json').read_text())
assert status['exitCode']==0 and status['loadedSourcesUnchanged'] and status['historicalArtifactsPreserved']
assert status['manifestSHA256']==sha(Path(a.baseline).read_bytes());assert status['sourceCommit']==source['commit']
cases=[p for p in (root/'browser').iterdir() if p.is_dir()];assert len(cases)==1
case=cases[0];progress=json.loads((case/'replay-progress.json').read_text());observed=json.loads((case/'campaign-checkpoints.json').read_text());expected=json.loads(Path(m['artifacts']['campaign-checkpoints']['path']).read_text())
assert progress['completed'] and progress['consumed']==m['requiredEventCount'] and not progress['errors'];assert len(observed)==len(expected)==m['expectedCheckpointCount']
for x,y in zip(observed,expected):
 for key in ['name','at','eventCount','stateSha256','pixelsSha256']:assert x[key]==y[key],key
assert progress['lastState']['ending']==m['expectedEnding'];assert json.loads((root/'browser'/'.last-run.json').read_text())=={'status':'passed','failedTests':[]}
m['id']='bios-clock-easy-complete-campaign' if a.bios_clock else 'speaker-runtime-easy-complete-campaign';m['runtimeComparison']=True;m['runtimeCommit']=source['commit'];m['runtimeComparisonRoot']=str(root)
m['scope']='Complete Easy port regression on persistent-speaker runtime;unchanged independent historical inputs/expected states;audio disabled in this full-route scenario.'
m['browserReplayRoot']=str(root/'browser')
if a.bios_clock:
 assert m['expectedUnitCases']==186
 m['expectedUnitCases']=194
 m['runtimeEnvironment']={'biosSeed':0,'url':'/?bios-seed=0'}
 m['scope']='Complete Easy fixed-word regression on clock-seed runtime; unchanged independent historical inputs and expected state/pixels. Default clock acceptance is separate in reference/bios-clock.json.'
for role,name in [('accepted-browser-progress','replay-progress.json'),('accepted-browser-checkpoints','campaign-checkpoints.json'),('accepted-browser-events','actual-events.json')]:m['artifacts'][role]=spec(case/name)
m['artifacts']['accepted-browser-status']=spec(root/'browser'/'.last-run.json')
for role,name in [('runtime-source','source-revision.json'),('runtime-archive','sources.zip'),('runtime-status','runner-status.json'),('runtime-capture-tool','capture-source.py'),('runtime-log','browser.log')]:m['artifacts'][role]=spec(root/name)
m['artifacts']['expectation-manifest']=spec(a.baseline)
if not a.bios_clock:m['comparisonRules']+=' Current consumer src/ files match the separately pinned runtime archive exactly;historical expected artifacts remain byte-for-byte unchanged.'
if not a.bios_clock:m['captureTools']['runtimeConsumer']='Fresh browser comparison from the runtimeCommit archive. Producer provenance remains the historical captureCommit. No expected-state or memory injection. Audio disabled;see separate speaker-playback manifest for actual audio acceptance.'
m['verify']='npm run verify:runtime-campaign'
# Gate logic is pinned separately from archived consumer game code.
for path in list(m['verificationSources'])+['scripts/capture-runtime-campaign.py','scripts/register-runtime-campaign.py','scripts/verify-runtime-campaign.js']:m['verificationSources'][path]=sha(Path(path).read_bytes())
if a.bios_clock:
 m['artifacts']['bios-clock-contract']=spec('reference/bios-clock.json')
 m['artifacts']['bios-clock-cave-contract']=spec('reference/bios-clock-cave-reveal.json')
 m['artifacts']['bios-clock-sound-contract']=spec('reference/bios-clock-speaker-playback.json')
 for path in ['scripts/verify-bios-clock.js','scripts/verify-bios-clock-integration.js','scripts/verify-bios-clock-campaign-receipt.js','scripts/capture-mountain-phase-integration.py','tests/bios-clock.test.js','tests/browser/bios-clock.spec.js','scripts/verify-cave-reveal.js']:
  m['verificationSources'][path]=sha(Path(path).read_bytes())
out=Path(a.manifest);assert not out.exists(),'Refuse to overwrite a registered scenario';out.write_text(json.dumps(m,indent=2)+'\n')
print('Registered34 unchanged checkpoints and4981 required events with separate current runtime source provenance:'+str(out))
