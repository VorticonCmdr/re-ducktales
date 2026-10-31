import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/report-presentation-source.json");
assert.equal(m.kind, "report-presentation-static-source");
await checkArtifacts(m.artifacts);
const { image } = await originalGame(), e = await readFile(m.analysisExecutable);
assert.equal(sha(e), m.analysisSha256);
const raw = await json(m.artifacts.ghidra.path), header = e.readUInt16LE(8) * 16;
assert.deepEqual(m.analysisNormalizations, [{ offset: 0x26be, original: "9a9e1e0e04", prepared: "81ec120090" }]);
assert.deepEqual(m.ranges.map((r) => [r.offset, r.length]), [[0x26b8, 805], [0x326, 180], [0xe82, 253]]);
assert.equal(raw.ranges.length, 3);
let bytes = 0, relocations = 0;
for (const [i, r] of m.ranges.entries()) {
  const b = Buffer.from(image.subarray(r.offset, r.offset + r.length));
  for (const p of m.analysisNormalizations) if (p.offset >= r.offset && p.offset + 5 <= r.offset + r.length) {
    assert.equal(b.subarray(p.offset - r.offset, p.offset - r.offset + 5).toString("hex"), p.original);
    Buffer.from(p.prepared, "hex").copy(b, p.offset - r.offset);
  }
  assert.deepEqual(e.subarray(header + r.offset, header + r.offset + r.length), b);
  const found = [];
  for (let n = 0; n < e.readUInt16LE(6); n++) {
    const at = e.readUInt16LE(24) + 4 * n,
      offset = e.readUInt16LE(at) + 16 * e.readUInt16LE(at + 2);
    if (offset >= r.offset && offset + 2 <= r.offset + r.length) {
      found.push(offset);
      b.writeUInt16LE((b.readUInt16LE(offset - r.offset) + 0x1000) & 65535, offset - r.offset);
    }
  }
  assert.deepEqual(found, r.relocations);
  assert.equal(raw.ranges[i].isError, false);
  const g = JSON.parse(raw.ranges[i].content[0].text);
  assert.equal(g.program, m.program);
  assert.equal(g.address, r.address);
  assert.equal(g.length, r.length);
  assert.deepEqual(Buffer.from(g.hex, "hex"), b);
  bytes += b.length; relocations += found.length;
}
function hex(at, length) { return Buffer.from(image.subarray(at, at + length)).toString("hex"); }
// Case3(player)/10(rival) invoke the shared fill/wipe/copy/flush helper.
assert.equal(hex(0xe82, 4), "b8030050");
assert.equal(hex(0x326, 4), "b80a0050");
assert.equal(hex(0x26b0 + 0x15e, 4), "b80a0050");
// Rival sound6e precedes reveal,then flush19a5 and the status/input reader.
assert.equal(hex(0x26b0 + 0x282, 4), "ff1e1c20");
assert.equal(hex(0x26b0 + 0x289, 4), "ff1edc1f");
assert.equal(hex(0x26b0 + 0x28d, 3), "9aa519");
assert.equal(hex(0x26b0 + 0x2d5, 4), "ff1ee01f");
assert.equal(hex(0x26b0 + 0x2e0, 4), "b8210050");
const helper = spawnSync(process.execPath, ["scripts/verify-award-presentation-source.js"], { encoding: "utf8" });
assert.equal(helper.status, 0, helper.stdout + helper.stderr);
console.log(`Report presentation source:${bytes} mapped original/prepared/Ghidra bytes,${relocations} relocations,one declared5-byte analysis stack-probe replacement;shared picture3/10 entry wipe,rival6e before reveal/flush and21 after exit wipe. Static evidence only;report transition runtime remains pending.`);
