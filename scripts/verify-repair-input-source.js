import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/repair-input-source.json"),
  { image } = await originalGame();
assert.equal(m.kind, "repair-input-static-source");
assert.equal(m.program, "INVESTMENT_CODE.EXE");
const exe = await readFile(m.analysisExecutable),
  header = exe.readUInt16LE(8) * 16;
assert.equal(sha(exe), m.analysisSha256);
assert.deepEqual(
  m.ranges.map((r) => [r.offset, r.length, r.relocations]),
  [
    [0x8ea, 74, [0x932, 0x8fa]],
    [0xae1, 45, [0xaec]],
  ],
);
for (const r of m.ranges) {
  await checkArtifacts({ ghidra: r.artifact });
  const original = Buffer.from(image.subarray(r.offset, r.offset + r.length));
  assert.equal(sha(original), r.sha256);
  const loaded = Buffer.from(
    exe.subarray(header + r.offset, header + r.offset + r.length),
  );
  assert.deepEqual(loaded, original, "Undeclared analysis edit");
  const found = [];
  for (let i = 0; i < exe.readUInt16LE(6); i++) {
    const at = exe.readUInt16LE(24) + 4 * i,
      where = exe.readUInt16LE(at) + 16 * exe.readUInt16LE(at + 2);
    if (where >= r.offset && where + 2 <= r.offset + r.length) {
      found.push(where);
      const at = where - r.offset;
      loaded.writeUInt16LE((loaded.readUInt16LE(at) + 0x1000) & 65535, at);
    }
  }
  assert.deepEqual(found, r.relocations);
  const g = await json(r.artifact.path);
  assert.equal(g.program, m.program);
  assert.equal(g.address, r.address);
  assert.equal(g.length, r.length);
  assert.deepEqual(loaded, Buffer.from(g.hex, "hex"));
}
for (const [at, hex] of [
  [
    0x8ea,
    "80060e4e02ff1edc1fb83c00509af509c40183c4020bc07412803ebe0300740bb8240050ff1e1c2083c402ff1ee01f",
  ],
  [0x919, "833ec28c007d03e9a7fb7f0a833ec08c007503e99bfb"],
  [
    0xae1,
    "ff1edc1fb86400509af509c40183c4020bc07412803ebe0300740bb8240050ff1e1c2083c402ff1ee01fe9bcf9",
  ],
])
  assert.equal(
    Buffer.from(image.subarray(at, at + hex.length / 2)).toString("hex"),
    hex,
    "Original repair rule " + at.toString(16),
  );
console.log(
  "Repair source:119 original/Ghidra bytes,three declared relocations;day+2,shared60/100 readers,conditional24,no local synthetic sound0,signed cash gate. Static evidence,not native timing parity.",
);
