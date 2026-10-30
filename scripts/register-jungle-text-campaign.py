"""Declare a fresh startup-to-ending stream; independent replay still required."""
from pathlib import Path
import argparse,json,hashlib,shutil,subprocess
p=argparse.ArgumentParser();p.add_argument('--producer',required=True);p.add_argument('--output',required=True);a=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
def spec(p):
 p=Path(p);b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':sha(b)}
producer=Path(a.producer);out=Path(a.output);assert out.resolve().is_relative_to((Path.cwd()/'.local').resolve());assert not out.exists()
status=json.loads((producer/'runner-status.json').read_text());source=json.loads((producer/'source-revision.json').read_text());raw=Path(status['captureRoot'])
assert status['sourceCommit']==source['commit'];assert status['exitCode']==1 and status['captureCompleted'] and status['loadedSourcesUnchanged'] and status['historicalArtifactsPreserved'];assert status['routeCompleted'] and status['observerError'] is None
assert status['environment']=={'DUCKTALES_CAPTURE_EASY_CAMPAIGN':'1','DUCKTALES_CAMPAIGN_PHYSICAL':'1','DUCKTALES_CAMPAIGN_PLAYER_WAYPOINTS':'1'},'Fresh startup capture only;no input prefix or memory restore'
env=json.loads((raw/'environment.json').read_text());events=json.loads((raw/'captured-events.json').read_text());checks=json.loads((raw/'campaign-checkpoints.json').read_text())
assert env['routeCompleted'] and not env['completed'] and env['physical'] and not env['hard'] and env['observerError'] is None;assert env['clockOrigin']==1 and env['displayMilliseconds']==8
parent=Path('reference/jungle-line-campaign.json');previous=json.loads(parent.read_text());names=list(previous['checkpointNames']);assert names.pop(27)=='mountain-entry'
assert len(checks)==34 and [c['name'] for c in checks]==names,'Missing/extra complete campaign boundary'
assert 4000<=len(events)<10000 and checks[-1]['eventCount']==len(events)
js="import{readFile}from'node:fs/promises';import{canonical,digest}from'./tests/browser/helpers/entry-recording.js';console.log(JSON.stringify(JSON.parse(await readFile(process.argv[1])).map(x=>digest(canonical(x.state)))));"
hashes=json.loads(subprocess.check_output(['node','--input-type=module','-e',js,str(raw/'campaign-checkpoints.json')],text=True));assert len(hashes)==len(checks)
for c,h in zip(checks,hashes):assert c['stateSha256']==h and 0<c['eventCount']<=len(events)
ending=checks[-1]['state']['ending'];campaign=checks[-1]['state']['campaign'];assert ending['won'] and ending['ready'] and ending['day']==31
assert campaign['playerCollected']==[1,30,31,32] and checks[-1]['state']['mountain']['lives']==3
active=set()
for e in events:
 if e['type']=='keydown':active.add(e['key'])
 elif e['type']=='keyup':active.discard(e['key'])
assert not active,'Unreleased keyboard input'
assert len([c for c in checks if c['name']=='arrival'])==4
out.mkdir(parents=True,exist_ok=False)
(out/'environment.json').write_text(json.dumps({**env,'completed':True,'mode':'Registered complete input stream;independent browser acceptance pending','producerCompletedAcceptance':False,'producerCaptureRoot':str(raw)},indent=2)+'\n')
for name in ['captured-events.json','campaign-checkpoints.json']:shutil.copyfile(raw/name,out/name)
(out/'timeline.json').write_text(json.dumps({'clockOrigin':1,'displayMilliseconds':8,'endAt':checks[-1]['at'],'observations':[{k:c[k] for k in ['name','at','eventCount']} for c in checks]},indent=2)+'\n')
m={'id':'jungle-text-easy-complete-campaign','scope':'Fresh formatter/text-inclusive Easy campaign port regression;independent replay pending,not native whole-campaign cadence/parity.','physicalKeyboard':True,'expectedHard':False,'pendingBrowserReplay':True,'completeSourceInventory':True,'capturePrefix':False,'artifactRoot':str(out),'captureRoot':str(raw),'captureCommit':source['commit'],'buildManifest':previous['buildManifest'],'expectedCheckpointCount':34,'requiredEventCount':len(events),'checkpointNames':names,'expectedFlagAliasPresentations':0,'expectedEnding':ending,'expectedOwnership':{k:campaign[k] for k in ['playerCollected','rivalCollected','rivalUnlockMask']},'injections':[],'fittedInputs':[],'partialRestore':False,'captureTools':{**previous['captureTools'],'producerSource':'Fresh actual-browser physical player capture from startup;no prefix,partial restore or expected-state input. Exploratory sentinel is not acceptance.'},'comparisonRules':'Exact34 full states/320x200 RGBA digests and all independent DOM events/timestamps. Original clamped pointer coordinates only. No new state,timer,RNG or pixel exclusions.','verify':'npm run verify:current-campaign','expectedFlightPresentations':sum(c['state']['flight']['presentations'] for c in checks if c['name']=='arrival'),'parentScenario':{'path':str(parent),'sha256':sha(parent.read_bytes()),'materialPreserved':True,'difference':'Formatter/text work changes timing metadata. New inputs and expectations are captured separately;the prior extra identical mountain-entry marker is absent from this fresh34-boundary route.'}}
m['artifacts']={role:spec(out/file) for role,file in [('environment','environment.json'),('captured-events','captured-events.json'),('campaign-checkpoints','campaign-checkpoints.json'),('timeline','timeline.json')]}
for role,file in [('producer-source','source-revision.json'),('producer-archive','sources.zip'),('producer-status','runner-status.json'),('producer-log','browser.log'),('producer-capture-tool','capture-source.py')]:m['artifacts'][role]=spec(producer/file)
for role,file in [('producer-environment','environment.json'),('ending-png','mixed-campaign-ending.png')]:m['artifacts'][role]=spec(raw/file)
paths=['scripts/replay-hard-campaign.js','scripts/verify-current-campaign.js','scripts/verify-current-campaign-fixtures.js','scripts/verify-current-campaign-browser-negative.js','tests/helpers/original-game.js','tests/browser/helpers/recorded-campaign.js','tests/browser/helpers/recorded-dom-input.js','tests/browser/helpers/clock.js','tests/browser/mixed-campaign.spec.js','playwright.campaign.config.js','vite.campaign.config.js','package.json','scripts/register-jungle-text-campaign.py','scripts/accept-jungle-text-campaign.py','scripts/verify-runtime-campaign.js','scripts/jungle-text-timing.js','scripts/verify-jungle-text-work.js','scripts/verify-jungle-line-browser-negative.js','scripts/verify-jungle-text-browser-negative.js','tests/browser/jungle-line-input.spec.js']
m['verificationSources']={p:sha(Path(p).read_bytes()) for p in paths}
(out/'pending-contract.json').write_text(json.dumps(m,indent=2)+'\n');print('Declared fresh full campaign:',len(checks),'checkpoints,',len(events),'events;independent replay pending.')
