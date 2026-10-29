import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Jungle } from "../src/game/jungle.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/timing.js";
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function jungleComponentResources() {
  const build = JSON.parse(await readFile("reference/build.json"));
  const files = {};
  for (const name of [
    "DUCKTALE.EXE",
    "JG.ARC",
    "MAIN.ARC",
    "MT.ARC",
    "IT.DRV",
  ]) {
    let bytes;
    try {
      bytes = await readFile(`game/${name}`);
    } catch {
      throw Error(`SETUP: missing game/${name}; see docs/jungle-timing.md`);
    }
    assert.equal(bytes.length, build.files[name].bytes, `Incomplete ${name}`);
    assert.equal(sha(bytes), build.files[name].sha256, `Corrupt ${name}`);
    files[name] = bytes;
  }
  return {
    image: unpackImage(files["DUCKTALE.EXE"]),
    entries: parseArchive(files["JG.ARC"]),
    mainEntries: parseArchive(files["MAIN.ARC"]),
    mountainEntries: parseArchive(files["MT.ARC"]),
    driverEntries: parseArchive(files["IT.DRV"]),
    executableRaw: files["DUCKTALE.EXE"],
  };
}
export const BASELINE_REVISION = "c406dc4fe1ad8e28283de327dbc54588faa958a6";
const imports = /\bfrom\s+["'](\.[^"']+)["']/g;

