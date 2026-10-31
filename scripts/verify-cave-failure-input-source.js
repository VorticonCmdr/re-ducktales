import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/cave-failure-input-source.json");
assert.equal(m.kind, "cave-failure-input-static-source");
assert.equal(m.program, "CAVE_CODE.EXE");
assert.equal(m.language, "x86:LE:16:Real Mode");
const build = await json(m.build), exe = await readFile("game/DUCKTALE.EXE");
assert.equal(exe.length, build.files["DUCKTALE.EXE"].bytes);
assert.equal(sha(exe), build.files["DUCKTALE.EXE"].sha256);
const body = exe.subarray(m.overlayBody.fileOffset, m.overlayBody.fileOffset + m.overlayBody.bytes);
assert.equal(body.length, 11054);
assert.equal(sha(body), m.overlayBody.sha256, "Different original cave body");
assert.equal(m.originalFileOffset, m.overlayBody.fileOffset + 0x1a90);
assert.equal(m.bytes, 34);
const original = exe.subarray(m.originalFileOffset, m.originalFileOffset + m.bytes);
assert.equal(sha(original), m.sha256);
await checkArtifacts(m.artifacts);
const g = await json(m.artifacts.ghidra.path);
assert.equal(g.program, m.program);
assert.equal(g.address, m.ghidraAddress);
assert.equal(g.length, m.bytes);
assert.equal(g.hex, Buffer.from(g.data).toString("hex"));
const normalized = Buffer.from(g.data);
assert.deepEqual(m.relocations, [{ offset: 7, addend: 4096 }]);
normalized.writeUInt16LE((normalized.readUInt16LE(7) - 4096) & 65535, 7);
assert.deepEqual(normalized, original, "Unexpected Ghidra/original code difference");
assert.equal(original[0], 0xb8); // MOV AX,imm16; PUSH AX; far CALL shared09f5.
assert.equal(original.readUInt16LE(1), 20);
assert.equal(original[3], 0x50);
assert.equal(original[4], 0x9a);
assert.equal(original.readUInt16LE(5), 0x09f5);
assert.equal(original.readUInt16LE(7), 0x01c4);
assert.equal(original.readUInt16LE(18), 0x03be); // Enabled byte guard.
assert.equal(original.readUInt16LE(24), 0x24); // Conditional click request.
console.log("Cave failure source verified:34 original/Ghidra bytes,one loader relocation,shared20-read wait and guarded click24. Static evidence only;legacy browser path remains to translate.");
