// Live browser clock-boundary evidence,not native movement/campaign acceptance.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProducerArchive, acceptedRuntimeSource } from './lib/consumer-provenance.js';
import { json, sha } from './lib/local-scenario-source.js';
import { DRIVER_HZ, RETRACE_HZ } from '../src/game/timing.js';
const manifest=await json('reference/movement-browser-clock.json');
assert.equal(manifest.kind,'live-browser-movement-clock');
assert.equal(manifest.expectedCases,1);
assert.equal(manifest.nativeTimingAcceptance,false);
const source=await validateProducerArchive(manifest.producer);
for(const [path,hash] of Object.entries(source.files))
  if(acceptedRuntimeSource(path))assert.equal(sha(await readFile(path)),hash,`Runtime changed: ${path}`);
const build=await json('reference/build.json');
for(const[name,spec]of Object.entries(build.files)) {
  const b=await readFile(`game/${name}`);assert.equal(b.length,spec.bytes);assert.equal(sha(b),spec.sha256);
}
const spec=manifest.artifact,b=await readFile(spec.path);
assert.equal(b.length,spec.bytes);assert.equal(sha(b),spec.sha256,'Corrupt browser clock fixture');
const recording=JSON.parse(b);
const epsilon=1e-7; // Floating-point subtraction of millisecond origins only.
function check(data) {
  assert.equal(data.cases.length,1,'Zero or missing browser clock cases');
  assert.deepEqual(data.events,[{type:'native-key-hold',key:'Right',durationMs:1000}]);
  assert.deepEqual(data.browserErrors,[]);
  for(const c of data.cases) {
    const {before:a,after:z,hostIntervalMs:bounds}=c;
    assert.equal(a.scene,'jungle');assert.equal(z.scene,'jungle');
    assert.equal(a.diagnostic,null);assert.equal(z.diagnostic,null);
    for(const s of [a,z]) {
      const t=s.timing;
      for(const k of ['wallMilliseconds','simulationMilliseconds','originMilliseconds','pausedMilliseconds'])
        assert.ok(Number.isFinite(t[k]),`Missing browser clock ${k}`);
      assert.ok(Math.abs(t.wallMilliseconds-t.originMilliseconds-t.pausedMilliseconds-t.simulationMilliseconds)<=epsilon,'Clock consumption contract');
      assert.equal(s.tick,Math.floor(t.simulationMilliseconds*DRIVER_HZ/1000),'Browser driver count');
    }
    assert.equal(a.timing.originMilliseconds,z.timing.originMilliseconds);
    assert.equal(a.timing.pausedMilliseconds,z.timing.pausedMilliseconds);
    const elapsed=z.timing.simulationMilliseconds-a.timing.simulationMilliseconds;
    const wall=z.timing.wallMilliseconds-a.timing.wallMilliseconds;
    assert.ok(elapsed>=1000&&elapsed<=1250,'Incomplete or oversized observation');
    assert.ok(Math.abs(elapsed-wall)<=epsilon,'Browser clock scale changed');
    assert.ok(bounds.length===2&&bounds.every(Number.isFinite)&&bounds[0]>0&&bounds[1]>=bounds[0]&&bounds[1]-bounds[0]<=250);
    assert.ok(wall>=bounds[0]-epsilon&&wall<=bounds[1]+epsilon,'Browser time outside independent host interval');
    assert.ok(z.tick>a.tick);
    assert.equal(z.jungle.tick-a.jungle.tick,z.tick-a.tick,'Jungle driver clock drift');
    assert.equal(z.jungle.retrace-a.jungle.retrace,
      Math.floor(z.timing.simulationMilliseconds*RETRACE_HZ/1000)-Math.floor(a.timing.simulationMilliseconds*RETRACE_HZ/1000),'Jungle retrace clock drift');
    assert.ok(z.jungle.frames>a.jungle.frames&&z.jungle.frames-a.jungle.frames<=z.jungle.retrace-a.jungle.retrace,'No rendered simulation advancement');
    assert.notDeepEqual([z.jungle.x,z.jungle.y],[a.jungle.x,a.jungle.y],'Movement input had no observed effect');
  }
}
check(recording);
let negatives=0;
for(const kind of ['tick','simulation','wall','input','zero']) {
  const bad=structuredClone(recording);
  if(kind==='tick')bad.cases[0].after.tick++;
  else if(kind==='simulation')bad.cases[0].after.timing.simulationMilliseconds+=50;
  else if(kind==='wall')bad.cases[0].after.timing.wallMilliseconds*=2;
  else if(kind==='input')bad.events.pop();
  else bad.cases=[];
  assert.throws(()=>check(bad),undefined,`Accepted altered ${kind}`);negatives++;
}
assert.equal(negatives,5);
console.log('Live browser clock:1 actual jungle movement case;exact driver/retrace counts and1x clock consumption;independent host interval;22 originals;5 negatives. Not native movement timing or campaign acceptance.');
