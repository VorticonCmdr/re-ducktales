import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive, imagePixels } from "../src/assets.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import {
  CampaignEnding,
  depositAccounts,
  campaignWinner,
} from "../src/game/ending.js";
import { capture, sameBytes } from "./verify-investments.js";
import build from "../reference/build.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/ending.json", "utf8"));
assert.equal(manifest.expectedCheckpointCount, 8);
assert.equal(Object.keys(manifest.artifacts).length, 16);
const raw = {};
for (const [name, artifact] of Object.entries(manifest.artifacts)) {
  const b = await readFile(artifact.path).catch(() => {
    throw Error(`SETUP: missing ${artifact.path}; see docs/ending.md`);
  });
  assert.equal(hash(b), artifact.sha256, `corrupt ${artifact.path}`);
  raw[name] = artifact.path.endsWith(".json") ? JSON.parse(b) : b;
}
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(raw.mode.isError, false);
assert.equal(mode.satisfied, true);
assert.equal(mode.protected_mode, false);
assert.equal(mode.core, "normal");
const files = {};
for (const name of ["DUCKTALE.EXE", "MAIN.ARC"]) {
  const bytes = await readFile(`game/${name}`);
  assert.equal(hash(bytes), build.files[name].sha256);
  assert.equal(bytes.length, build.files[name].bytes);
  files[name] = bytes;
}
const executable = files["DUCKTALE.EXE"],
  image = Buffer.from(unpackImage(executable));
const relocated = Buffer.from(image);
const packed =
  executable.readUInt16LE(8) * 16 + executable.readUInt16LE(22) * 16;
let cursor = packed + 0x125;
for (let region = 0; region < 16; region++) {
  const count = executable.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++, cursor += 2) {
    const at = region * 65536 + executable.readUInt16LE(cursor);
    relocated.writeUInt16LE((relocated.readUInt16LE(at) + 0x1f5) & 65535, at);
  }
}
const before = capture(raw.winnerBefore, 5, 0x2f00);
for (const [index, start, size] of [
  [2, 0xf95, 235],
  [3, 0x3e37, 433],
  [4, 0x1c48, 366],
]) {
  assert.equal(before.results[index].addr, 0x1f50 + start);
  sameBytes(
    Buffer.from(before.results[index].data, "base64"),
    relocated.subarray(start, start + size),
    "ending relocated code",
  );
}
let checked = 0;
function compareDeposit(alter = false) {
  const b = capture(raw.bankBefore, 3, 0x2f86),
    a = capture(raw.bankAfter, 2, 0x2fc6);
  assert.equal(b.m.b(0x4e0e), 33);
  const result = depositAccounts({
    day: b.m.b(0x4e0e),
    money: b.m.view.getUint32(0x8cc0, true),
    banked: b.m.view.getUint32(0x5ae2, true),
    rivalMoney: b.m.view.getUint32(0x4e0a, true),
    rivalBanked: b.m.view.getUint32(0x54f2, true),
  });
  if (alter) result.banked++;
  for (const [name, at] of [
    ["money", 0x8cc0],
    ["banked", 0x5ae2],
    ["rivalMoney", 0x4e0a],
    ["rivalBanked", 0x54f2],
  ])
    assert.equal(
      result[name],
      a.m.view.getUint32(at, true),
      `ending deposit ${name}`,
    );
  sameBytes(
    b.bytes.subarray(0x92b2, 0x9564),
    a.bytes.subarray(0x92b2, 0x9564),
    "bank preserves company records",
  );
}
compareDeposit();
assert.throws(() => compareDeposit(true), /ending deposit/);
checked++;
const winner = capture(raw.winnerAfter, 2, 0x5d87);
assert.equal(
  campaignWinner(
    before.m.view.getUint32(0x5ae2, true),
    before.m.view.getUint32(0x54f2, true),
  ),
  !!winner.m.i(winner.cpu.esp + 4),
);
assert.equal(winner.m.i(winner.cpu.esp + 4), 1);
checked++;
for (const [name, count, pc, stackOffset] of [
  ["firstWait", 2, 0x4585, 4],
  ["secondEntry", 2, 0x5dc6, 4],
  ["secondWait", 2, 0x4585, 4],
]) {
  const c = capture(raw[name], count, pc);
  assert.equal(
    c.m.i(c.cpu.esp + stackOffset),
    name === "secondEntry" ? 1 : 100,
  );
  checked++;
}
capture(raw.replayEntry, 2, 0x5df5);
const yes = capture(raw.replayYes, 2, 0x5edc),
  no = capture(raw.replayNo, 2, 0x5f04);
