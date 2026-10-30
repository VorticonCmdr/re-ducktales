import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { OrdinaryKeyboard } from "../src/game/ordinary-keyboard.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
async function checked(p, h) {
  const b = await readFile(p).catch(() => {
    throw Error(`SETUP: missing ${p};see docs/flight-keyboard.md`);
  });
  assert.equal(sha(b), h, "Changed evidence " + p);
  return b;
}
const m = JSON.parse(await readFile("reference/flight-keyboard.json"));
assert.deepEqual(
  [
    m.expectedInstructions,
    m.expectedSourceBytes,
    m.expectedReads,
    m.expectedEvents,
  ],
  [45, 139, 16, 14],
);
assert.deepEqual(m.injections, []);
assert.deepEqual(m.fittedInputs, []);
assert.equal(m.partialRestore, false);
assert.deepEqual([m.expectedUnitCases, m.expectedBrowserCases], [177, 9]);
for (const [p, h] of Object.entries(m.sources)) await checked(p, h);
const parent = JSON.parse(await checked(m.parent.path, m.parent.sha256));
const raw = {};
for (const [k, a] of Object.entries(parent.artifacts)) {
  const b = await checked(a.path, a.sha256);
  raw[k] = a.path.endsWith(".json") ? JSON.parse(b) : b;
}
function packet(x) {
  assert.equal(x.isError, false);
  return JSON.parse(x.content[0].text);
}
const nativeCode = packet(raw.code);
assert.equal(nativeCode.aborted, false);
assert.equal(nativeCode.results.length, 8);
assert.ok(nativeCode.results.every((r) => r.status === "ok"));
const nativeFlight = Buffer.from(nativeCode.results[2].data, "base64");
const nativeReturn = Buffer.from(nativeCode.results[6].data, "base64");
assert.equal(nativeCode.results[2].addr, 0xe0c0);
assert.equal(nativeCode.results[6].addr, 0x1f50 + 0x2635);
assert.equal(nativeFlight.length, 17548);
assert.equal(nativeReturn.length, 88);
assert.equal(packet(raw.mode).stop.protected_mode, false);
const o = await originalGame(),
  exe = await readFile("game/DUCKTALE.EXE");
const overlay = exe.subarray(0x12c00),
  body = Buffer.from(overlay.subarray(1024, 1024 + 17548));
assert.equal(overlay.readUInt16LE(0), 0x5a4d);
assert.equal(overlay.readUInt16LE(6), 248);
const relocationOffsets = [];
for (let i = 0; i < 248; i++) {
  const p = overlay.readUInt16LE(24) + i * 4;
  relocationOffsets.push(
    (overlay.readUInt16LE(p + 2) - 0xc17) * 16 + overlay.readUInt16LE(p),
  );
}
const resident = Buffer.from(o.image),
  loaded = Buffer.from(resident),
  nativeResident = Buffer.from(resident);
let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const n = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < n; i++, cursor += 2) {
    const at = region * 65536 + exe.readUInt16LE(cursor);
    loaded.writeUInt16LE((loaded.readUInt16LE(at) + 0x1000) & 65535, at);
    nativeResident.writeUInt16LE(
      (nativeResident.readUInt16LE(at) + 0x1f5) & 65535,
      at,
    );
  }
}
assert.deepEqual(
  nativeReturn,
  nativeResident.subarray(0x2635, 0x2635 + 88),
  "Complete native return reader identity",
);
let instructions = 0,
  bytes = 0;
