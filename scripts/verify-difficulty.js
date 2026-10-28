import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import {
  difficultyInput,
  difficultyCommands,
  difficultyInitialCommands,
} from "../src/game/difficulty.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import { DifficultyMenu } from "../src/game/difficulty-menu.js";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/difficulty.json"));
const inputs = JSON.parse(await readFile("reference/difficulty-inputs.json"));
const build = JSON.parse(await readFile(manifest.buildManifest));
async function required(path) {
  return readFile(path).catch(() => {
    throw Error(`SETUP: missing ${path}; see docs/difficulty.md`);
  });
}
for (const spec of manifest.artifacts)
  assert.equal(
    hash(await required(spec.path)),
    spec.sha256,
    `Corrupt ${spec.path}`,
  );
assert.equal(manifest.artifacts.length, 8);
const files = {};
for (const name of ["DUCKTALE.EXE", "MAIN.ARC", "IT.DRV"]) {
  files[name] = await required(`game/${name}`);
  assert.equal(
    hash(files[name]),
    build.files[name].sha256,
    `Unsupported ${name}`,
  );
}
const image = unpackImage(files["DUCKTALE.EXE"]),
  entries = parseArchive(files["MAIN.ARC"]),
  driver = parseArchive(files["IT.DRV"])[5].data,
  graphics = parseArchive(files["IT.DRV"])[1].data,
  evidence = JSON.parse(
    await required(manifest.artifactRoot + "/evidence.json"),
  );
function record(key) {
  const r = evidence.captures[key];
  assert.ok(r, `Missing native ${key}`);
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
}
function batch(key) {
  const r = record(key);
  assert.equal(r.aborted, false);
  assert.ok(r.results.length > 0 && r.results.every((x) => x.status === "ok"));
  return r.results;
}
// These are static contracts for the pending entry integration. They do not
// turn the selected-menu captures into an original entry-animation replay.
assert.equal(manifest.sourceRanges.length, 6);
for (const spec of manifest.sourceRanges) {
  const source = {
    "unpacked-executable": image,
    "graphics-driver-1": graphics,
  }[spec.source];
  assert.ok(source, `Unsupported source ${spec.source}`);
  assert.ok(spec.length > 0 && spec.offset >= 0);
  assert.equal(
    source.subarray(spec.offset, spec.offset + spec.length).length,
    spec.length,
  );
  assert.equal(
    hash(source.subarray(spec.offset, spec.offset + spec.length)),
    spec.sha256,
    spec.role,
  );
}
const graphicsPointers = Buffer.from(
  batch("reseed-after-state")[3].data,
  "base64",
);
assert.equal(graphicsPointers.length, 16);
for (const [index, offset] of [0xe5, 0x1b0, 0x101, 0x155].entries()) {
  assert.equal(graphicsPointers.readUInt16LE(index * 4), offset);
  assert.equal(graphicsPointers.readUInt16LE(index * 4 + 2), 0x2ed7);
  assert.equal(
    new DataView(
      graphics.buffer,
      graphics.byteOffset,
      graphics.byteLength,
    ).getUint16(index * 2, true),
    offset,
  );
}
const mapping = batch("fresh-mapping"),
  loaded = Buffer.from(image),
  exe = files["DUCKTALE.EXE"];
const mcb = Buffer.from(mapping[4].data, "base64");
assert.equal(
  mcb.readUInt16LE(1),
  manifest.emulator.psp,
  "Fresh game MCB owner",
);
assert.equal(
  mcb.subarray(8, 16).toString("ascii").replaceAll("\0", ""),
  "DUCKTALE",
  "Fresh game identity",
);
let reloc = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const n = exe.readUInt16LE(reloc);
  reloc += 2;
  for (let i = 0; i < n; i++) {
    const at = exe.readUInt16LE(reloc) + region * 65536;
    reloc += 2;
    loaded.writeUInt16LE(
      (loaded.readUInt16LE(at) + manifest.loadBias) & 65535,
      at,
    );
  }
}
assert.equal(
  reloc,
  (exe.readUInt16LE(4) - 1) * 512 + (exe.readUInt16LE(2) || 512),
);
for (const [index, at, length] of [
  [1, 15577, 101],
  [2, 0x3a3b, 670],
  [3, 0x1cbc, 58],
])
  assert.deepEqual(
    Buffer.from(mapping[index].data, "base64"),
    loaded.subarray(at, at + length),
    "Fresh relocated code identity",
  );
