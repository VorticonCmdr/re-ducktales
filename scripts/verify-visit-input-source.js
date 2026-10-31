// Strict original/prepared/Ghidra identity proof. Local artifacts are required.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/visit-input-source.json");
await checkArtifacts(m.artifacts);
const { image } = await originalGame(),
  exe = await readFile(m.analysisExecutable);
assert.equal(m.kind, "collected-notice-static-source");
assert.equal(sha(exe), m.analysisSha256);
const header = exe.readUInt16LE(8) * 16;
assert.equal(m.ranges.length, 2);
for (const [i, expected] of [
  [
    0,
    {
      offset: 0x3a2,
      length: 151,
      relocations: [0x3bb, 0x3cd, 0x3e5, 0x421, 0x42d],
    },
  ],
  [1, { offset: 0xf56, length: 41, relocations: [0xf5d] }],
]) {
  const range = m.ranges[i];
  assert.equal(range.offset, expected.offset);
  assert.equal(range.length, expected.length);
  assert.deepEqual(range.relocations, expected.relocations);
  const original = Buffer.from(
    image.subarray(range.offset, range.offset + range.length),
  );
  assert.equal(sha(original), range.sha256);
  const prepared = Buffer.from(
    exe.subarray(header + range.offset, header + range.offset + range.length),
  );
  assert.deepEqual(prepared, original, "Undeclared analysis modification");
  const relocations = [];
  for (let n = 0; n < exe.readUInt16LE(6); n++) {
    const p = exe.readUInt16LE(24) + n * 4,
      at = exe.readUInt16LE(p) + 16 * exe.readUInt16LE(p + 2);
    if (at >= range.offset && at + 2 <= range.offset + range.length) {
      relocations.push(at);
      const k = at - range.offset;
      prepared.writeUInt16LE((prepared.readUInt16LE(k) + 0x1000) & 65535, k);
    }
  }
  assert.deepEqual(
    relocations.sort((a, b) => a - b),
    range.relocations,
  );
  const response = await json(m.artifacts[range.name].path);
  assert.equal(response.isError, false);
  const g = JSON.parse(response.content[0].text);
  assert.equal(g.program, "INVESTMENT_CODE.EXE");
  assert.equal(g.address, range.address);
  assert.equal(g.length, range.length);
  assert.deepEqual(Buffer.from(g.hex, "hex"), prepared);
}
for (const [at, hex] of [
  [0xf56, "b85000509af509c401"], // shared wait80
  [0xf66, "803ebe0300740bb8240050ff1e1c2083c402ff1ee01f"],
  [0x3a2, "803ebe0300740bb86e0050ff1e1c2083c402ff1edc1f"],
  [0x3c2, "ff1e28200bc0740e9a020024018946ecf646ecc07443"],
  [0x3de, "b82800509af509c401"], // fallback40
  [0x404, "803ebe0300740a2bc050ff1e1c2083c402"], // rival-only exit stop
  [0x426, "b80700509acc0d0e0483c402c746ec0100eb89"],
])
  assert.equal(
    Buffer.from(image.subarray(at, at + hex.length / 2)).toString("hex"),
    hex,
    "Original notice rule at" + at.toString(16),
  );
console.log(
  "Collected notices:192 original/prepared/Ghidra bytes;player80,rival40 fallback/status loop7;conditional click;no player stop;conditional rival exit0. Static evidence,not native notice timing parity.",
);