// Only the historical Jungle class differs. Every transitive shared dependency
// must still be byte-identical to the declared Git revision before it is used.
// No alternate source tree, guest state, timer fitting or expected-state input.
export async function historicalJungle() {
  const graph = {},
    root = process.cwd();
  async function visit(path) {
    if (graph[path]) return;
    let bytes;
    try {
      bytes = execFileSync("git", ["show", `${BASELINE_REVISION}:${path}`], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw Error(
        `SETUP: missing historical source ${BASELINE_REVISION}:${path}; see docs/jungle-timing.md`,
      );
    }
    graph[path] = sha(bytes);
    if (path !== "src/game/jungle.js")
      assert.equal(
        sha(await readFile(path)),
        graph[path],
        `Changed historical jungle dependency ${path}`,
      );
    const source = bytes.toString();
    assert.doesNotMatch(
      source,
      /\bimport\s*\(/,
      "Unsupported historical dynamic import",
    );
    for (const match of source.matchAll(imports)) {
      const dependency = relative(root, resolve(dirname(path), match[1]));
      assert.ok(
        dependency.startsWith("src/"),
        "Historical import outside source root",
      );
      await visit(dependency);
    }
    return source;
  }
  const source = await visit("src/game/jungle.js");
  const relocated = source.replace(imports, (all, specifier) =>
    all.replace(specifier, pathToFileURL(resolve("src/game", specifier)).href),
  );
  const { Jungle: HistoricalJungle } = await import(
    `data:text/javascript;base64,${Buffer.from(relocated).toString("base64")}`
  );
  return { Jungle: HistoricalJungle, graph };
}

export const CLOCK_RANGES = [
  [0x2221, 0x2229],
  [0x27f8, 0x27fc],
];
export function compareJungleMemory(actual, expected, label) {
  assert.equal(actual.length, 65536, `${label}: incomplete DS`);
  assert.equal(expected.length, 65536, `${label}: incomplete expected DS`);
  let start = 0;
  for (const [lo, hi] of [...CLOCK_RANGES, [65536, 65536]]) {
    for (let at = start; at < lo; at++)
      if (actual[at] !== expected[at])
        assert.fail(
          `${label}: DS ${at.toString(16)} differs (${actual[at]} versus ${expected[at]})`,
        );
    start = hi;
  }
}
export function gameplaySnapshot(snapshot) {
  const { tick, retrace, presentations, drawingWork, ...gameplay } = snapshot;
  return gameplay;
}
function clockWords(memory) {
  return [0x2221, 0x2225, 0x27f8].map((at) => memory.view.getUint32(at, true));
}

// The input is an authored sequence of values at successive source input reads.
// The clock schedule is independent of expected state and renderer completion.
// Observers receive copies/hashes, never mutable simulation memory.
export function replayJungleComponent({
  resources,
  manifest,
  JungleClass = Jungle,
  inputStream = manifest.inputEvents.flatMap((e) =>
    Array(e.count).fill(e.byte),
  ),
  checkpointCounts = manifest.checkpoints.map((c) => c.inputCount),
  onPoll = () => {},
  onPresentation = () => {},
  onCheckpoint = () => {},
  omitFire = false,
  mutateObservation = null,
}) {
  let elapsed = 0;
  const jungle = new JungleClass({
    ...resources,
    ...manifest.initial,
    clock: () => elapsed,
  });
  let driver = 0,
    retrace = 0,
    events = 0,
    presentation = 0,
    polls = 0;
  const checkpoints = [],
    clockTrace = [],
    presentationTiming = [];
  const counts = new Set(checkpointCounts);
  assert.equal(
    counts.size,
    checkpointCounts.length,
    "Duplicate jungle checkpoints",
  );
  // A single clock event may publish a finished page and begin a wipe. Observe
  // the source counter itself so neither payload can disappear between steps.
  function publication(value) {
    assert.equal(value, presentation + 1, "Skipped jungle presentation");
    assert.equal(
      jungle.current?.length,
      256000,
      "Invalid jungle presentation payload",
    );
    presentation = value;
    assert.ok(
      ["overlay", "replace"].includes(jungle.presentationMode),
      "Unsupported jungle presentation mode",
    );
    const point = {
      index: presentation,
      sha256: sha(jungle.current),
      mode: jungle.presentationMode,
      wipeToken: jungle.wipeToken,
    };
    mutateObservation?.({ kind: "presentation", point });
    onPresentation(point);
    presentationTiming.push([presentation, driver, retrace, jungle.frames]);
  }
  assert.equal(
    jungle.presentations,
    1,
    "Unexpected initial jungle publication count",
  );
  let sourcePresentations = jungle.presentations;
  publication(sourcePresentations);
  Object.defineProperty(jungle, "presentations", {
    enumerable: true,
    configurable: true,
    get: () => sourcePresentations,
    set(value) {
      sourcePresentations = value;
      publication(value);
    },
  });
  const originalRead = jungle.readInput;
  jungle.readInput = function* () {
    const bytes = Buffer.from(jungle.memory.bytes),
      inputCount = jungle.inputs.length + 1;
    mutateObservation?.({ kind: "poll", inputCount, bytes });
    // Derive the recorded clock words from the same observed DS copy checked by
    // the comparator. A negative may alter that copy but cannot alter the game.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    const row = [
      inputCount,
      jungle.tick,
      jungle.retrace,
      jungle.logicalTick,
      jungle.presentations,
      ...[0x2221, 0x2225, 0x27f8].map((at) => view.getUint32(at, true)),
    ];
    clockTrace.push(row);
    polls++;
    onPoll({ inputCount, bytes });
    yield* originalRead.call(jungle);
  };
  while (!jungle.outcome && events < 20000) {
    const before = jungle.inputs.length,
      byte = inputStream[before];
    if (byte !== undefined) {
      assert.ok(
        Number.isInteger(byte) && byte >= 0 && byte <= 127,
        "Invalid jungle input byte",
      );
      jungle.setControls({
        direction:
          { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
        fire: !omitFire && !!(byte & 64),
      });
    }
    const nextDriver = (driver + 1) / DRIVER_HZ,
      nextRetrace = (retrace + 1) / RETRACE_HZ;
    if (nextDriver <= nextRetrace) {
      elapsed = nextDriver * 1000;
      driver++;
      jungle.advanceTick();
    } else {
      elapsed = nextRetrace * 1000;
      retrace++;
      jungle.advanceRetrace();
    }
    events++;
    assert.ok(
      jungle.inputs.length - before <= 1,
      "Skipped jungle input boundary",
    );
    if (jungle.inputs.length > before) {
      assert.notEqual(byte, undefined, "Unfinished jungle input stream");
      assert.equal(
        jungle.inputs.at(-1).input,
        omitFire ? byte & 63 : byte,
        "Unconsumed jungle input",
      );
      if (counts.has(jungle.inputs.length)) {
        const point = {
          inputCount: jungle.inputs.length,
          ...jungle.snapshot(),
          memorySha256: sha(jungle.memory.bytes),
          pixelSha256: jungle.current ? sha(jungle.current) : null,
        };
        checkpoints.push(point);
        onCheckpoint(point);
      }
    }
  }
  assert.ok(jungle.outcome, "Unfinished jungle scenario");
  assert.equal(
    jungle.inputs.length,
    inputStream.length,
    "Unconsumed jungle input events",
  );
  assert.equal(
    polls,
    inputStream.length,
    "Missing or repeated source input poll",
  );
  assert.equal(
    checkpoints.length,
    checkpointCounts.length,
    "Unfinished jungle checkpoints",
  );
  return {
    checkpoints,
    final: jungle.snapshot(),
    finalMemory: Buffer.from(jungle.memory.bytes),
    finalClockWords: clockWords(jungle.memory),
    clockTrace,
    presentationTiming,
    expectedInputCount: inputStream.length,
    presentations: presentation,
    events,
    driver,
    retrace,
    clockTraceSha256: sha(JSON.stringify(clockTrace)),
    presentationTimingSha256: sha(JSON.stringify(presentationTiming)),
  };
}
