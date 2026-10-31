// Historical browser observation and exact original caller bytes, not native
// elapsed timing or an acceptance of the still-legacy award implementation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/award-input-investigation.json");
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await checkArtifacts(m.artifacts);
const { image } = await originalGame();
for (const [offset, length, hash] of [
  [m.range.offset, m.range.length, m.range.sha256],
  [m.sharedReader.imageOffset, m.sharedReader.length, m.sharedReader.sha256],
])
  assert.equal(sha(image.subarray(offset, offset + length)), hash);
assert.equal(m.range.offset, 0xc48);
assert.equal(m.range.length, 34);
assert.equal(m.sharedReader.length, 88);
const original = Buffer.from(image.subarray(0xc48, 0xc6a));
assert.equal(original.subarray(0, 9).toString("hex"), "b82800509af509c401");
assert.equal(
  original.subarray(12).toString("hex"),
  "0bc07412803ebe0300740bb8240050ff1e1c2083c402",
);
const exe = await readFile(m.analysisExecutable);
assert.equal(sha(exe), m.analysisExecutableSha256);
const header = exe.readUInt16LE(8) * 16,
  prepared = Buffer.from(exe.subarray(header + 0xc48, header + 0xc6a));
assert.deepEqual(prepared, original);
let count = 0;
for (let i = 0; i < exe.readUInt16LE(6); i++) {
  const at = exe.readUInt16LE(24) + i * 4,
    off = exe.readUInt16LE(at) + exe.readUInt16LE(at + 2) * 16;
  if (off >= 0xc48 && off + 2 <= 0xc6a) {
    prepared.writeUInt16LE(
      (prepared.readUInt16LE(off - 0xc48) + 0x1000) & 65535,
      off - 0xc48,
    );
    count++;
  }
}
assert.equal(count, 1);
const raw = await json(m.artifacts["ghidra-award-bytes.json"].path);
assert.equal(raw.isError, false);
const gh = JSON.parse(raw.content[0].text);
assert.equal(gh.program, "INVESTMENT_CODE.EXE");
assert.equal(gh.address, m.range.address);
assert.deepEqual(prepared, Buffer.from(gh.hex, "hex"));
const root = m.artifacts["probe.json"].path.replace(/\/probe.json$/, ""),
  source = await validateProducerArchive(root);
assert.equal(source.commit, m.sourceCommit);
const probe = await json(m.artifacts["probe.json"].path);
assert.equal(probe.restart, true);
assert.equal(probe.notes.length, 12);
const before = probe.notes.find((p) => p.name === "award"),
  after = probe.notes.find((p) => p.name === "award-p-probe");
assert.equal(before.at, 84717);
assert.equal(after.at, 84733);
assert.equal(before.state.tick, 6170);
assert.equal(after.state.tick, 6171);
assert.equal(before.state.expeditionResult.remaining, 280);
assert.equal(after.state.expeditionResult.remaining, 279);
assert.equal(after.state.systemOverlay.kind, "pause");
assert.equal(after.state.money, 3400);
assert.deepEqual(m.memoryInjections, []);
assert.deepEqual(m.fittedInputs, []);
console.log(
  "Award investigation:122 original bytes,34 relocated Ghidra bytes,and early-Pause browser observation verified;40-read wait/conditional click24 inferred statically,no native award-input timing acceptance.",
);
