import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import { DestinationWaits } from "../src/game/destination-waits.js";
const { archives, image } = await originalGame(); // All22 supported hashes required.
const driver = Buffer.from(archives.get("IT.DRV")[1].data);
const exe = await readFile("game/DUCKTALE.EXE"),
  body = exe.subarray(0xfa00, 0x11ab0);
for (const [at, hex] of [
  [0x127, "83c22881fac800"], // reveal: five40-byte row-group offsets
  [0x146, "b90500e818ffe2fb"], // each group waits five independent retraces
  [0x187, "83c22881fac800"], // clear uses the same five row groups
  [0x1a2, "b90500e8bcfee2fb"],
  [0xe5, "b4052ea02700cd10"], // page-select BIOS call
  [0xfd, "e864ffcb"], // separate retrace wait before returning
])
  assert.equal(
    driver.subarray(at, at + hex.length / 2).toString("hex"),
    hex,
    `EGA wait source ${at.toString(16)}`,
  );
for (const [at, hex] of [
  [0x1aa2, "837e8600750aff1ee01fff1edc1feb04ff1ed41f"], // entry clear/reveal,second-page flip
  [0x1cc6, "2bc0509acc0d0e0483c402b80700509acc0d0e04"], // selection0/7
  [0x1df5, "9aa5190e042bc0509acc0d0e0483c402b80700509acc0d0e04"], // flush,confirmation0/7
  [0x1e17, "2bc0509acc0d0e0483c402b80100509acc0d0e04"], // ordinary loop0/1
])
  assert.equal(
    body.subarray(at, at + hex.length / 2).toString("hex"),
    hex,
    `Destination wait source ${at.toString(16)}`,
  );
const resident = Buffer.from(image).subarray(0x4eac, 0x4ee1);
assert.equal(
  resident.subarray(10, 37).toString("hex"),
  "8b1e21228b0e232203d883d1003b0e272277fa72063b1e252277f2",
  "Unsigned DWORD wait source",
);
const groupCount = driver.readUInt16LE(0x12c) / driver[0x129],
  retracesPerGroup = driver.readUInt16LE(0x147);
assert.equal(groupCount, 5);
assert.equal(retracesPerGroup, 5);
const waits = new DestinationWaits(100);
for (let i = 0; i < 2 * groupCount * retracesPerGroup; i++)
  waits.advanceRetrace(100);
assert.equal(waits.ready, false);
assert.equal(waits.phase, "entry-flip");
waits.advanceRetrace(100);
assert.equal(waits.ready, true);
waits.input(3, 100);
waits.advanceTick(106);
assert.equal(waits.phase, "selection-wait");
waits.advanceTick(107);
assert.equal(waits.phase, "selection-flip");
waits.advanceRetrace(107);
assert.equal(waits.ready, false);
waits.advanceTick(108);
assert.equal(waits.ready, true);
waits.input(192, 108);
waits.advanceRetrace(108);
waits.advanceTick(114);
assert.equal(waits.outcome, null);
waits.advanceTick(115);
assert.equal(waits.outcome.returnCode, 1);
console.log(
  "Destination waits:original EGA five-by-five clear/reveal and flip,selection0/7,loop0/1,confirmation flush/0/7 and unsigned DWORD helper bytes;independent authored component clocks pass. CPU/footer duration and recurring raw polling are not compared here.",
);
