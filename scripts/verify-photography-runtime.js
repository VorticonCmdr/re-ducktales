import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { FlightMemory } from "../src/game/flight-physics.js";
import { Photography } from "../src/game/photography.js";
import { historicalPhotography } from "./photography-component-replay.js";
const { Photography: HistoricalPhotography } = await historicalPhotography();
import { advancePhotographyAnimals } from "../src/game/photography-animation.js";
import {
  photographyResultsScene,
  preparePhotography,
} from "../src/game/photography-scene.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Game } from "../src/game/application.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(
    await readFile("reference/photography-runtime.json", "utf8"),
  ),
  old = JSON.parse(await readFile("reference/photography.json", "utf8")),
  build = JSON.parse(await readFile("reference/build.json", "utf8"));
assert.equal(manifest.expectedOriginalPassCount, 11);
assert.equal(manifest.expectedOriginalArtifactCount, 29);
assert.equal(manifest.passes.length, 11);
assert.equal(manifest.expectedReplayCaseCount, 4);
assert.deepEqual(manifest.fittedInputs, []);
const raw = {};
for (const [name, a] of Object.entries(manifest.artifacts))
  raw[name] = await artifact(a);
assert.equal(Object.keys(raw).length, 29);
async function artifact(a) {
  const b = await readFile(a.path).catch(() => {
    throw Error(`SETUP: missing ${a.path};see docs/photography.md`);
  });
  assert.equal(hash(b), a.sha256, `corrupt ${a.path}`);
  return a.path.endsWith(".png") ? b : JSON.parse(b);
}
function capture(data, cs, ip, count = 2) {
  assert.equal(data.isError, false);
  const r = JSON.parse(data.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual([cpu.cs, cpu.eip, cpu.ds, cpu.ss], [cs, ip, 0x1403, 0x1403]);
  assert.equal(r.results[1].addr, 0x14030);
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes, results: r.results };
}
function exact(a, b, exclusions = [], label = "bytes") {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    if (exclusions.some(([lo, hi]) => i >= lo && i < hi)) continue;
    if (a[i] !== b[i])
      assert.fail(`${label}:byte${i.toString(16)} ${a[i]} != ${b[i]}`);
  }
}
const files = {};
for (const name of [
  "DUCKTALE.EXE",
  "PS.ARC",
  "MAIN.ARC",
  "LOC.ARC",
  "LOOT.ARC",
]) {
  const b = await readFile(`game/${name}`);
  assert.equal(hash(b), build.files[name].sha256);
  files[name] = new Uint8Array(b);
}
const resources = {
  image: unpackImage(files["DUCKTALE.EXE"]),
  entries: parseArchive(files["PS.ARC"], "PS.ARC"),
  mainEntries: parseArchive(files["MAIN.ARC"], "MAIN.ARC"),
};
const destinations = parseLocations(
  parseArchive(files["LOC.ARC"], "LOC.ARC"),
).filter((l) => (l.flags & 15) === 4);
assert.deepEqual(
  destinations.map((l) => l.flags >>> 4).sort((a, b) => a - b),
  [1, 2, 3, 4, 5, 6],
);
assert.equal(destinations.find((l) => l.name === "Borneo").flags, 100);
assert.throws(
  () =>
    preparePhotography({
      ...resources,
      variant: 0,
      difficulty: 0,
      seed: 0,
      money: 0,
      day: 1,
      location: 1,
    }),
  /Unsupported photography destination/,
);
const entry = capture(raw.entry, 0xe0c, 0, 3),
  oldEntry = capture(await artifact(old.artifacts.entry), 0xe0c, 0, 3);
exact(
  Buffer.from(entry.results[2].data, "base64"),
  Buffer.from(oldEntry.results[2].data, "base64"),
  [],
  "revalidated full relocated photo overlay",
);
assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), 4);
assert.equal(entry.bytes.readUInt16LE(0x2229), 45009);
const initial = {
  variant: 4,
  difficulty: 0,
  seed: 45009,
  money: 2094,
  day: 27,
  location: 12,
};
const mapBefore = capture(raw["map-before"], 0xed6, 0x1238),
  mapAfter = capture(raw["map-after"], 0xed6, 0x1238),
  patched = Buffer.from(mapBefore.bytes);
