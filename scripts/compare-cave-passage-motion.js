// Segment comparison only. Absolute loading/entry/native cadence still fails.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const run=spawnSync(process.execPath,['scripts/probe-cave-native-cadence.js'],{
  encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024,
});
assert.ifError(run.error);
assert.equal(run.status,1,'Expected the documented whole-cadence failure');
const begin=run.stdout.lastIndexOf('\n{');
assert.ok(begin>=0,run.stderr||'Missing completed probe result');
const result=JSON.parse(run.stdout.slice(begin+1));
assert.equal(result.kind,'exploratory-cave-native-comparison');
assert.equal(result.firstInputMatches,true);
assert.equal(result.comparisonPassed,false);
assert.equal(result.consumedReads,2);
assert.equal(result.events.length,4);
assert.equal(result.firstDifference.index,2);
const port=result.motionDiagnostic.port.slice(2,14);
const native=result.motionDiagnostic.native.slice(2,14);
// Compare only the explicitly observed exit sprite coordinates/pose and phase.
// Native frame callbacks can see coordinates before that party call's RNG work;
// port generator boundaries see them after. No RNG parity is claimed here.
const fields=['room','torch','partyX','partyY','partyFrame','entering'];
const pose=s=>Object.fromEntries(fields.map(k=>[k,s[k]]));
function check(actual,expected) {
  assert.equal(actual.length,12,'Incomplete exit pose sequence');
  assert.equal(expected.length,12,'Missing original exit poses');
  let intervals=0;
  for(let i=0;i<12;i++) {
    assert.deepEqual(pose(actual[i].state),pose(expected[i].state),`Exit pose${i}`);
    if(!i)continue;
    const delta=actual[i].ms-actual[i-1].ms;
    // Difference of two independently sampled transition brackets. This
    // measures frame duration,not a fitted origin or absolute start time.
    const lo=expected[i].bracketMs[0]-expected[i-1].bracketMs[1];
    const hi=expected[i].bracketMs[1]-expected[i-1].bracketMs[0];
    assert.ok(delta>=lo-1e-9 && delta<=hi+1e-9,`Exit interval${i}: ${delta} outside${lo}..${hi}`);
    intervals++;
  }
  assert.equal(intervals,11);
}
check(port,native);
let negatives=0;
for(const kind of ['missing-pose','changed-pose','changed-duration']) {
  const bad=structuredClone(port);
  if(kind==='missing-pose')bad.pop();
  else if(kind==='changed-pose')bad[3].state.partyX++;
  else bad[3].ms+=50;
  assert.throws(()=>check(bad,native),undefined,`Accepted ${kind}`);
  negatives++;
}
console.log(JSON.stringify({kind:'conditional-cave-exit-pose-duration',nativeTimingAcceptance:false,
  exactPoses:12,intervals:11,negatives,
  portAnimationSpanMs:port.at(-1).ms-port[0].ms,
  nativeAnimationSpanBracketMs:[native.at(-1).bracketMs[0]-native[0].bracketMs[1],native.at(-1).bracketMs[1]-native[0].bracketMs[0]],
  firstPosePortMs:port[0].ms,firstPoseNativeBracketMs:native[0].bracketMs,
  remainingFailure:result.firstDifference,
  scope:'Exit pose order and adjacent durations only. Absolute start/loading cadence,final state/RNG,entry animation and browser timing remain unaccepted.'},null,2));
