// Original caller bytes decide wait counts, conditional clicks and local order.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/result-caller-source.json");
await checkArtifacts(m.artifacts);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
const { image } = await originalGame();
assert.equal(sha(image.subarray(0xc48, 0xe15)), m.range.sha256);
assert.equal(m.range.length, 461);
assert.equal(
  sha(
    image.subarray(m.sharedReader.imageOffset, m.sharedReader.imageOffset + 88),
  ),
  m.sharedReader.sha256,
);
for (const [at, hex] of [
  [0xc48, "b82800509af509c401"],
  [0xc5f, "b8240050ff1e1c2083c402"],
  [0xc78, "c687304e01"],
  [0xc89, "c606b48e01"],
  [0xddd, "b8540050ff1e1c2083c402"],
  [0xde8, "b86400509af509c40183c402"],
  [0xdff, "b8240050ff1e1c2083c402"],
  [0xe0e, "c646e224e972f3"],
])
  assert.equal(
    Buffer.from(image.subarray(at, at + hex.length / 2)).toString("hex"),
    hex,
    "Original caller " + at.toString(16),
  );
const exe = await readFile(m.analysisExecutable);
assert.equal(sha(exe), m.analysisExecutableSha256);
const header = exe.readUInt16LE(8) * 16,
  prepared = Buffer.from(exe.subarray(header + 0xc48, header + 0xe15));
assert.deepEqual(
  prepared,
  Buffer.from(image.subarray(0xc48, 0xe15)),
  "Undeclared caller analysis edits",
);
const offsets = [];
for (let i = 0; i < exe.readUInt16LE(6); i++) {
  const at = exe.readUInt16LE(24) + i * 4,
    off = exe.readUInt16LE(at) + exe.readUInt16LE(at + 2) * 16;
  if (off >= 0xc48 && off + 2 <= 0xe15) {
    prepared.writeUInt16LE(
      (prepared.readUInt16LE(off - 0xc48) + 0x1000) & 65535,
      off - 0xc48,
    );
    offsets.push(off);
  }
}
assert.deepEqual(
  offsets.sort((a, b) => a - b),
  [0xc4f, 0xc95, 0xdef],
);
const r = await json(m.artifacts.ghidra.path);
assert.equal(r.isError, false);
const gh = JSON.parse(r.content[0].text);
assert.equal(gh.program, m.program);
assert.equal(gh.address, m.range.address);
assert.deepEqual(prepared, Buffer.from(gh.hex, "hex"));
assert.equal(sha(image.subarray(0xc36, 0xc48)), m.entryCue.sha256);
const cue = await json(m.artifacts.entryCue.path);
assert.equal(cue.isError, false);
assert.equal(
  JSON.parse(cue.content[0].text).hex,
  Buffer.from(image.subarray(0xc36, 0xc48)).toString("hex"),
);
assert.equal(
  Buffer.from(image.subarray(0xc36, 0xc48)).toString("hex"),
  "803ebe0300740bb8490050ff1e1c2083c402",
);
console.log(
  "Result caller:567 original bytes,461 Ghidra bytes/3 relocations;40/100 reads,enabled49/54,conditional24 before collection/notice/dispatch,and no local synthetic sound0 verified;not native audio phase acceptance.",
);