assert.equal(manifest.injections.length, 3);
for (const p of manifest.injections) {
  assert.equal(p.stop, 359);
  assert.deepEqual(
    [...patched.subarray(p.offset, p.offset + p.before.length)],
    p.before,
  );
  patched.set(p.after, p.offset);
}
exact(patched, mapAfter.bytes, [], "explicit Kenya shortcut");
assert.deepEqual(mapBefore.cpu, mapAfter.cpu);

function passes({
  omitCase = false,
  alterRng = false,
  alterPose = false,
} = {}) {
  let count = 0,
    draws = 0;
  for (const p of manifest.passes) {
    if (omitCase && p.id === 10) continue;
    assert.equal(p.cs, 0xf2e);
    assert.equal(p.beforeIP, 0x144);
    assert.equal(p.afterIP, 0x8e3);
    const before = capture(raw[`pass${p.id}-before`], p.cs, p.beforeIP),
      after = capture(raw[`pass${p.id}-after`], p.cs, p.afterIP),
      m = new FlightMemory(before.bytes);
    assert.equal(p.stackExclusion[1], before.cpu.esp);
    assert.ok(p.stackExclusion[0] >= before.cpu.esp - 112);
    advancePhotographyAnimals(m, { draw: () => draws++, sound: () => {} });
    if (alterRng && p.id === 0) m.i(0x2229, m.i(0x2229) ^ 1);
    if (alterPose && p.id === 10) m.b(0x897c, m.b(0x897c) ^ 1);
    exact(
      m.bytes,
      after.bytes,
      [p.stackExclusion, [0x2225, 0x2229]],
      `original animation pass${p.id}`,
    );
    count++;
  }
  assert.equal(count, 11);
  assert.equal(draws, 12);
}
passes();
for (const mutation of ["omitCase", "alterRng", "alterPose"])
  assert.throws(() => passes({ [mutation]: true }));

function gameplayPixels(pass = 9) {
  const before = capture(raw[`pass${pass}-before`], 0xf2e, 0x144),
    p = new Photography(
      { ...resources, ...initial },
      new FlightMemory(entry.bytes),
    );
  p.memory = new FlightMemory(before.bytes);
  return p.pixels(p.frame());
}
const gameplay = PNG.sync.read(raw["scene-png"]);
assert.deepEqual([gameplay.width, gameplay.height], [320, 200]);
const scene = capture(raw.scene, 0xe0c, 0x7bf);
assert.equal(scene.bytes.readUInt16LE(0x5f48), 39);
exact(
  gameplayPixels(),
  gameplay.data,
  [],
  "fixed previous-presentation gameplay PNG",
);
assert.throws(() =>
  exact(gameplayPixels(10), gameplay.data, [], "wrong capture alignment"),
);
const resultBefore = capture(
    await artifact(old.artifacts["results-before"]),
    0xe0c,
    0x1094,
  ),
  resultPng = PNG.sync.read(await artifact(old.artifacts["results-png"]));
const prepared = preparePhotography({
    ...resources,
    ...initial,
    variant: 1,
    seed: 18797,
    day: 25,
    location: 7,
    money: 1094,
  }),
  rm = new FlightMemory(resultBefore.bytes),
  photos = rm.bytes.slice(
    resultBefore.cpu.ebp - 100,
    resultBefore.cpu.ebp - 88,
  );
