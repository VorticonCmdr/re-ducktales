// Conditional original-driver comparison. Inputs are authored independently;
// complete expected7253-byte results come only from the retained native run.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { SpeakerDriver } from "../src/speaker-driver.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
const sha=b=>createHash("sha256").update(b).digest("hex");
const m=JSON.parse(await readFile("reference/speaker-note-gate-native.json"));
assert.equal(m.kind,"conditional-original-speaker-note-gate");
assert.equal(m.expectedCases,3);assert.equal(m.expectedNegativeControls,3);
assert.equal(m.nativeTimingAccepted,false);assert.equal(m.browserAccepted,false);
async function artifact(a) {
  const b=await readFile(a.path);assert.equal(b.length,a.bytes);assert.equal(sha(b),a.sha256);return b;
}
const packet={};
for(const[name,a]of Object.entries(m.artifacts)) {
  const b=await artifact(a);packet[name]=a.path.endsWith(".json")?JSON.parse(b):b;
}
await validateProducerArchive(m.producer);
const inputs=JSON.parse(await artifact(m.inputs));
assert.equal(inputs.kind,"conditional-speaker-note-gate-inputs");
assert.deepEqual(inputs.cases,[{gate:0,previousCounter:7},{gate:3,previousCounter:7},{gate:0,previousCounter:255}]);
const {archives}=await originalGame(),original=archives.get("IT.DRV")[5].data;
assert.equal(sha(original),m.driverSHA256);
const f=packet["fixture.json"],capture=packet["capture.json"],life=packet["lifecycle.json"];
assert.equal(f.programSHA256,sha(packet["fixture/NOTEGATE.COM"]));
assert.deepEqual(f.inputs,inputs);assert.deepEqual(f.resultOffsets,[0x4000,0x6000,0x8000]);
assert.deepEqual(packet["fixture/NOTEGATE.COM"].subarray(0x100,0x100+7253),Buffer.from(original));
assert.equal(capture.completed,true);assert.equal(capture.cases,3);assert.equal(capture.accepted,false);
assert.equal(capture.partialRestore,false);assert.equal(capture.naturalMachineCheckpoint,false);
assert.equal(life.terminal,true);assert.equal(life.returnCode,0);assert.equal(life.homeOverridden,false);assert.equal(life.sharedSessionChanged,false);
assert.equal(life.ownedPID,packet["engine.json"].pid);
assert.equal(packet["engine.json"].capabilities.debugger.limits.effective_core,"normal");
const tool=packet["tool-identity.json"];
assert.equal(tool.binarySHA256,m.engineBinarySHA256);assert.equal(sha(packet["portable/dosbox_with_debugger"]),tool.binarySHA256);
const source=packet["source-revision.json"];
assert.equal(tool.scriptSHA256,source.files["scripts/capture-speaker-note-gate.py"]);
assert.equal(sha(await artifact(m.inputs)),source.files["reference/speaker-note-gate-inputs.json"]);
const stop=packet["program-stop.json"],cpu=stop.registers;
assert.equal(stop.satisfied,true);assert.equal(stop.protected_mode,false);assert.equal(cpu.eax&65535,0x4c00);
assert.equal(cpu.cs,capture.segment);assert.equal(cpu.ds,cpu.cs);assert.equal(cpu.ss,cpu.cs);assert.equal(cpu.esp&65535,0xf000);
assert.equal(cpu.flags&0x600,0);
const result=packet["driver-results.json"];
assert.equal(result.aborted,false);assert.equal(result.results.length,4);assert.ok(result.results.every(r=>r.status==="ok"));
const states=result.results.map(r=>Buffer.from(r.data,"base64"));
for(const state of states) {
  assert.equal(state.length,7253);assert.deepEqual(state.subarray(0x2a8,0x8cb),Buffer.from(original.slice(0x2a8,0x8cb)));
}
assert.deepEqual(states[0],states[3],"Unfinished final case copy");
const listing=JSON.parse(packet["sequencer-source"].content[0].text);
assert.equal(listing.success,true);assert.equal(listing.truncated,false);assert.equal(listing.program,"driver-5.bin");
let at=0x5ac;assert.equal(listing.instructions.length,297);
for(const i of listing.instructions) {
  assert.equal(i.address,`0000:${at.toString(16).padStart(4,"0")}`);
  const b=Buffer.from(i.bytes,"hex");assert.equal(b.length,i.length);assert.deepEqual(b,Buffer.from(original.slice(at,at+b.length)));at+=b.length;
}
assert.equal(at,0x8cb);
const instructions=new Map(listing.instructions.map(i=>[i.address,i.bytes]));
assert.equal(instructions.get("0000:066c"),"803e6a0200");
assert.equal(instructions.get("0000:0671"),"7416");
assert.equal(instructions.get("0000:0685"),"88266b02");
assert.equal(original[inputs.notePointer+1],1);
function compare(Driver=SpeakerDriver,expected=states.slice(1),events=inputs.cases) {
  assert.equal(events.length,3,"Missing note gate input");assert.equal(expected.length,3,"Missing native note gate case");
  for(const[i,event]of events.entries()) {
    const d=new Driver(original);
    for(const[a,v]of [[0x269,1],[0x268,255],[0x258,1],[0x250,1],[0x26a,event.gate],[0x26b,event.previousCounter]])d.b(a,v);
    d.w(0x24e,inputs.notePointer);d.tick();
    assert.equal(Buffer.compare(Buffer.from(d.memory),expected[i]),0,`Native speaker note state diverged at case${i}`);
    assert.equal(expected[i][0x26b],event.gate?event.gate*(original[inputs.notePointer+1]>>>2)&255:event.previousCounter);
  }
}
compare();
const historical=execFileSync("git",["show",m.historicalImplementation.commit+":src/speaker-driver.js"]);
assert.equal(sha(historical),m.historicalImplementation.sha256);
const {SpeakerDriver:OldDriver}=await import("data:text/javascript;base64,"+historical.toString("base64"));
assert.throws(()=>compare(OldDriver),/Native speaker note state diverged at case0/);
assert.throws(()=>compare(SpeakerDriver,states.slice(1),inputs.cases.slice(1)),/Missing note gate input/);
const wrong=states.slice(1).map(b=>Buffer.from(b));wrong[2][0x26b]^=1;
assert.throws(()=>compare(SpeakerDriver,wrong),/Native speaker note state diverged at case2/);
console.log("Original speaker note gate:3 conditional cases,all7253 driver bytes exact;disabled gating preserves7/255,enabled gating writes0;799 source bytes/297 instructions,closed private session,3 negatives including historical implementation. Not natural timing or browser acceptance.");
