"""Exploratory clock-only phase bounds;never reads motion expectations."""
if not __debug__:
    raise RuntimeError("SETUP: clock analysis requires assertions")
import base64,hashlib,json,math,struct,subprocess,sys
from pathlib import Path
assert len(sys.argv)==2,'Supply the saved capture directory'
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'reference/jungle-pic-clock-native.json').read_text())
root=Path(sys.argv[1])
assert manifest['kind']=='exploratory-jungle-pic-clock' and not manifest['accepted']
assert root.resolve()==(ROOT/manifest['producer']).resolve()
assert manifest['expectedCheckpointCount']==120 and manifest['expectedFrameSpan']==119 and manifest['expectedInputEvents']==2
assert manifest['injections']==[] and not manifest['partialRestore']
for spec in list(manifest['artifacts'].values())+[manifest['inputProfile'],manifest['build'],manifest['calibration'],manifest['analysis']]:
    p=ROOT/spec['path'];assert p.is_file(),'SETUP: missing '+str(p)
    b=p.read_bytes();assert len(b)==spec['bytes'] and hashlib.sha256(b).hexdigest()==spec['sha256'],'Corrupt clock artifact '+str(p)
assert hashlib.sha256(Path(__file__).read_bytes()).hexdigest()==manifest['analysisScriptSHA256']
subprocess.run(['node','--input-type=module','-e',"import{validateProducerArchive}from'./scripts/lib/consumer-provenance.js';await validateProducerArchive(process.argv[1]);",str(root)],cwd=ROOT,check=True)
life=json.loads((root/'lifecycle.json').read_text());capture=json.loads((root/'capture.json').read_text())
assert life['terminal'] and life['returnCode']==0 and not life['homeOverridden'] and not life['sharedSessionChanged']
assert capture['completed'] and capture['pid']==life['ownedPID']
assert capture['injections']==[] and not capture['partialRestore']
inputs=json.loads((root/'jungle-observer-inputs.json').read_text());replay=json.loads((root/'jungle-observer-replay.json').read_text())
assert inputs['events']==json.loads((ROOT/manifest['inputProfile']['path']).read_text())['events']
assert inputs['scheduled']['events_scheduled']==2 and len(inputs['events'])==2
assert not replay['active'] and replay['remaining']==0 and replay['dispatched']==2
engine=json.loads((root/'clock-engine.json').read_text())
assert hashlib.sha256((root/'portable/dosbox_with_debugger').read_bytes()).hexdigest()==engine['binarySHA256']
data=json.loads((root/'jungle-observer-result.json').read_text())
assert data['state']=='completed' and not data['output_truncated'] and data['output']['completed']
rows=[]
for line in data['output']['samplesCSV'].splitlines():
 values=line.split(',');assert len(values)==17
 rows.append({'index':int(values[0]),'frame':int(values[1]),'clock':int(values[2]),'ms':float(values[16])})
assert len(rows)==120
period=16380/1193182*1000
lo,hi=0.0,period
first_bad=None
for i,r in enumerate(rows):
 assert r['index']==i+1 and r['frame']==rows[0]['frame']+i and math.isfinite(r['ms'])
 if i:assert r['ms']>rows[i-1]['ms']
 elapsed=r['ms']-rows[0]['ms'];ticks=(r['clock']-rows[0]['clock'])&0xffffffff
 lo=max(lo,ticks*period-elapsed);hi=min(hi,(ticks+1)*period-elapsed)
 if lo>=hi and first_bad is None:first_bad={'index':r['index'],'lower':lo,'upper':hi}
entry=json.loads((root/'jungle-entry-clock.json').read_text())['emulatedMs']
memory=base64.b64decode(json.loads((root/'jungle-entry.json').read_text())['state']['results'][1]['data'])
entry_count=struct.unpack_from('<I',memory,0x2225)[0]
print(json.dumps({'kind':'exploratory-native-clock-phase','accepted':False,'usesMotionOutputs':False,
 'periodMs':period,'firstSampleMs':rows[0]['ms'],'lastSampleMs':rows[-1]['ms'],
 'entryMs':entry,'entryToFirstSampleMs':rows[0]['ms']-entry,
 'entryCounter':entry_count,'firstCounter':rows[0]['clock'],'clockSpan':rows[-1]['clock']-rows[0]['clock'],
 'feasibleConstantCounterPhase':lo<hi,'elapsedSinceLastTickBoundsMs':[lo,hi],
 'nextTickBoundsMs':[period-hi,period-lo],'firstClockContradiction':first_bad,
 'scope':'Clock stream only;constant period hypothesis with zero IRQ latency. No fitted pose phase,simulation run or native timing acceptance.'},indent=2))
if first_bad:sys.exit(1)