assert.equal(yes.m.i(yes.cpu.ebp - 4), 0);
assert.equal(no.m.i(no.cpu.ebp - 4), 1);
checked += 2;
assert.equal(capture(raw.again, 2, 0x2f41).cpu.eax & 65535, 0);
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);

const entries = parseArchive(files["MAIN.ARC"]);
for (const [name, asset] of [
  ["coverPNG", 36],
  ["celebrationPNG", 39],
]) {
  const png = PNG.sync.read(raw[name]);
  assert.deepEqual([png.width, png.height], [320, 200]);
  const expected = imagePixels(entries[asset]);
  sameBytes(png.data, expected, `original ending image${asset}`);
  const corrupted = Uint8Array.from(expected);
  corrupted[0] ^= 1;
  assert.throws(
    () => sameBytes(png.data, corrupted, "negative image"),
    /negative image/,
  );
}
function prompt(choice) {
  const pixels = new Uint8Array(256000);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const font = entries[42].data;
  const text = (at, x, y, color) => {
    for (const c of executableText(image, at)) {
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
          if (font[8 + c.charCodeAt(0) * 8 + row] & (128 >> col))
            pixels.set([...color, 255], ((y + row) * 320 + x + col) * 4);
      x += 8;
    }
  };
  text(0xa42, 112, 70, [255, 255, 255]);
  text(
    choice ? 0xa56 : 0xa4e,
    choice ? 144 : 136,
    100,
    choice ? [255, 255, 255] : [255, 85, 85],
  );
  text(
    choice ? 0xa5a : 0xa53,
    choice ? 136 : 144,
    120,
    choice ? [255, 85, 85] : [255, 255, 255],
  );
  return pixels;
}
for (const [name, choice] of [
  ["yesPNG", 0],
  ["noPNG", 1],
])
  sameBytes(
    PNG.sync.read(raw[name]).data,
    prompt(choice),
    "original replay prompt",
  );

// Exact static integer boundaries,not additional original runtime cases.
for (const [a, b, won] of [
  [0, 0, true],
  [0, 1, false],
  [1, 0, true],
  [65535, 65536, false],
  [65536, 65535, true],
  [0x7fffffff, 0x80000000, true],
  [0x80000000, 0x7fffffff, false],
  [0xffffffff, 0, false],
  [0, 0xffffffff, true],
  [0x80000000, 0x80000000, true],
])
  assert.equal(campaignWinner(a, b), won);
assert.deepEqual(
  depositAccounts({
    day: 30,
    money: 0xffffffff,
    banked: 2,
    rivalMoney: 10,
    rivalBanked: 0xffffffff,
  }),
  { money: 0, banked: 1, rivalMoney: 10, rivalBanked: 9 },
);
assert.equal(
  depositAccounts({
    day: 29,
    money: 0,
    banked: 0,
    rivalMoney: 10,
    rivalBanked: 0,
  }).rivalBanked,
  0,
);
const e = new CampaignEnding({ banked: 750, rivalBanked: 0, day: 33 });
for (let i = 0; i < 699; i++) e.advanceTick();
assert.equal(e.phase, "cover");
e.advanceTick();
assert.equal(e.phase, "celebration");
e.input({ type: "fire" });
for (let i = 0; i < 7; i++) e.advanceTick();
assert.equal(e.phase, "replay");
e.input({ type: "down" });
assert.equal(e.choice, 1);
e.input({ type: "fire" });
assert.equal(e.phase, "credits");
e.input({ type: "fire" });
for (let i = 0; i < 7; i++) e.advanceTick();
assert.equal(e.phase, "farewell");
for (let i = 0; i < 280; i++) e.advanceTick();
assert.equal(e.phase, "closed");
console.log(
  "Ending: 8 original bank/winner/wait/replay checkpoints,4 exact PNGs,relocated resident code identities,integer/dialogue boundaries and negative controls. Full campaign timing and losing original pixels remain unverified.",
);
