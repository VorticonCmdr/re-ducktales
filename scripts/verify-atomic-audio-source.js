import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/atomic-audio-source.json"),
  { image } = await originalGame();
assert.equal(m.kind, "atomic-audio-static-source");
await checkArtifacts({ build: m.build });
const exe = await readFile(m.analysisExecutable);
assert.equal(sha(exe), m.analysisSha256);
const header = exe.readUInt16LE(8) * 16;
assert.equal(m.ranges.length, 2);
for (const [i, expected] of [
  [0, [0x490, 58, [0x4a7, 0x4b3]]],
  [1, [0x531, 66, [0x548, 0x554]]],
]) {
  const r = m.ranges[i];
  assert.deepEqual([r.offset, r.length, r.relocations], expected);
  await checkArtifacts({ ghidra: r.artifact });
  const original = Buffer.from(image.subarray(r.offset, r.offset + r.length)),
    prepared = Buffer.from(
      exe.subarray(header + r.offset, header + r.offset + r.length),
    );
  assert.equal(sha(original), r.sha256);
  assert.deepEqual(prepared, original, "Undeclared analysis edit");
  const relocs = [];
  for (let i = 0; i < exe.readUInt16LE(6); i++) {
    const p = exe.readUInt16LE(24) + i * 4,
      at = exe.readUInt16LE(p) + 16 * exe.readUInt16LE(p + 2);
    if (at >= r.offset && at + 2 <= r.offset + r.length) {
      relocs.push(at);
      prepared.writeUInt16LE(
        (prepared.readUInt16LE(at - r.offset) + 0x1000) & 65535,
        at - r.offset,
      );
    }
  }
  assert.deepEqual(
    relocs.sort((a, b) => a - b),
    r.relocations,
  );
  const raw = await json(r.artifact.path);
  assert.equal(raw.isError, false);
  const gh = JSON.parse(raw.content[0].text);
  assert.equal(gh.program, m.program);
  assert.equal(gh.address, r.address);
  assert.equal(gh.length, r.length);
  assert.deepEqual(Buffer.from(gh.hex, "hex"), prepared);
}
for (const [at, hex] of [
  [0x490, "803ebe0300740a2bc050ff1e1c2083c402"],
  [0x531, "803ebe0300740a2bc050ff1e1c2083c402"],
  [0x559, "803ebe0300740bb8450050ff1e1c2083c402ff1e28200bc075f8"],
])
  assert.equal(
    Buffer.from(image.subarray(at, at + hex.length / 2)).toString("hex"),
    hex,
  );
console.log(
  "Atomic audio:124 original/prepared/Ghidra bytes,four relocations;enabled0/54/45,unconditional global-status spin without input/timed wait. Static proof,not native latency/phase acceptance.",
);
