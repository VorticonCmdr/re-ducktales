"""Declare a NEW complete input stream/expectations; independent replay pending.
Raw exploratory flags and all historical artifacts remain untouched.
"""
from pathlib import Path
import argparse,json,hashlib,shutil,subprocess
p=argparse.ArgumentParser();p.add_argument('--producer',required=True);p.add_argument('--capture',required=True);p.add_argument('--output',required=True);p.add_argument('--manifest',required=True);a=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
def spec(p):
 p=Path(p);b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
producer=Path(a.producer);raw=Path(a.capture);out=Path(a.output);target=Path(a.manifest);assert not target.exists();out.mkdir(parents=True,exist_ok=False)
status=json.loads((producer/'runner-status.json').read_text());source=json.loads((producer/'source-revision.json').read_text());environment=json.loads((raw/'environment.json').read_text());events=json.loads((raw/'captured-events.json').read_text());checks=json.loads((raw/'campaign-checkpoints.json').read_text())
assert status['sourceCommit']==source['commit'];assert status['exitCode']==1 and status['captureCompleted'] and status['loadedSourcesUnchanged'] and status['historicalArtifactsPreserved'];assert status['routeCompleted'] and status['observerError'] is None
assert environment['routeCompleted'] and not environment['completed'] and environment['physical'] and not environment['hard'];assert environment['clockOrigin']==1 and environment['displayMilliseconds']==8
parent=Path('reference/speaker-runtime-campaign.json');base=json.loads(parent.read_text());assert len(checks)==34 and [c['name'] for c in checks]==base['checkpointNames'];assert 4000<len(events)<10000
js="import{readFile}from'node:fs/promises';import{canonical,digest}from'./tests/browser/helpers/entry-recording.js';const c=JSON.parse(await readFile(process.argv[1]));console.log(JSON.stringify(c.map(x=>digest(canonical(x.state)))));"
digests=json.loads(subprocess.check_output(['node','--input-type=module','-e',js,str(raw/'campaign-checkpoints.json')],text=True))
assert len(digests)==len(checks),'Missing captured state digest cases'
for c,h in zip(checks,digests):assert h==c['stateSha256'],'Captured state digest';assert 0<c['eventCount']<=len(events)
assert checks[-1]['eventCount']==len(events);ending=checks[-1]['state']['ending'];assert ending['won'] and ending['ready'] and ending['day']==31
assert checks[-1]['state']['campaign']['playerCollected']==[1,30,31,32];assert checks[-1]['state']['mountain']['lives']==3
active=set()
for e in events:
 if e['type']=='keydown':active.add(e['key'])
 elif e['type']=='keyup':active.discard(e['key'])
assert not active,'Unreleased physical input'
registered={**environment,'completed':True,'mode':'Registered complete independent input stream;browser acceptance pending;producer sentinel is not acceptance','producerCompletedAcceptance':False,'producerCaptureRoot':str(raw)}
(out/'environment.json').write_text(json.dumps(registered,indent=2)+'\n')
for name in ['captured-events.json','campaign-checkpoints.json']:shutil.copyfile(raw/name,out/name)
(out/'timeline.json').write_text(json.dumps({'clockOrigin':1,'displayMilliseconds':8,'endAt':checks[-1]['at'],'observations':[{k:c[k] for k in ['name','at','eventCount']} for c in checks]},indent=2)+'\n')
# Copy template fields, then explicitly replace provenance/current expectations.
m=json.loads(Path('reference/cave-reveal-campaign.json').read_text());m['id']='jungle-line-easy-complete-campaign';m['scope']='Complete line-inclusive Easy campaign port regression;new captured inputs/expected outputs require independent browser acceptance. Not native whole-campaign cadence/parity.';m['completeSourceInventory']=True;m['pendingBrowserReplay']=True;m['artifactRoot']=str(out);m['captureRoot']=str(raw);m['captureCommit']=source['commit'];m['requiredEventCount']=len(events);m['expectedCheckpointCount']=34;m['checkpointNames']=[c['name'] for c in checks];m['expectedEnding']=ending;m['expectedOwnership']={k:checks[-1]['state']['campaign'][k] for k in ['playerCollected','rivalCollected','rivalUnlockMask']}
m['artifacts']={role:spec(out/name) for role,name in [('environment','environment.json'),('captured-events','captured-events.json'),('campaign-checkpoints','campaign-checkpoints.json'),('timeline','timeline.json')]}
for role,name in [('producer-source','source-revision.json'),('producer-archive','sources.zip'),('producer-status','runner-status.json'),('producer-log','browser.log'),('producer-capture-tool','runner.py')]:m['artifacts'][role]=spec(producer/name)
m['artifacts']['producer-environment']=spec(raw/'environment.json');m['artifacts']['ending-png']=spec(raw/'mixed-campaign-ending.png')
m['parentScenario']={'path':str(parent),'sha256':sha(parent.read_bytes()),'materialPreserved':True,'difference':'New line work changes declared drawing/timing state;new outputs are captured separately. Old expectations are not overwritten or excluded.'}
m['captureTools']['producerSource']='Exact clean committed archive;fresh actual-browser startup and authored physical player policy. No prefix memory/state restore. Exploratory sentinel remains distinct from acceptance.'
m['verify']='npm run verify:current-campaign';m['comparisonRules']='Exact full states and320x200 RGBA hashes at34 checkpoints;complete independent DOM event/timestamp stream. Original clamped/truncated pointer coordinates only. No timer,RNG,state or pixel exclusions.'
for role in ['accepted-browser-progress','accepted-browser-checkpoints','accepted-browser-events','accepted-browser-status']:assert role not in m['artifacts']
for path in list(m['verificationSources'])+['scripts/register-jungle-line-campaign.py']:m['verificationSources'][path]=sha(Path(path).read_bytes())
target.write_text(json.dumps(m,indent=2)+'\n');print('Declared complete independent stream;strict replay and browser acceptance pending:',len(events),'events')
