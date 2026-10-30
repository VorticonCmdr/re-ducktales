import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { originalGame } from "../tests/helpers/original-game.js";
import { Departure } from "../src/game/departure.js";
import { DepartureScene } from "../src/game/departure-scene.js";
import { departureWork } from "../src/game/departure-work.js";
import { Scheduler } from "../src/game/scheduler.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import { executableText } from "../src/game/executable.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const checked = async (p, h) => {
  let b;
  try {
    b = await readFile(p);
  } catch {
    throw Error("SETUP: missing " + p + ";see docs/departure-sequence.md");
  }
  assert.equal(sha(b), h, "Changed evidence " + p);
  return b;
};
const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/departure-sequence.json";
const m = JSON.parse(await readFile(manifestPath));
if (manifestPath !== "reference/departure-sequence.json") {
  const r = m.runtimeRefresh;
  assert.equal(r?.parent.path, "reference/departure-sequence.json");
  assert.equal(r.expectedValuesChanged, false);
  const prior = JSON.parse(await checked(r.parent.path, r.parent.sha256));
  const { sources: previousSources, ...previousContract } = prior;
  const { sources: currentSources, runtimeRefresh, ...currentContract } = m;
  const exactContract = (c) =>
    assert.deepEqual(
      c,
      previousContract,
      "Changed historical departure expectation",
    );
  exactContract(currentContract);
  const missingRetrace = structuredClone(currentContract);
  missingRetrace.expectedConsumedRetraces--;
  assert.throws(
    () => exactContract(missingRetrace),
    /Changed historical departure expectation/,
  );
  const relaxed = structuredClone(currentContract);
  relaxed.comparisonRules = "relaxed";
  assert.throws(
    () => exactContract(relaxed),
    /Changed historical departure expectation/,
  );
  assert.deepEqual(Object.keys(currentSources), Object.keys(previousSources));
  await checked("scripts/verify-departure-sequence.js", r.verifierSha256);
  assert.deepEqual(Object.keys(r.additionalSources), [
    "src/game/flight.js",
    "src/game/ordinary-keyboard.js",
    "src/game/keyboard-adapter.js",
  ]);
  for (const [p, h] of Object.entries(r.additionalSources)) await checked(p, h);
}
assert.equal(m.expectedSourceInstructions, 181);
assert.equal(m.expectedSourceBytes, 463);
assert.equal(m.expectedConsumedRetraces, 50);
assert.deepEqual(m.injections, []);
assert.deepEqual(m.fittedInputs, []);
for (const [p, h] of Object.entries(m.sources)) await checked(p, h);
const parent = JSON.parse(await checked(m.parent.path, m.parent.sha256));
assert.equal(parent.expectedCheckpointCount, 2);
assert.equal(parent.expectedRngDrawCount, 2);
for (const a of Object.values(parent.artifacts))
  await checked(a.path, a.sha256);
const o = await originalGame(),
  exe = await readFile("game/DUCKTALE.EXE");
const image = Buffer.from(o.image),
  loaded = Buffer.from(image);
let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++, cursor += 2) {
    const at = region * 65536 + exe.readUInt16LE(cursor);
    loaded.writeUInt16LE((loaded.readUInt16LE(at) + 0x1000) & 65535, at);
  }
}
const driver = Buffer.from(o.archives.get("IT.DRV")[1].data);
assert.equal(driver.length, 2599);
const listings = {};
let instructions = 0,
  bytes = 0;
