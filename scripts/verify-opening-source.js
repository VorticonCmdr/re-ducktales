// Source identity and a read-only code-memory capture; no animation/replay claim.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unpackImage } from "../src/game/executable.js";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(
  await readFile("reference/opening-source.json", "utf8"),
);
assert.equal(
  hash(await readFile(manifest.checker)),
  manifest.checkerRevision.sha256,
  "Opening checker identity changed",
);
const original = await readFile("game/DUCKTALE.EXE").catch(() => {
  throw Error(
    "SETUP: missing game/DUCKTALE.EXE; see docs/opening-investigation.md",
  );
});
assert.equal(
  hash(original),
  manifest.executableSha256,
  "Unsupported original executable",
);
const image = Buffer.from(unpackImage(original));
assert.equal(manifest.sourceRanges.length, 4);
let sourceChecks = 0;
for (const r of manifest.sourceRanges) {
  assert.ok(
    Number.isInteger(r.at) &&
      Number.isInteger(r.length) &&
      r.at >= 0 &&
      r.length > 0 &&
      r.at + r.length <= image.length,
  );
  assert.equal(
    hash(image.subarray(r.at, r.at + r.length)),
    r.sha256,
    `Changed original ${r.address}`,
  );
  sourceChecks++;
}
// The supported EXEPACK loader's original relocation stream, independent of Ghidra files.
const packedAt = original.readUInt16LE(8) * 16 + original.readUInt16LE(22) * 16;
let cursor = packedAt + 0x125;
const loaded = Buffer.from(image);
for (let region = 0; region < 16; region++) {
  const count = original.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++) {
    const at = original.readUInt16LE(cursor) + region * 0x10000;
    cursor += 2;
    loaded.writeUInt16LE(
      (loaded.readUInt16LE(at) + manifest.mapping.loadBias) & 65535,
      at,
    );
  }
}
assert.equal(
  cursor,
  (original.readUInt16LE(4) - 1) * 512 + (original.readUInt16LE(2) || 512),
);
const artifact = manifest.mapping.artifact;
const bytes = await readFile(artifact.path).catch(() => {
  throw Error(
    `SETUP: missing ${artifact.path}; see docs/opening-investigation.md`,
  );
});
assert.equal(bytes.length, artifact.bytes, "Truncated mapping capture");
assert.equal(hash(bytes), artifact.sha256, "Corrupt mapping capture");
const capture = JSON.parse(bytes),
  mapping = manifest.mapping;
assert.equal(mapping.length, 101);
assert.equal(capture.bytes.length, 101);
for (const byte of capture.bytes)
  assert.ok(Number.isInteger(byte) && byte >= 0 && byte <= 255);
assert.equal(capture.addr, mapping.loadBias * 16 + mapping.imageOffset);
for (const [name, value] of Object.entries(mapping.registers))
  assert.equal(capture.registers[name], value, `Captured ${name}`);
const expected = loaded.subarray(
  mapping.imageOffset,
  mapping.imageOffset + mapping.length,
);
const compare = (value) =>
  assert.deepEqual(
    Buffer.from(value),
    expected,
    "Original relocated reveal code differs",
  );
compare(capture.bytes);
const altered = [...capture.bytes];
altered[0] ^= 1;
assert.throws(() => compare(altered), /Original relocated reveal code differs/);
assert.equal(sourceChecks, 4);
assert.equal(manifest.expectedMappingCheckpoints, 1);
console.log(
  "Opening source:4 original ranges,1 exact101-byte captured live mapping; one-byte negative control rejected. No opening execution/timing/pixel parity claimed.",
);