function listingCheck(d, spec) {
  assert.equal(d.truncated, false);
  assert.ok(d.instructions.length);
  const expected = spec.resident ? loaded : body;
  let at = spec.offset;
  for (const row of d.instructions) {
    const b = Buffer.from(row.bytes, "hex");
    assert.equal(b.length, row.length);
    assert.equal(parseInt(row.address.split(":").at(-1), 16), at);
    const p = at + (spec.resident ? 0x1c40 : 0);
    assert.deepEqual(
      b,
      expected.subarray(p, p + b.length),
      "Original flight source byte",
    );
    if (spec.resident) {
      // Retained native resident bytes are independently linked to the same
      // original function by verify-flight-input's complete relocation check.
      assert.equal(nativeReturn.length, d.bytes_disassembled);
    } else {
      const runtime = Buffer.from(b);
      for (const relocation of relocationOffsets)
        if (relocation >= at && relocation + 2 <= at + b.length) {
          const r = relocation - at;
          runtime.writeUInt16LE((runtime.readUInt16LE(r) + 0x1f5) & 65535, r);
        }
      assert.deepEqual(
        runtime,
        nativeFlight.subarray(at, at + b.length),
        "Native flight instruction correspondence",
      );
    }
    at += b.length;
  }
  assert.equal(
    at - spec.offset,
    d.bytes_disassembled,
    "Unfinished source range",
  );
}
const listings = {};
assert.deepEqual(Object.keys(m.staticArtifacts), [
  "mode",
  "reader",
  "direction",
  "return",
]);
for (const [name, spec] of Object.entries(m.staticArtifacts)) {
  const d = packet(JSON.parse(await checked(spec.path, spec.sha256)));
  assert.equal(
    spec.offset,
    { mode: 12, reader: 686, direction: 819, return: 2549 }[name],
  );
  assert.equal(spec.resident, name === "return");
  assert.equal(
    d.program,
    {
      mode: "FLIGHT_ANALYSIS.EXE",
      reader: "FLIGHT_ANALYSIS.EXE",
      direction: "FLIGHT_TRANSLATION.EXE",
      return: "DUCK_UNPACKED.EXE",
    }[name],
  );
  listingCheck(d, spec);
  listings[name] = d;
  instructions += d.instructions.length;
  bytes += d.bytes_disassembled;
}
assert.equal(instructions, 45);
assert.equal(bytes, 139);
assert.equal(listings.mode.instructions[0].bytes, "c606c10300");
assert.equal(listings.reader.instructions[0].bytes, "9a02002401");
assert.equal(listings.reader.instructions[2].bytes, "f646e6c0");
assert.equal(listings.direction.instructions[1].bytes, "243f");
assert.equal(listings.direction.instructions[2].bytes, "3c01");
assert.equal(listings.direction.instructions[8].bytes, "3c05");
assert.equal(
  listings.return.instructions.find((r) => r.address.endsWith(":0a33")).bytes,
  "9a02002411",
);
assert.equal(
  listings.return.instructions.find((r) => r.address.endsWith(":0a3b")).bytes,
  "f646fec0",
);
const badSource = structuredClone(listings.reader);
badSource.instructions[0].bytes = "0000000000";
assert.throws(
  () => listingCheck(badSource, m.staticArtifacts.reader),
  /Original flight source byte/,
);
let nativeFlags = 0;
for (const name of ["pauseReturn", "returnFirst", "returnLast"]) {
  const p = packet(raw[name]);
  assert.equal(p.aborted, false);
  assert.ok(p.results.every((r) => r.status === "ok"));
  const ds = Buffer.from(p.results[1].data, "base64");
  assert.equal(ds.length, 65536);
  assert.equal(ds[0x3c1], 0);
  assert.deepEqual(ds.subarray(0x276c, 0x27ec), Buffer.alloc(128));
  if (name === "pauseReturn") {
    const cpu = p.results[0].registers;
    assert.deepEqual(
      [cpu.cs, cpu.eip, cpu.ds, cpu.ss, cpu.eax & 65535],
      [0xe0c, 0x2b3, 0x1403, 0x1403, new OrdinaryKeyboard(0).poll()],
    );
  }
  nativeFlags++;
}
assert.equal(nativeFlags, 3);
const profile = JSON.parse(
  await checked(m.inputProfile.path, m.inputProfile.sha256),
);
assert.equal(profile.expectedReads, 16);
assert.equal(profile.expectedEvents, 14);
assert.equal(profile.events.length, 14);
assert.equal(m.expectedBytes.length, 16);
assert.equal(m.expectedAfterFlags.length, 16);
for (const flags of m.expectedAfterFlags)
  for (const [scan, flag] of Object.entries(flags)) {
    assert.ok(Number.isInteger(+scan) && +scan >= 0 && +scan < 128);
    assert.equal(flag, 128);
  }