const resultCommands = photographyResultsScene(
  rm,
  prepared.assets,
  photos,
  resources.image,
);
exact(
  renderFlightPixels(
    resultCommands,
    resources.entries,
    resources.mainEntries[42].data,
    "PS.ARC",
  ),
  resultPng.data,
  [],
  "original result PNG",
);
const badCommands = structuredClone(resultCommands);
badCommands.find((c) => c.op === "sprite").frame = 255;
assert.throws(
  () =>
    renderFlightPixels(
      badCommands,
      resources.entries,
      resources.mainEntries[42].data,
      "PS.ARC",
    ),
  /Unsupported flight animation frame/,
);

const returned = capture(await artifact(old.artifacts.return), 0xe0c, 0x1225),
  caller = capture(raw["caller-before"], 0x1f5, 0x4f2),
  callerAfter = capture(raw["caller-after"], 0x1f5, 0xc6a);
assert.equal(returned.bytes[0x4e0e], 26);
assert.equal(caller.bytes[0x4e0e], 27);
assert.equal(callerAfter.bytes[0x4e0e], 27);
assert.equal(caller.bytes.readUInt32LE(0x97a8), 1000);
assert.equal(callerAfter.bytes.readUInt32LE(0x97a8), 0);
for (const c of [returned, caller, callerAfter])
  assert.equal(c.bytes.readUInt32LE(0x8cc0), 2094);

assert.deepEqual(manifest.replayEnvironment.driverNumerator, 1193182);
assert.equal(manifest.replayEnvironment.driverDenominator, 16380);
assert.equal(manifest.replayEnvironment.retraceHz, 70.086);
function replay(c, mutation = {}) {
  const stream = c.inputEvents.flatMap((e) => {
      assert.ok(Number.isInteger(e.count) && e.count > 0);
      assert.ok(Number.isInteger(e.byte) && e.byte >= 0 && e.byte <= 255);
      return Array(e.count).fill(e.byte);
    }),
    dialogue = c.dialogueEvents.flatMap((e) => {
      assert.equal(typeof e.fire, "boolean");
      assert.ok(Number.isInteger(e.count) && e.count > 0);
      return Array(e.count).fill(e.fire);
    });
  assert.equal(stream.length, c.expectedInputCount);
  assert.equal(dialogue.length, c.expectedDialogueCount);
  if (mutation.removeInput) stream.pop();
  if (mutation.extraInput) stream.push(0);
  if (mutation.changeInput) stream[0] = 0;
  if (mutation.removeDialogue) dialogue.pop();
  if (mutation.extraDialogue) dialogue.push(false);
  const checkpoints = structuredClone(c.checkpoints);
  if (mutation.omitCheckpoint) checkpoints.pop();
  assert.equal(checkpoints.length, c.expectedCheckpointCount);
  let used = 0,
    polls = 0,
    driver = 0,
    retrace = 0,
    events = 0,
    checked = 0,
    presentation = 0;
  const p = new HistoricalPhotography({
    ...resources,
    ...c.initial,
    readInput: () => stream[used++],
    readDialogueFire: () => dialogue[polls++],
  });
  while (!p.outcome && events < 15000) {
    const before = p.inputs.length;
    const phaseBefore = p.phase;
    if ((driver + 1) / (1193182 / 16380) <= (retrace + 1) / 70.086) {
      driver++;
      p.advanceTick();
    } else {
      retrace++;
      p.advanceRetrace();
    }
    events++;
    assert.ok(p.inputs.length - before <= 1, "skipped input boundary");
    if (p.presentations !== presentation) {
      const delta = p.presentations - presentation;
      assert.ok(
        delta === 1 ||
          (delta === 2 && phaseBefore === "playing" && p.phase === "results"),
        "unexpected skipped presentation",
      );
      assert.equal(p.current.length, 256000);
      presentation = p.presentations;
    }
    const expected = checkpoints[checked];
    if (
      p.inputs.length !== before &&
      expected?.inputCount === p.inputs.length
    ) {
      assert.equal(
        hash(p.memory.bytes),
        expected.ds,
        `${c.id} DS checkpoint${checked}`,
      );
      assert.equal(hash(p.locals.bytes), expected.locals);
      assert.equal(hash(p.current), expected.pixels);
      assert.deepEqual(p.snapshot(), expected.state);
      checked++;
    }
  }
  assert.ok(p.outcome, "unfinished photography replay");
  assert.equal(used, stream.length, "unconsumed joystick events");
  assert.equal(polls, dialogue.length, "unconsumed dialogue events");
  assert.equal(used, c.expectedInputCount);
  assert.equal(polls, c.expectedDialogueCount);
  assert.equal(checked, c.expectedCheckpointCount);
  assert.equal(events, c.expectedClockEventCount);
  assert.equal(p.presentations, c.expectedPresentationCount);
  assert.equal(hash(p.memory.bytes), c.final.ds);
  assert.equal(hash(p.locals.bytes), c.final.locals);
  assert.equal(hash(p.current), c.final.pixels);
  assert.deepEqual(p.snapshot(), c.final.state);
  assert.deepEqual(p.drainEvents(), []);
  return p;
}
assert.equal(manifest.replays.length, 4);
let replayCount = 0,
  win,
  ordinary;
