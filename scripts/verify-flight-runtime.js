import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Flight } from "../src/game/flight.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { FLIGHT_SPRITES } from "../src/game/flight-setup.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Game } from "../src/game/application.js";
import { parseLocations } from "../src/game/campaign.js";

function capture(raw, ip, cs = 0xe0c) {
  assert.equal(raw.isError, false);
  const data = JSON.parse(raw.content[0].text);
  assert.equal(data.aborted, false);
  assert.equal(data.results.length, 2);
  assert.ok(data.results.every((r) => r.status === "ok"));
  const cpu = data.results[0].registers;
  assert.deepEqual([cpu.cs, cpu.eip, cpu.ds, cpu.ss], [cs, ip, 0x1403, 0x1403]);
  return new FlightMemory(Buffer.from(data.results[1].data, "base64"));
}
const ranges = [
  [0x2229, 2],
  [0x0faa, 24],
  [0x36c8, 14],
  [0x8cc0, 4],
  [0x7978, 1],
  [0x4e0e, 1],
  [0x4d4c, 2],
  [0x8d7c, 2],
  [0x5ed6, 2],
  [0x974c, 2],
  [0x5466, 2],
  [0x8a9c, 2],
  [0x6d18, 4],
  [0x6d3e, 4],
  [0x88b0, 2],
  [0x78ea, 2],
  [0x4f42, 520],
  [0x79f2, 3640],
  ...[...FLIGHT_SPRITES.values()].map((at) => [at, 20]),
];
function compare(actual, expected) {
  for (const [at, length] of ranges)
    assert.deepEqual(
      actual.bytes.slice(at, at + length),
      expected.bytes.slice(at, at + length),
      `runtime divergence at DS:${at.toString(16)}`,
    );
}
export function compareCrash(
  local,
  resources,
  { skipFrame = false, alterResult = false } = {},
) {
  const initial = capture(local.start, 0xb45),
    end = capture(local.end, 0xb9a),
    final = capture(local.final, 0xee6);
  // Conditional animation boundary. Exact captured game state is the declared
  // initial state; it is not a whole-flight input replay or machine restore.
  const f = new Flight({
    ...resources,
    day: 12,
    days: 1,
    racing: 0,
    difficulty: 0,
    seed: 52740,
    money: 50,
  });
  f.memory = initial;
  f.course.memory = initial;
  f.frames = initial.view.getUint16(0x88b0, true);
  assert.equal(f.frames, 132);
  f.pending = null;
  f.current = null;
  f.buffers = [[], []];
  f.presentations = 0;
  f.iterator = f.crash();
  f.resume();
  let steps = 0;
  while (f.wait && steps++ < 300) {
    f.advanceTick();
    f.advanceRetrace();
    if (f.current)
      renderFlightPixels(f.current, resources.entries, resources.font);
    if (skipFrame && f.presentations === 24) break;
  }
  assert.equal(f.wait, null, "unfinished crash sequence");
  assert.equal(f.presentations, 25, "missing crash presentation");
  compare(f.memory, end);
  f.iterator = f.finish("crashed");
  f.outcome = null;
  f.resume();
  steps = 0;
  while (f.phase !== "return-wait" && f.wait && steps++ < 100) {
    f.advanceTick();
    f.advanceRetrace();
  }
  assert.equal(f.phase, "return-wait", "unfinished final calendar sequence");
  assert.deepEqual(f.wait, { clock: "driver", remaining: 7 });
  assert.equal(f.presentations, 27);
  if (alterResult) f.memory.b(0x4e0e, f.memory.b(0x4e0e) + 1);
  compare(f.memory, final);
  // The captured0ee6 boundary precedes09f5(20). Verify that separate wait
  // without pretending its clocks belong to the earlier calendar capture.
  for (let i = 0; i < 139; i++) {
    f.advanceTick();
    f.advanceRetrace();
    assert.equal(f.outcome, null);
  }
  f.advanceTick();
  f.advanceRetrace();
  assert.equal(f.wait, null, "unfinished final return wait");
  compare(f.memory, final);
  assert.deepEqual(f.outcome, {
    status: "crashed",
    code: 0,
    day: 13,
    seed: 7341,
    money: 50,
    frames: 132,
  });
  // Carry the translated outcome into the caller. Location1 is a synthetic,
  // unused caller parameter here; only repair day/cash/RNG are compared.
  const game = new Game({ locations: resources.locations });
  game.departure = { target: 1, racing: false };
  game.flight = f;
  game.collectFlight();
  const repair = capture(local.repair, 0x8f3, 0x1f5);
  const loss = capture(local.loss, 0xae5, 0x1f5);
  const compareCaller = (expected) => {
    assert.equal(
      game.campaign.day,
      expected.b(0x4e0e),
      "repair day divergence",
    );
    assert.equal(
      game.money,
      expected.view.getUint32(0x8cc0, true),
      "repair cash divergence",
    );
    assert.equal(
      game.seed,
      expected.view.getUint16(0x2229, true),
      "repair RNG divergence",
    );
  };
  assert.equal(game.repairs.phase, "repair");
  compareCaller(repair);
  game.finishRepairs();
  assert.equal(game.repairs.phase, "wreckage");
  assert.equal(game.repairs.loss, 25);
  compareCaller(loss);
  return 4;
}
export async function verifyFlightRuntime() {
  const manifest = JSON.parse(
    await readFile("reference/flight-runtime.json", "utf8"),
  );
  assert.equal(manifest.expectedCheckpointCount, 4);
  assert.equal(manifest.requiredPresentationCount, 27);
  const local = {};
  for (const [key, a] of Object.entries(manifest.artifacts)) {
    const bytes = await readFile(a.path).catch(() => {
      throw Error(`SETUP: missing ${a.path}; see docs/flight.md`);
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      a.sha256,
      `corrupt ${a.path}`,
    );
    local[key] = JSON.parse(bytes);
  }
  const build = JSON.parse(await readFile("reference/build.json", "utf8")),
    files = {};
  for (const name of ["DUCKTALE.EXE", "PLANE.ARC", "MAIN.ARC", "LOC.ARC"]) {
    const bytes = await readFile(`game/${name}`);
    assert.equal(bytes.length, build.files[name].bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      build.files[name].sha256,
    );
    files[name] = bytes;
  }
  const resources = {
    image: unpackImage(files["DUCKTALE.EXE"]),
    entries: parseArchive(files["PLANE.ARC"], "PLANE.ARC"),
    font: parseArchive(files["MAIN.ARC"], "MAIN.ARC")[42].data,
    locations: parseLocations(parseArchive(files["LOC.ARC"], "LOC.ARC")),
  };
  assert.equal(
    compareCrash(local, resources),
    manifest.expectedCheckpointCount,
  );
  assert.throws(
    () => compareCrash(local, resources, { skipFrame: true }),
    /unfinished crash/,
  );
  assert.throws(
    () => compareCrash(local, resources, { alterResult: true }),
    /runtime divergence/,
  );
  assert.throws(() => compareCrash({ ...local, end: null }, resources));
  // The driver clips an entirely offscreen frame ff without fetching pixels.
  renderFlightPixels(
    [{ op: "sprite", asset: 58, frame: 255, x: 320, y: 0 }],
    resources.entries,
    resources.font,
  );
  assert.throws(
    () =>
      renderFlightPixels(
        [{ op: "sprite", asset: 58, frame: 255, x: 319, y: 0 }],
        resources.entries,
        resources.font,
      ),
    /Unsupported flight animation frame/,
  );
  console.log(
    "Flight runtime: 4 conditional crash/calendar/repair checkpoints, 27 presentations, 3 negative controls; visible invalid frames rejected.",
  );
}
if (process.argv[1]?.endsWith("verify-flight-runtime.js"))
  await verifyFlightRuntime();
