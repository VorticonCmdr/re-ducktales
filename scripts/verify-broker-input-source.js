import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/broker-input-source.json");
assert.equal(m.kind, "broker-input-static-source");
const { image } = await originalGame();
await checkArtifacts({ build: m.build, ghidra: m.artifact });
const executable = await readFile("game/DUCKTALE.EXE"),
  o = m.overlay,
  r = m.range;
assert.deepEqual(
  [o.fileOffset, o.bytes, o.headerBytes, o.imageOffset],
  [0x26e00, 5986, 512, 0xc170],
);
assert.deepEqual([r.offset, r.length, r.relocations], [0x2b0, 42, [0x2bf]]);
const overlay = executable.subarray(o.fileOffset, o.fileOffset + o.bytes);
assert.equal(sha(overlay), o.sha256);
const original = Buffer.from(
  overlay.subarray(
    o.headerBytes + r.offset,
    o.headerBytes + r.offset + r.length,
  ),
);
assert.equal(sha(original), r.sha256);
assert.equal(
  original.toString("hex"),
  "ff1ee01fff1edc1fb83200509af509c40183c4020bc07412803ebe0300740bb8240050ff1e1c2083c402",
);
const exe = await readFile(m.analysisExecutable);
assert.equal(sha(exe), m.analysisSha256);
const at = o.imageOffset + r.offset,
  header = exe.readUInt16LE(8) * 16;
const prepared = Buffer.from(exe.subarray(header + at, header + at + r.length));
assert.deepEqual(prepared, original, "Undeclared analysis change");
const relocs = [];
for (let i = 0; i < exe.readUInt16LE(6); i++) {
  const p = exe.readUInt16LE(24) + i * 4,
    a = exe.readUInt16LE(p) + 16 * exe.readUInt16LE(p + 2);
  if (a >= at && a + 2 <= at + r.length) {
    relocs.push(a - o.imageOffset);
    prepared.writeUInt16LE(
      (prepared.readUInt16LE(a - at) + 0x1000) & 65535,
      a - at,
    );
  }
}
assert.deepEqual(relocs, r.relocations);
const raw = await json(m.artifact.path);
assert.equal(raw.isError, false);
const gh = JSON.parse(raw.content[0].text);
assert.equal(gh.program, m.program);
assert.equal(gh.address, r.address);
assert.equal(gh.length, r.length);
assert.deepEqual(Buffer.from(gh.hex, "hex"), prepared);
assert.equal(m.handoff.length, 3);
await checkArtifacts(m.handoffEvidence);
for (const [i, expected] of [
  [0, ["resident", 0x2686, 7, []]],
  [1, ["resident", 0x304, 14, []]],
  [2, ["overlay", 0x2da, 42, [0x2f2]]],
]) {
  const r = m.handoff[i];
  assert.deepEqual([r.source, r.offset, r.length, r.relocations], expected);
  await checkArtifacts({ ghidra: r.artifact });
  const original = Buffer.from(
    (r.source === "resident"
      ? image
      : overlay.subarray(o.headerBytes)
    ).subarray(r.offset, r.offset + r.length),
  );
  assert.equal(sha(original), r.sha256);
  const at = r.offset + (r.source === "overlay" ? o.imageOffset : 0);
  const prepared = Buffer.from(
    exe.subarray(header + at, header + at + r.length),
  );
  assert.deepEqual(prepared, original);
  const relocs = [];
  for (let n = 0; n < exe.readUInt16LE(6); n++) {
    const p = exe.readUInt16LE(24) + n * 4,
      a = exe.readUInt16LE(p) + 16 * exe.readUInt16LE(p + 2);
    if (a >= at && a + 2 <= at + r.length) {
      relocs.push(a - (r.source === "overlay" ? o.imageOffset : 0));
      prepared.writeUInt16LE(
        (prepared.readUInt16LE(a - at) + 0x1000) & 65535,
        a - at,
      );
    }
  }
  assert.deepEqual(relocs, r.relocations);
  const raw = await json(r.artifact.path);
  assert.equal(raw.isError, false);
  const gh = JSON.parse(raw.content[0].text);
  assert.equal(gh.program, m.program);
  assert.equal(gh.address, r.address);
  assert.equal(gh.length, r.length);
  assert.deepEqual(Buffer.from(gh.hex, "hex"), prepared);
}
assert.equal(
  Buffer.from(image.subarray(0x2686, 0x268d)).toString("hex"),
  "8b46fc8be55dcb",
);
assert.equal(
  Buffer.from(image.subarray(0x304, 0x312)).toString("hex"),
  "c646e223e97cfecd3f1d0000ebf2",
);
console.log(
  "Broker:105 original/prepared/Ghidra bytes,two relocations;shared09f5(50),conditional enabled24,unflushed return/office dispatch. Static proof,not native whole-handoff timing acceptance.",
);
