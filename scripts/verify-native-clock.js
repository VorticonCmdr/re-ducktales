// Validate the private read-only capture clock before using game observations.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { json,sha } from './lib/local-scenario-source.js';
import { validateProducerArchive } from './lib/consumer-provenance.js';
const m=await json('reference/native-clock-calibration.json');
assert.equal(m.kind,'read-only-native-clock-calibration');assert.equal(m.nativeTimingAcceptance,false);
await validateProducerArchive(m.producer);
const objects={};
for(const[name,spec]of Object.entries(m.artifacts)) {
  const b=await readFile(spec.path);assert.equal(b.length,spec.bytes);assert.equal(sha(b),spec.sha256,`Corrupt clock artifact ${name}`);objects[name]=JSON.parse(b);
}
const engine=objects['observer-engine.json'];assert.ok(engine.revision.startsWith(m.engineRevision));
for(const[name,hash]of Object.entries(engine.files)) {
  const bytes=execFileSync('git',['show',`${engine.revision}:${name}`],{cwd:engine.sourceRoot});
  assert.equal(sha(bytes),hash,`Observer engine source ${name}`);
}
assert.equal(sha(await readFile(m.producer+'/portable/dosbox_with_debugger')),engine.binarySHA256);
const api=execFileSync('git',['show',`${engine.revision}:src/lua/lua_api.cpp`],{cwd:engine.sourceRoot,encoding:'utf8'});
assert.ok(api.includes('lua_pushnumber(L, PIC_FullIndex());\n\treturn 1;'));
assert.ok(api.includes('lua_setfield(L, -2, "emulated_time_ms");'));
const script=objects['script.json'];assert.equal(sha(Buffer.from(script.source)),script.sha256);
assert.ok(script.source.includes("assert(first == second, 'Reading PIC time changed emulation time')"));
const result=objects['result.json'];assert.equal(result.state,'completed');assert.equal(result.output_truncated,false);assert.equal(result.output.completed,true);
const rows=result.output.samplesCSV.split('\n').map(s=>s.split(','));
function check(samples) {
  assert.equal(samples.length,m.expectedSamples);assert.equal(samples.length,61);
  assert.deepEqual(samples[0],m.expectedFirstSample);assert.deepEqual(samples.at(-1),m.expectedLastSample);
  for(const[i,row]of samples.entries()) {
    assert.equal(row.length,3);assert.equal(Number(row[0]),i+1);
    assert.ok(/^\d+$/.test(row[1])&&/^\d+\.\d{9}$/.test(row[2]));
    if(i) {
      assert.equal(Number(row[1]),Number(samples[i-1][1])+1,'Skipped callback');
      const span=Number(row[2])-Number(samples[i-1][2]);
      // Coarse shell/VGA sanity only;not a fitted game frame-rate tolerance.
      assert.ok(span>=14&&span<=15,'Nonmonotonic or implausible VGA PIC timestamps');
    }
  }
  assert.equal(Number(samples.at(-1)[1])-Number(samples[0][1]),m.expectedFrameSpan);assert.equal(m.expectedFrameSpan,60);
}
check(rows);
let negatives=0;
for(const kind of ['missing','frame','backwards','last']) {
  const bad=structuredClone(rows);
  if(kind==='missing')bad.pop();
  else if(kind==='frame')bad[20][1]=String(Number(bad[20][1])+1);
  else if(kind==='backwards')bad[20][2]=bad[19][2];
  else bad.at(-1)[2]=String(Number(bad.at(-1)[2])+1);
  assert.throws(()=>check(bad),undefined,`Accepted altered ${kind}`);negatives++;
}
assert.equal(negatives,4);
const life=objects['lifecycle.json'],info=objects['engine.json'],capture=objects['capture.json'];
assert.ok(life.terminal);assert.equal(life.returnCode,0);assert.equal(life.ownedPID,info.pid);
assert.equal(life.homeOverridden,false);assert.equal(life.sharedSessionChanged,false);
assert.equal(capture.completed,true);assert.deepEqual(capture.inputs,[]);assert.deepEqual(capture.guestWrites,[]);assert.equal(capture.partialRestore,false);
console.log('Private PIC clock:61 complete callbacks/60 intervals;equal duplicate reads;source/binary identities;closed owned session;4 corruption controls. No game timing acceptance.');
