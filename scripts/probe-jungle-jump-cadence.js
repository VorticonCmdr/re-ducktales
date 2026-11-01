// Exploratory strict comparison;any state/timing divergence exits1.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { FlightMemory } from "../src/game/flight-physics.js";
import { jungleComponentResources } from "./jungle-component-replay.js";
import { jungleCadenceState as state, runJungleCadence } from "./lib/jungle-cadence-run.js";
import { RETRACE_HZ } from "../src/game/timing.js";
assert.ok(process.argv.length <= 3);
const manifestPath=process.argv[2] ?? "reference/jungle-jump-native.json";
execFileSync("python3",["scripts/verify_jungle_cadence.py",manifestPath],{
  env:{...process.env,PYTHONDONTWRITEBYTECODE:"1"},stdio:"inherit",
});
const m=JSON.parse(await readFile(manifestPath));
async function artifact(name) {
  const a=m.artifacts[name],b=await readFile(a.path);
  assert.equal(b.length,a.bytes);assert.equal(createHash("sha256").update(b).digest("hex"),a.sha256);
  return JSON.parse(b);
}
const entry=await artifact("jungle-entry.json"),contract=await artifact("jungle-entry-contract.json");
const provider=JSON.parse(await readFile("reference/jungle-keyboard-provider.json"));
assert.equal(provider.initialRepeatMilliseconds,500);assert.equal(provider.repeatMilliseconds,33);
const profileSpec=m.inputProfile;
const profileBytes=await readFile(profileSpec.path);
assert.equal(createHash("sha256").update(profileBytes).digest("hex"),profileSpec.sha256);
const profile=JSON.parse(profileBytes);
const walkHold=profile.kind==="original-jungle-walk-hold-physical-inputs";
assert.ok(walkHold || profile.kind==="original-jungle-jump-physical-inputs");
const scans=walkHold?[0x4d]:[0x4d,0x39];
const releaseFrame=walkHold?80:40;
const actual=runJungleCadence({
  entryBytes:Buffer.from(entry.state.results[1].data,"base64"),contract,
  resources:await jungleComponentResources(),provider,scans,releaseFrame,
  retraceHz:m.retraceHz ?? RETRACE_HZ,
});
// Expected states are first read after the independent input stream finishes.
const expectedState=async name=>state(new FlightMemory(Buffer.from((await artifact(name)).state.results[1].data,"base64")));
const nativeFirst=await expectedState("jungle-first-input.json"),nativeOpening=await expectedState("jungle-first-presentation.json");
const columns=["index","frame","clock","page","x","y","action","actorFrame","lostLives","column","row","scroll","outcome","right","fire","seed"];
const samples=(await artifact("jungle-observer-result.json")).output.samplesCSV.split("\n").map(line=>{
  const values=line.split(",").map(Number);assert.equal(values.length,columns.length);return Object.fromEntries(columns.map((key,i)=>[key,values[i]]));
});
assert.equal(samples.length,120);
const projection=s=>Object.fromEntries(Object.keys(actual.first).map(k=>[k,s[k]]));
const native=samples.filter((s,i)=>!i||["x","y","action"].some(k=>s[k]!==samples[i-1][k]));
const frameMs=1000/(m.retraceHz ?? RETRACE_HZ);
let firstDifference=null;
try {
  assert.deepEqual(actual.first,nativeFirst);assert.deepEqual(actual.opening,nativeOpening);
} catch {firstDifference={kind:"initial-state",portFirst:actual.first,nativeFirst,portOpening:actual.opening,nativeOpening};}
if(!firstDifference)for(let i=0;i<Math.max(actual.motion.length,native.length);i++) {
  const p=actual.motion[i],n=native[i];
  if(!p||!n){firstDifference={index:i,kind:"motion-count",port:p??null,native:n??null};break;}
  const bracket=[Math.max(0,n.index-2)*frameMs,(n.index-1)*frameMs];
  try {assert.deepEqual(p.state,projection(n));assert.ok(!i||(p.ms>=bracket[0]-1e-9&&p.ms<=bracket[1]+1e-9));}
  catch {firstDifference={index:i,kind:"state-or-time",port:p,native:{state:projection(n),bracketMs:bracket}};break;}
}
let finalMatches=true;try{assert.deepEqual(actual.final,projection(samples.at(-1)));}catch{finalMatches=false;}
const repeats = Math.max(0, Math.ceil((releaseFrame*frameMs-provider.initialRepeatMilliseconds)/provider.repeatMilliseconds));
assert.deepEqual(actual.events.map(e=>e.kind),["make",...Array(repeats).fill("repeat"),"break"]);
assert.equal(actual.events.reduce((n,e)=>n+e.scans.length,0),scans.length*2+repeats);
const passed=!firstDifference&&finalMatches;
console.log(JSON.stringify({kind:walkHold?"exploratory-jungle-walk-hold-cadence":"exploratory-jungle-jump-cadence",accepted:false,comparisonPassed:passed,
  environment:"Native ENTRY memory;zero-phase driver/retrace;independent physical input profile;500/33ms repeats only last physical key;immediate IRQ delivery,no browser or i8042 phase.",
  inputProfile:profile,
  consumedReads:actual.inputs.length,events:actual.events,firstDifference,finalMatches,
  portMotion:actual.motion,nativeMotion:native.map(s=>({state:projection(s),bracketMs:[Math.max(0,s.index-2)*frameMs,(s.index-1)*frameMs]})),
  final:actual.final,nativeFinal:projection(samples.at(-1))},null,2));
if(!passed)process.exitCode=1;