assert.deepEqual(
  Buffer.from(batch("menu-0-state")[4].data, "base64"),
  Buffer.from(driver.subarray(0x408, 0x418)),
);
assert.equal(inputs.bytes.length, 9);
assert.equal(manifest.expectedInputCount, 9);
assert.equal(manifest.expectedPixelCount, 4);
const inputKeys = [
  "up-input",
  "neutral2-input",
  "down0-input",
  "neutral0-input",
  "down1-input",
  "neutral1-input",
  "up0-input",
  "neutral0b-input",
  "confirm-chord-input",
];
let selection = 0,
  cues = 0;
const cueKeys = [
  "up-sound",
  "down0-sound",
  "down1-sound",
  "up0-sound",
  "confirm-sound",
];
for (let i = 0; i < inputs.bytes.length; i++) {
  const native = record(inputKeys[i]);
  assert.equal(native.registers.cs, 0x4ea);
  assert.equal(native.registers.ds, 0x1403);
  assert.equal(native.registers.ss, 0x1403);
  assert.equal(native.registers.eip, 0xd0b);
  assert.equal(native.protected_mode, false);
  assert.equal(
    native.registers.eax & 255,
    inputs.bytes[i],
    `Native consumed input${i}`,
  );
  const result = difficultyInput(selection, inputs.bytes[i]);
  selection = result.selection;
  if (result.sound !== null) {
    const cue = batch(cueKeys[cues++]);
    const stack = Buffer.from(cue[1].data, "base64");
    assert.equal(cue[0].registers.cs, 0x2f7b);
    assert.equal(cue[0].registers.eip, 0x408);
    assert.equal(
      stack.readUInt16LE(0),
      result.action === "confirm" ? 0xd72 : 0xc3a,
    );
    assert.equal(stack.readUInt16LE(2), 0x4ea);
    assert.equal(stack.readUInt16LE(4), result.sound);
    assert.equal(
      Buffer.from(cue[2].data, "base64")[0],
      selection,
      `Native selection${i}`,
    );
  }
}
assert.equal(cues, 5);
assert.equal(selection, 0);
const bios = batch("bios-input-state"),
  after = batch("reseed-after-state");
assert.equal(bios[0].registers.cs, 0x603);
assert.equal(bios[0].registers.eip, 0xe0a);
assert.equal(bios[0].registers.es, 0x40);
assert.equal(bios[0].registers.eax & 65535, inputs.biosWordAtConsumption);
assert.equal(
  Buffer.from(after[2].data, "base64").readUInt16LE(0),
  inputs.biosWordAtConsumption,
);
assert.deepEqual(
  Buffer.from(bios[3].data, "base64"),
  Buffer.from(image.subarray(0x4ee1, 0x4eee)),
);
let pixels = 0;
for (const value of ["initial", 0, 1, 2]) {
  const png = PNG.sync.read(
    await required(
      `${manifest.artifactRoot}/${value === "initial" ? "menu-0" : `selected${value}`}.png`,
    ),
  );
  assert.deepEqual([png.width, png.height], [320, 200]);
  const commands =
    value === "initial"
      ? difficultyInitialCommands(image)
      : difficultyCommands(image, value);
  const actual = renderFlightPixels(
    commands,
    entries,
    entries[42].data,
    "MAIN.ARC",
  );
  assert.deepEqual(Buffer.from(actual), png.data, `Difficulty${value} pixels`);
  const shifted = commands.map((c, i) => (i > 1 ? { ...c, x: c.x - 8 } : c));
  assert.notDeepEqual(
    Buffer.from(
      renderFlightPixels(shifted, entries, entries[42].data, "MAIN.ARC"),
    ),
    png.data,
  );
  pixels++;
}
assert.equal(pixels, 4);
assert.equal(manifest.expectedSoundCalls, cues);
assert.equal(difficultyInput(0, 193).selection, 0, "Fire must precede Up");
assert.throws(() => difficultyInput(3, 1), /Invalid difficulty/);
// Component replay consumes the native input bytes in order. Clock boundaries
// are source-derived; the debugger captures do not supply an elapsed-time oracle.
let consumed = 0,
  flushes = 0,
  biosReads = 0;