function validateListing(listing, driverCode) {
  assert.equal(listing.truncated, false);
  assert.ok(listing.instructions.length > 0);
  for (const row of listing.instructions) {
    const [seg, off] = row.address.split(":").map((s) => parseInt(s, 16));
    const at = driverCode ? off : (seg - 0x1000) * 16 + off;
    assert.equal(
      (driverCode ? driver : loaded)
        .subarray(at, at + row.length)
        .toString("hex"),
      row.bytes,
      "Original source instruction byte",
    );
  }
}
assert.equal(Object.keys(m.staticArtifacts).length, 6);
for (const [name, a] of Object.entries(m.staticArtifacts)) {
  const raw = JSON.parse(await checked(a.path, a.sha256));
  assert.equal(raw.isError, false);
  const s = JSON.parse(raw.content[0].text);
  assert.equal(
    s.program,
    name === "driver-fill" ? "ducktales-ega-driver.bin" : "DUCK_UNPACKED.EXE",
  );
  validateListing(s, name === "driver-fill");
  listings[name] = s;
  instructions += s.instructions.length;
  bytes += s.instructions.reduce((n, r) => n + r.length, 0);
}
assert.equal(instructions, 181);
assert.equal(bytes, 463);
const bad = structuredClone(listings["main-tail"]);
bad.instructions[0].bytes = "00";
assert.throws(
  () => validateListing(bad, false),
  /Original source instruction byte/,
);
// Real caller symbols: helper3 -> table entry3 loads MAIN30, copies then
// flushes; main0754 reveals,then RNG/race/overlay call,without an input call.
assert.equal(image.readUInt16LE(0x1c40 + 0x151 + 2 * 2), 0x4f);
assert.equal(
  image.subarray(0x1c40 + 0x53, 0x1c40 + 0x56).toString("hex"),
  "b81e00",
);
assert.equal(0x7c + image.readInt16LE(0x1c40 + 0x7a), 0x16d);
assert.equal(image.subarray(0x754, 0x758).toString("hex"), "ff1edc1f");
assert.equal(image.subarray(0x83d, 0x842).toString("hex"), "9a2d036b02");
assert.equal(
  image.subarray(0x845, 0x852).toString("hex"),
  "8a46ea9850ff76e4cd3f070000",
);
// Source EGA loops,not a fitted frame duration.
assert.equal(driver.subarray(0x127, 0x12e).toString("hex"), "83c22881fac800");
assert.equal(driver.subarray(0x146, 0x14e).toString("hex"), "b90500e818ffe2fb");
assert.equal(driver.subarray(0x187, 0x18e).toString("hex"), "83c22881fac800");
assert.equal(driver.subarray(0x1a2, 0x1aa).toString("hex"), "b90500e8bcfee2fb");
const groups = driver.readUInt16LE(0x12c) / driver[0x129],
  waits = driver.readUInt16LE(0x147);
assert.equal(groups, 5);
assert.equal(waits, 5);
const work = departureWork(o.archives.get("MAIN.ARC"));
assert.equal(
  work.fill.instructions,
  listings["driver-fill"].instructions.length,
);
assert.equal(
  work.fill.portWrites,
  listings["driver-fill"].instructions.filter((r) => r.mnemonic === "OUT")
    .length,
);
assert.equal(work.fill.repeatIterations, driver.readUInt16LE(0x1e4));
assert.equal(work.fill.repeatOpcodes, 1);
assert.equal(work.fill.repeatIterations, 8000);
assert.equal(sha(JSON.stringify(work)), m.workSha256);
// Native driver-table correspondence and full graphics-body identity are
// independently required by verify-destination-video.js in the focused gate.
const dp = JSON.parse(
  await checked(m.driverParent.path, m.driverParent.sha256),
);
for (const name of ["notice-000-before.json", "map-resident-mapping.json"])
  await checked(dp.artifacts[name].path, dp.artifacts[name].sha256);
const native = JSON.parse(
  await readFile(dp.artifacts["notice-000-before.json"].path),
);
assert.equal(native.stop.protected_mode, false);
assert.equal(native.stop.core, "normal");
const ds = Buffer.from(native.state.results[1].data, "base64");
assert.deepEqual(
  [0x1fd8, 0x1fdc, 0x1fe0, 0x1fec].map((at) => ds.readUInt16LE(at)),
  [0x1b0, 0x101, 0x155, 0x1ef],
);
const trace = JSON.parse(await readFile(parent.artifacts.trace.path));
const parse = (r) => {
  assert.equal(r.isError, false);
  const s = JSON.parse(r.content[0].text);
  assert.equal(s.aborted, false);
  assert.ok(s.results.every((x) => x.status === "ok"));
  return s.results;
};
const before = parse(trace.before),
  prepared = parse(trace.prepared),
  entry = parse(trace.entry);