for (const c of manifest.replays) {
  const p = replay(c);
  if (c.id === "target-photos") {
    win = p;
    assert.equal(p.outcome.code, 1);
    assert.equal(p.outcome.score, 1500);
  } else {
    assert.equal(p.outcome.code, 0);
    if (c.id === "ordinary-only") {
      assert.equal(p.outcome.score, 50);
      ordinary = p;
    } else assert.equal(p.outcome.score, 0);
  }
  replayCount++;
}
assert.equal(replayCount, 4);
assert.ok(win);
assert.equal(manifest.expectedResourceCaseCount, 18);
assert.equal(manifest.resourceCoverage.length, 18);
const covered = new Set();
for (const c of manifest.resourceCoverage) {
  const key = `${c.initial.variant}/${c.initial.difficulty}`;
  assert.ok(!covered.has(key));
  covered.add(key);
  assert.ok([1, 2, 3, 4, 5, 6].includes(c.initial.variant));
  assert.ok([0, 1, 2].includes(c.initial.difficulty));
  let used = 0,
    polls = 0,
    d = 0,
    r = 0;
  const p = new HistoricalPhotography({
    ...resources,
    ...c.initial,
    readInput: () => (++used <= c.inputs ? c.inputByte : undefined),
    readDialogueFire: () =>
      ++polls <= c.dialogueEvents ? c.dialogueFire : undefined,
  });
  while (!p.outcome && d + r < 15000) {
    if ((d + 1) / (1193182 / 16380) <= (r + 1) / 70.086) {
      d++;
      p.advanceTick();
    } else {
      r++;
      p.advanceRetrace();
    }
  }
  assert.ok(p.outcome);
  assert.equal(used, c.inputs);
  assert.equal(polls, c.dialogueEvents);
  assert.equal(d + r, c.clockEvents);
  assert.equal(p.presentations, c.presentations);
  assert.equal(hash(p.memory.bytes), c.ds);
  assert.equal(hash(p.current), c.pixels);
  assert.deepEqual(p.outcome, c.outcome);
}
assert.equal(covered.size, 18);
for (const mutation of [
  "removeInput",
  "extraInput",
  "changeInput",
  "removeDialogue",
  "extraDialogue",
  "omitCheckpoint",
])
  assert.throws(() => replay(manifest.replays[0], { [mutation]: true }));
