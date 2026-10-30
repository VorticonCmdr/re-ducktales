"""Publish a NEW campaign manifest only after independent browser acceptance."""
from pathlib import Path
import argparse,json,hashlib,subprocess
p=argparse.ArgumentParser();p.add_argument('--pending',required=True);p.add_argument('--comparison',required=True);p.add_argument('--manifest',required=True);a=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
def spec(p):
 p=Path(p);b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
target=Path(a.manifest);assert not target.exists(),'Refuse to overwrite a campaign manifest'
pending=Path(a.pending);m=json.loads(pending.read_text());assert m['pendingBrowserReplay']
root=Path(a.comparison);status=json.loads((root/'runner-status.json').read_text());source=json.loads((root/'source-revision.json').read_text());assert status['exitCode']==0 and status['loadedSourcesUnchanged'] and status['historicalArtifactsPreserved'];assert status['manifestSHA256']==sha(pending.read_bytes())
producer=json.loads(Path(m['artifacts']['producer-source']['path']).read_text())
assert {p for p in source['files'] if p.startswith('src/')}=={p for p in producer['files'] if p.startswith('src/')},'Consumer source inventory differs'
for path,h in producer['files'].items():
 if path.startswith('src/'):assert source['files'][path]==h,'Consumer differs from producer:'+path
cases=[p for p in (root/'browser').iterdir() if p.is_dir()];assert len(cases)==1;case=cases[0]
progress=json.loads((case/'replay-progress.json').read_text());checks=json.loads((case/'campaign-checkpoints.json').read_text());expected=json.loads(Path(m['artifacts']['campaign-checkpoints']['path']).read_text());assert progress['completed'] and progress['consumed']==m['requiredEventCount'] and progress['expectedEvents']==m['requiredEventCount'] and not progress['errors'];assert len(checks)==len(expected)==35
for x,y in zip(checks,expected):
 for k in ['name','at','eventCount','stateSha256','pixelsSha256']:assert x[k]==y[k],k
assert progress['lastState']['ending']==m['expectedEnding'];assert json.loads((root/'browser'/'.last-run.json').read_text())=={'status':'passed','failedTests':[]}
for role,name in [('accepted-browser-progress','replay-progress.json'),('accepted-browser-checkpoints','campaign-checkpoints.json'),('accepted-browser-events','actual-events.json')]:m['artifacts'][role]=spec(case/name)
m['artifacts']['accepted-browser-status']=spec(root/'browser'/'.last-run.json');m['artifacts']['browser-contract']=spec(pending)
for role,name in [('consumer-source','source-revision.json'),('consumer-archive','sources.zip'),('consumer-status','runner-status.json'),('consumer-capture-tool','capture-source.py'),('consumer-log','browser.log')]:m['artifacts'][role]=spec(root/name)
m['consumerCommit']=source['commit'];m['browserReplayRoot']=str(root/'browser');m['pendingBrowserReplay']=False
for path in list(m['verificationSources'])+['scripts/accept-jungle-line-campaign.py','scripts/verify-runtime-campaign.js','scripts/jungle-line-timing.js','scripts/verify-jungle-line-work.js','scripts/verify-jungle-line-browser-negative.js','tests/browser/jungle-line-input.spec.js']:m['verificationSources'][path]=sha(Path(path).read_bytes())
m['evidenceLevel']='Fresh closed-loop input replay and independent actual-browser full campaign acceptance;not whole-native campaign or cadence parity.'
target.write_text(json.dumps(m,indent=2)+'\n');print('Accepted NEW complete campaign:',len(checks),'exact states/pixel digests;',progress['consumed'],'DOM events;restart asserted by browser test.')
