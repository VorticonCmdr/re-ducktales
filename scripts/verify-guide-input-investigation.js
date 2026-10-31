// Scoped static proof and browser observation. Exact original/analysis bytes are
// checked;no original guide runtime timing or independent guide replay is inferred.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/guide-input-investigation.json");
await checkArtifacts(m.artifacts);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
const { image } = await originalGame();
for (const range of [m.guide, m.sharedReader])
  assert.equal(
    sha(image.subarray(range.imageOffset, range.imageOffset + range.length)),
    range.sha256,
  );
assert.equal(m.guide.length, 300);
assert.equal(m.sharedReader.length, 88);
const exe = await readFile(m.analysisExecutable).catch(() => {
    throw Error(
      "SETUP: missing local analysis image;run python3 scripts/prepare-investment-analysis.py",
    );
  }),
  patch = await json(m.analysisPatchManifest);
assert.equal(sha(exe), m.analysisExecutableSha256);
assert.equal(patch.outputSha256, m.analysisExecutableSha256);
const header = exe.readUInt16LE(8) * 16,
  begin = m.guide.imageOffset,
  end = begin + m.guide.length,
  prepared = Buffer.from(exe.subarray(header + begin, header + end)),
  original = Buffer.from(image.subarray(begin, end));
const probes = patch.stackProbes.filter(([at]) => at >= begin && at + 5 <= end);
assert.equal(probes.length, 1);
for (const [at, before, after] of probes) {
  assert.equal(
    original.subarray(at - begin, at - begin + 5).toString("hex"),
    before,
  );
  original.set(Buffer.from(after, "hex"), at - begin);
}
assert.deepEqual(prepared, original, "Undeclared analysis edits");
let relocations = 0;
for (let i = 0; i < exe.readUInt16LE(6); i++) {
  const at = exe.readUInt16LE(24) + i * 4,
    offset = exe.readUInt16LE(at) + exe.readUInt16LE(at + 2) * 16;
  if (offset >= begin && offset + 2 <= end) {
    prepared.writeUInt16LE(
      (prepared.readUInt16LE(offset - begin) + 0x1000) & 65535,
      offset - begin,
    );
    relocations++;
  }
}
assert.equal(relocations, 3);
const ghidra = await json(m.artifacts["ghidra-guide-bytes.json"].path);
assert.equal(ghidra.isError, false);
const raw = JSON.parse(ghidra.content[0].text);
assert.equal(raw.program, m.program);
assert.equal(raw.address, m.guide.address);
assert.deepEqual(prepared, Buffer.from(raw.hex, "hex"));
for (const [name, call] of [
  ["ghidra-guide.json", "FUN_11c4_09f5(0x1e)"],
  ["ghidra-shared-reader.json", "FUN_1124_0002()"],
]) {
  const r = await json(m.artifacts[name].path);
  assert.equal(r.isError, false);
  const fn = JSON.parse(r.content[0].text);
  assert.equal(fn.language_id, m.language);
  assert.ok(fn.decompiled_code.includes(call));
}
assert.equal(
  Buffer.from(image)
    .subarray(0x2dc6, 0x2dda)
    .includes(Buffer.from("b81e00509af509c401", "hex")),
  true,
  "Original guide must push30 and call shared09f5",
);
const root = m.artifacts["probe.json"].path.replace(/\/probe.json$/, "");
const source = await validateProducerArchive(root);
assert.equal(source.commit, m.browserProbe.sourceCommit);
const probe = await json(m.artifacts["probe.json"].path);
assert.equal(probe.idle, 6);
assert.equal(probe.restart, true);
assert.equal(probe.notes.length, 21);
const arrival = probe.notes.find((p) => p.name === "arrival"),
  paused = probe.notes.find((p) => p.name === "guide-p-probe");
assert.equal(arrival.at, 92545);
assert.equal(paused.at, 92561);
assert.equal(arrival.state.tick, 6741);
assert.equal(paused.state.tick, 6742);
assert.equal(arrival.state.scene, "expedition-briefing");
assert.equal(paused.state.scene, "expedition-briefing");
assert.equal(arrival.state.briefing.remaining, 210);
assert.equal(paused.state.briefing.remaining, 210);
assert.equal(arrival.state.systemOverlay, null);
assert.equal(paused.state.systemOverlay.kind, "pause");
assert.equal(paused.state.systemOverlay.phase, "lock");
assert.deepEqual(m.browserProbe.memoryInjections, []);
assert.deepEqual(m.browserProbe.fittedInputs, []);
console.log(
  "Guide static investigation:388 original bytes,300 Ghidra bytes matched with1 declared stack-probe patch and3 relocations;shared09f5(30);historical pre-fix early guide Pause observation verified,not native guide timing acceptance.",
);