const menu = new DifficultyMenu({
  image,
  entries,
  audioEnabled: true,
  readInput: () => {
    assert.ok(
      consumed < inputs.bytes.length,
      "Unfinished/extra difficulty input",
    );
    return inputs.bytes[consumed++];
  },
  flushInput: () => flushes++,
  readBiosSeed: () => {
    biosReads++;
    return inputs.biosWordAtConsumption;
  },
});
menu.input({ type: "fire" }); // A queued reveal tap must be discarded.
for (let i = 0; i < 25; i++) menu.advanceRetrace();
assert.equal(menu.ready, false);
assert.equal(flushes, 0);
assert.equal(consumed, 0);
menu.advanceRetrace();
assert.equal(flushes, 1);
assert.equal(menu.ready, true);
assert.equal(menu.firePulse, false);
assert.deepEqual(
  Buffer.from(menu.pixels()),
  PNG.sync.read(await required(`${manifest.artifactRoot}/menu-0.png`)).data,
);
menu.advanceRetrace();
for (let i = 0; i < 6; i++) menu.advanceTick();
assert.equal(consumed, 0, "Six driver counts must not consume input");
menu.advanceTick();
assert.equal(consumed, 1, "Seven driver counts consume the next input");
assert.equal(menu.selection, 2);
let steps = 0;
while (!menu.outcome) {
  assert.ok(++steps < 1000, "Unfinished difficulty component replay");
  if (menu.wait?.clock === "retrace") menu.advanceRetrace();
  else menu.advanceTick();
}
assert.equal(consumed, inputs.bytes.length);
assert.equal(menu.inputReads, 9);
assert.equal(biosReads, 1);
assert.equal(flushes, 1);
assert.equal(menu.retrace, 60); // entry1 + reveal25 +9 selected flips + exit25
assert.deepEqual(menu.outcome, {
  code: 0,
  selection: 0,
  biosSeed: inputs.biosWordAtConsumption,
});
assert.deepEqual(
  menu.drainEvents(),
  Array.from({ length: 5 }, () => ({ type: "sound", id: 36 })),
);
// Source-derived adapter contract: an outstanding global dialog blocks the
// input reader after its wait, while external clock observations continue.
let allowInput = false;
const blocked = new DifficultyMenu({
  image,
  entries,
  readBiosSeed: () => 123,
  pollInput: () => allowInput,
});
for (let i = 0; i < 26; i++) blocked.advanceRetrace();
blocked.setControls({ direction: "up", fire: false });
blocked.input({ type: "fire" });
blocked.advanceRetrace();
for (let i = 0; i < 10; i++) blocked.advanceTick();
assert.equal(blocked.inputReads, 0);
assert.equal(blocked.selection, 0);
assert.equal(blocked.wait.clock, "input");
allowInput = true;
blocked.advanceTick();
assert.equal(blocked.inputs[0].byte, 193);
assert.equal(
  blocked.selection,
  0,
  "Semantic Fire+Up must confirm before moving",
);
assert.equal(blocked.phase, "exit");
for (let i = 0; i < 24; i++) blocked.advanceRetrace();
assert.equal(blocked.outcome, null, "The final wipe cannot be skipped");
blocked.advanceRetrace();
assert.deepEqual(blocked.outcome, { code: 0, selection: 0, biosSeed: 123 });
assert.deepEqual(blocked.drainEvents(), [], "Muted menu must not emit cues");
console.log(
  "Difficulty core: 4 exact native PNGs (initial and3 selections),9 consumed inputs,5 original sound calls, BIOS consumption boundary, fresh relocated code identity and carried component replay. Source-derived entry/flush/wait/exit contracts; browser integration and original elapsed-time parity still pending.",
);