function replay(
  events = profile.events,
  expectedBytes = m.expectedBytes,
  fault,
) {
  const g = new Game({
    locations: o.game.locations,
    loot: o.game.loot,
    expeditionResources: o.game.expeditionResources,
    flightResources: o.game.flightResources,
    expeditionInput: "keyboard",
  });
  const scheduler = new Scheduler(g, 0);
  g.scene = "map";
  g.campaign.point(37, 33);
  g.travel(g.campaign.selected);
  function until(fn) {
    for (let i = 0; i < 3000; i++) {
      if (fn()) return;
      scheduler.advanceTo(scheduler.now + 1);
    }
    throw Error("Unfinished independent flight input sequence");
  }
  until(() => g.scene === "flight");
  if (fault === "mode") g.expeditionKeyboard.mode = 1;
  if (fault === "provider") {
    const readInput = g.flight.readInputByte;
    g.flight.readInputByte = () => {
      readInput();
      return 0;
    };
  }
  let consumed = 0;
  for (let read = 1; read <= 16; read++) {
    while (events[consumed]?.beforeRead === read) {
      const e = events[consumed++];
      g.input({
        type: "expedition-key",
        scanCode: e.scanCode,
        pressed: e.pressed,
      });
    }
    until(() => g.expeditionKeyReads >= read);
    assert.equal(g.expeditionKeyReads, read, "Skipped flight read");
    assert.equal(
      g.lastExpeditionKeyByte,
      expectedBytes[read - 1],
      "Independent flight byte",
    );
    assert.equal(
      g.flight.inputLog[read - 1].code,
      expectedBytes[read - 1],
      "Independent flight byte",
    );
    const flags = Buffer.alloc(128);
    for (const [scan, value] of Object.entries(m.expectedAfterFlags[read - 1]))
      flags[+scan] = value;
    assert.deepEqual(
      Buffer.from(g.expeditionKeyboard.bytes()),
      flags,
      "Independent full flight flags",
    );
    assert.deepEqual(
      Buffer.from(g.flight.memory.bytes.subarray(0x276c, 0x27ec)),
      flags,
      "Flight DS flag mirror",
    );
    assert.equal(g.flight.memory.b(0x3c1), g.expeditionKeyboard.mode);
  }
  assert.equal(consumed, events.length, "Unconsumed flight events");
  assert.equal(g.flight.inputLog.length, 16);
  assert.equal(g.diagnostic, null);
}
replay();
assert.throws(
  () => replay(profile.events.filter((_, i) => i !== 2)),
  /Independent full flight flags/,
);
const wrongResult = [...m.expectedBytes];
wrongResult[1] = 192;
assert.throws(
  () => replay(profile.events, wrongResult),
  /Independent flight byte/,
);
assert.throws(
  () => replay(profile.events, m.expectedBytes, "mode"),
  /Independent full flight flags/,
);
assert.throws(
  () => replay(profile.events, m.expectedBytes, "provider"),
  /Independent flight byte/,
);
const extra = [
  ...profile.events,
  { beforeRead: 17, scanCode: 57, pressed: true },
];
assert.throws(() => replay(extra), /Unconsumed flight events/);
console.log(
  "Flight keyboard:45 original instructions/139 exact bytes,3 native empty128-flag tables/one nativeAX return,16 independent source reads/14 events/16 full flag boundaries and6 negative controls. Shared36-read native keyboard regression remains separate;not an uninterrupted native flight replay.",
);