assert.equal(before[0].registers.cs, 0x1f5);
assert.equal(before[0].registers.eip, 0x6d9);
assert.equal(prepared[0].registers.cs, 0x1f5);
assert.equal(prepared[0].registers.eip, 0x845);
assert.equal(entry[0].registers.cs, 0xe0c);
assert.equal(entry[0].registers.eip, 0);
const rawWord = (r) => Buffer.from(r.data, "base64").readUInt16LE();
assert.equal(rawWord(before[1]), parent.routineInput.seed);
const stack = Buffer.from(entry[1].data, "base64");
function replay(fault = null) {
  const metadata = new Departure(parent.routineInput),
    commits = [],
    routes = [],
    flushes = [];
  let clock = () => 0;
  let scene;
  scene = new DepartureScene({
    prepared: metadata,
    entries: o.archives.get("MAIN.ARC"),
    clock: () => clock(),
    onSeed: (seed) => commits.push(seed),
    registerRace: (r) => {
      if (fault !== "missing-route") routes.push(r);
    },
    flushInput: () => {
      if (fault !== "missing-flush")
        flushes.push({
          seed: scene.seed,
          draws: scene.rngDraws,
          ret: scene.consumedRetraces,
        });
    },
  });
  if (fault === "short-reveal") {
    const begin = scene.beginTransition.bind(scene);
    scene.beginTransition = (kind) => {
      begin(kind);
      if (kind === "reveal") scene.remaining = 1;
    };
  }
  const pictures = [];
  const host = {
    tick: 0,
    input() {
      throw Error("Unexpected departure input");
    },
    setSimulationClock: (f) => {
      clock = f;
    },
    nextSimulationWake: () => scene.wait?.until ?? null,
    advanceSimulationWake: () => scene.advanceGraphics(),
    advanceTick() {
      this.tick++;
      scene.advanceTick();
    },
    advanceRetrace: () => scene.advanceRetrace(),
  };
  const scheduler = new Scheduler(host, 0, {
    present: () => pictures.push(scene.snapshot()),
  });
  for (let i = 0; i < 2000 && !scene.outcome; i++)
    scheduler.advanceTo(scheduler.now + 1);
  assert.ok(scene.outcome, "Unfinished departure source sequence");
  if (fault === "seed") commits[1] ^= 1;
  assert.equal(
    scene.consumedRetraces,
    2 * groups * waits,
    "Required departure retrace waits",
  );
  assert.equal(scene.completedWork, 2);
  assert.equal(scene.rngDraws, 2);
  assert.deepEqual(
    flushes,
    [{ seed: rawWord(before[1]), draws: 0, ret: 25 }],
    "Source portrait flush boundary",
  );
  assert.equal(commits.length, 2);
  assert.equal(commits[1], rawWord(prepared[1]), "Native prepared RNG");
  assert.equal(metadata.variant, 1);
  assert.equal(
    Number(metadata.racing),
    Buffer.from(prepared[6].data, "base64")[8],
  );
  assert.deepEqual(
    routes,
    [
      {
        from: Buffer.from(prepared[7].data, "base64")[0],
        target: Buffer.from(prepared[8].data, "base64")[0],
      },
    ],
    "Native racing route writes",
  );
  assert.deepEqual(
    scene.outcome,
    { days: stack.readUInt16LE(4), racing: stack.readUInt16LE(6) },
    "Native flight call arguments",
  );
  assert.equal(scene.seed, rawWord(entry[2]));
  for (const kind of ["wipe", "reveal"])
    assert.deepEqual(
      [
        ...new Set(
          pictures
            .filter((s) => s.transition?.kind === kind)
            .map((s) => s.transition.band),
        ),
      ],
      [0, 1, 2, 3, 4],
    );
  assert.equal(pictures.at(-1).phase, "handoff");
  assert.equal(scheduler.events.length, 0);
  return {
    metadata,
    sourceRetraces: scene.consumedRetraces,
    publications: pictures.length,
  };
}
const result = replay();
for (const [fault, reason] of [
  ["seed", /Native prepared RNG/],
  ["missing-route", /Native racing route/],
  ["missing-flush", /Source portrait flush/],
  ["short-reveal", /Required departure retrace/],
])
  assert.throws(() => replay(fault), reason);
const commands = [
  {
    op: "copy",
    asset: 30,
    x: 0,
    y: 0,
    sourceX: 0,
    sourceY: 0,
    width: 320,
    height: 200,
  },
  ...result.metadata.speechOffsets.map((at, i) => ({
    op: "text",
    text: executableText(o.image, at),
    x: 168,
    y: 60 + i * 16,
    color: 15,
  })),
];
const entries = o.archives.get("MAIN.ARC"),
  actual = Buffer.from(
    renderFlightPixels(commands, entries, entries[42].data, "MAIN.ARC"),
  );
const expected = PNG.sync.read(await readFile(parent.artifacts.briefing.path));
assert.deepEqual([expected.width, expected.height], [320, 200]);
assert.deepEqual(actual, expected.data, "Original complete Launchpad picture");
const altered = Buffer.from(actual);
altered[0] ^= 1;
assert.throws(
  () =>
    assert.deepEqual(
      altered,
      expected.data,
      "Original complete Launchpad picture",
    ),
  /Original complete Launchpad picture/,
);
console.log(
  `Departure sequence:${instructions} original instruction boundaries/${bytes} exact bytes,50 required retrace waits,2 work calls,2 native RNG/call checkpoints,route writes and exact320x200 native portrait;6 negative controls. Static source-work budget only;not original loading or uninterrupted timing parity.`,
);