const game = new Game({
  locations: parseLocations(parseArchive(files["LOC.ARC"], "LOC.ARC")),
  loot: parseLoot(parseArchive(files["LOOT.ARC"], "LOOT.ARC")),
});
game.campaign.location = 1;
assert.notEqual(game.campaign.atomicLocation, 1);
game.scene = "photography";
game.photography = win;
game.collectPhotography();
assert.equal(game.scene, "map");
assert.equal(game.money, 1500);
assert.equal(game.campaign.day, 3);
assert.equal(game.campaign.locations[1].playerCollected, true);
assert.equal(win.memory.view.getUint32(0x97a8, true), 0);
const atomicGame = new Game({
  locations: parseLocations(parseArchive(files["LOC.ARC"], "LOC.ARC")),
  loot: parseLoot(parseArchive(files["LOOT.ARC"], "LOOT.ARC")),
});
atomicGame.campaign.location = 1;
atomicGame.campaign.atomicLocation = 1;
atomicGame.scene = "photography";
atomicGame.photography = replay(manifest.replays[0]);
atomicGame.collectPhotography();
assert.equal(atomicGame.scene, "expedition-result");
assert.equal(atomicGame.expeditionResult.phase, "atomic");
assert.equal(atomicGame.campaign.atomicAvailable, true);
atomicGame.input({ type: "fire" });
for (let i = 0; i < 700 && atomicGame.scene === "expedition-result"; i++)
  atomicGame.advanceTick();
assert.equal(atomicGame.scene, "map");
assert.equal(atomicGame.money, 1500);
assert.equal(atomicGame.campaign.day, 3);
assert.ok(ordinary);
const makeGame = () =>
  new Game({
    locations: parseLocations(parseArchive(files["LOC.ARC"], "LOC.ARC")),
    loot: parseLoot(parseArchive(files["LOOT.ARC"], "LOOT.ARC")),
  });
const failed = makeGame();
failed.scene = "photography";
failed.photography = ordinary;
failed.campaign.location = 1;
failed.campaign.atomicLocation = 0;
failed.collectPhotography();
assert.equal(failed.money, 50);
assert.equal(failed.campaign.day, 3);
assert.notEqual(failed.campaign.locations[1].playerCollected, true);
assert.equal(ordinary.memory.view.getUint32(0x97a8, true), 50);
// Conditional caller-boundary tests: the following success result is an
// explicit test input,not a played second expedition or original replay.
for (const kind of ["action", "cave"]) {
  const follow = makeGame(),
    memory = new FlightMemory(ordinary.memory.bytes),
    result = { memory, outcome: { code: 1 }, drainEvents: () => [] };
  follow.campaign.day = 3;
  follow.campaign.location = 2;
  follow.campaign.atomicLocation = 0;
  if (kind === "cave") {
    follow.scene = "cave";
    // This conditional result adapter supplies the required cave flush effect;
    // it does not stand in for a played cave or its keyboard reader.
    let flushes = 0;
    follow.cave = { ...result, flushInput: () => flushes++ };
    follow.collectCave();
    assert.equal(
      flushes,
      0,
      "shared photo-score shortcut has no cave result input wait",
    );
  } else {
    follow.scene = "jungle";
    follow.collectActionExpedition(result);
  }
  assert.equal(follow.scene, "map");
  assert.equal(follow.money, 50);
  assert.equal(follow.campaign.day, 4);
  assert.equal(follow.campaign.locations[2].playerCollected, true);
  assert.equal(memory.view.getUint32(0x97a8, true), 0);
  follow.campaign.location = 3;
  const reward = follow.loot[follow.campaign.locations[3].treasure - 1].value;
  follow.collectActionExpedition(result);
  assert.equal(follow.money, 50 + reward);
  assert.equal(follow.campaign.day, 5);
  assert.equal(follow.scene, "expedition-result");
}
console.log(
  "Photography:11 conditional full animation passes,2 exact original PNGs,fixed capture alignment and caller day/score checks;4 historical independent carried replays,20 unchanged checkpoints,18 historical destination/difficulty resource cases,11 negative controls;ordinary-score carry and atomic-unlock boundary checks. Whole-original expedition timing remains unverified.",
);

// Old exact contracts above reproduce with the declared historical class; the
// current production class must independently preserve every source input and
// publication sequence with its own drawing-time environment.
const { verifyPhotographyDrawingRegression } =
  await import("./verify-photography-drawing-time.js");
await verifyPhotographyDrawingRegression(resources, manifest);
