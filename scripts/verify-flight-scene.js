import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import {
  FlightMemory,
  advanceFlightPhysics,
  sampleFlightControls,
} from "../src/game/flight-physics.js";
import { FLIGHT_SPRITES } from "../src/game/flight-setup.js";
import { advanceFlightScene } from "../src/game/flight-scene.js";
import { collideFlight } from "../src/game/flight-collisions.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

function capture(raw, ip, count = 2) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.equal(cpu.cs, 0xe0c);
  assert.equal(cpu.ds, 0x1403);
  assert.equal(cpu.ss, 0x1403);
  assert.equal(cpu.eip, ip);
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536, "incomplete flight scene capture");
  return { memory: new FlightMemory(bytes), reads: r.results };
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
function compareState(m, expected, checkpoint) {
  for (const [at, length] of ranges)
    assert.deepEqual(
      m.bytes.slice(at, at + length),
      expected.bytes.slice(at, at + length),
      `${checkpoint}: state divergence at DS:${at.toString(16)}`,
    );
}
function context(m) {
  const optional = m.b(0x5ed4)
    ? [59, 60]
    : m.b(0x8c81)
      ? [40, 41, 42, 43]
      : [29, 30, 31];
  return {
    assets: new Map(
      [...FLIGHT_SPRITES]
        .filter(
          ([id]) =>
            ![29, 30, 31, 40, 41, 42, 43, 59, 60].includes(id) ||
            optional.includes(id),
        )
        .map(([id, at]) => [at, id]),
    ),
    scenery: { picture: m.b(0x544a) ? m.b(0x544a) + 34 : 28 },
  };
}
function comparePixels(commands, png, resources, label) {
  assert.equal(png.width, 320);
  assert.equal(png.height, 200);
  const actual = renderFlightPixels(
    commands,
    resources.entries,
    resources.font,
  );
  assert.ok(Buffer.from(actual).equals(png.data), `${label}: pixel divergence`);
}

export function compareFlightScene(
  local,
  resources,
  { omitFire = false, alterPixels = false } = {},
) {
  let checked = 0;
  // First frame: physics -> caller's frame counter -> scene -> present.
  let m = capture(local.firstStart, 0x1330).memory;
  const physics = advanceFlightPhysics(m);
  assert.equal(physics.sprite, 0x6f3e);
  m.i(0x88b0, 1);
  let commands = advanceFlightScene(m, context(m), physics.sprite);
  compareState(m, capture(local.firstExpected, 0x2a7).memory, "first frame");
  checked++;
  if (alterPixels) commands[0].color = 10;
  comparePixels(commands, local.firstImage, resources, "first frame");
  checked++;

  // An independent input stream is consumed only after each checkpoint.
  // No expected memory is ever copied back into this closed-loop segment.
  m = capture(local.loopStart, 0x1330).memory;
  assert.equal(m.i(0x88b0), 1);
  assert.equal(local.expected.build, "dos-fb658562");
  assert.equal(local.expected.outputs.length, 16, "missing flight checkpoints");
  assert.equal(
    local.inputs.inputs.length,
    15,
    "unconsumed or missing flight inputs",
  );
  assert.equal(
    local.inputs.boundary,
    "original input return 0e0c:02b3, captured AX low byte",
  );
  assert.equal(local.capturedInputs.inputs.length, 16);
  assert.deepEqual(
    local.inputs.inputs,
    local.capturedInputs.inputs.slice(0, 15),
  );
  let consumed = 0;
  for (let step = 0; step < 16; step++) {
    const p = advanceFlightPhysics(m);
    assert.equal(p.sprite, 0x6f3e, "unexpected crash path in replay segment");
    m.i(0x88b0, m.i(0x88b0) + 1);
    commands = advanceFlightScene(m, context(m), p.sprite);
    renderFlightPixels(commands, resources.entries, resources.font); // strict drawing validation on every update
    const collision = collideFlight(m).next();
    assert.equal(
      collision.done,
      true,
      "unexpected unfinished collision animation",
    );
    assert.equal(collision.value, 0, "unexpected flight termination");
    compareState(
      m,
      capture(local.expected.outputs[step], 0x2b3).memory,
      `loop ${step}`,
    );
    if (step < 15) {
      const event = local.inputs.inputs[consumed++];
      assert.equal(event.step, step, "skipped or reordered input");
      assert.ok(
        Number.isInteger(event.code) && event.code >= 0 && event.code <= 255,
      );
      const code = omitFire && step === 0 ? event.code & 63 : event.code;
      sampleFlightControls(m, {
        fire: !!(code & 192),
        up: (code & 63) === 1,
        down: (code & 63) === 5,
      });
    }
    assert.ok(
      [0x0fb6, 0x0fb7, 0x0fb8].every((at) => m.b(at) === 0),
      "unexpected unsupported special-animation path",
    );
    checked++;
  }
  assert.equal(
    consumed,
    local.inputs.inputs.length,
    "unconsumed required events",
  );

  for (const name of ["scene", "drop"]) {
    const before = capture(local[`${name}Before`], 0xf78, 3);
    m = before.memory;
    const stack = Buffer.from(before.reads[2].data, "base64");
    assert.equal(stack.length, 8);
    assert.equal(stack.readUInt16LE(2), 0xe0c);
    if (name === "drop")
      assert.equal(m.b(0x7a61), 1, "missing representative release phase");
    commands = advanceFlightScene(m, context(m), stack.readUInt16LE(4));
    compareState(m, capture(local[`${name}After`], 0x132f).memory, name);
    checked++;
    if (name === "drop")
      assert.equal(m.b(0x7a61), 2, "release did not reach falling phase");
    comparePixels(commands, local[`${name}Image`], resources, name);
    checked++;
  }
  assert.equal(checked, 22, "zero, skipped or unfinished scene checkpoints");
  return checked;
}

export async function verifyFlightScene() {
  const manifest = JSON.parse(
    await readFile("reference/flight-scene.json", "utf8"),
  );
  assert.equal(manifest.expectedCheckpointCount, 22);
  assert.equal(manifest.expectedInputCount, 15);
  const local = {};
  for (const [key, a] of Object.entries(manifest.artifacts)) {
    const data = await readFile(a.path).catch(() => {
      throw Error(`SETUP: missing ${a.path}; see docs/flight.md`);
    });
    assert.equal(
      createHash("sha256").update(data).digest("hex"),
      a.sha256,
      `corrupt ${a.path}`,
    );
    assert.ok(["json", "png"].includes(a.type));
    local[key] = a.type === "png" ? PNG.sync.read(data) : JSON.parse(data);
  }
  const build = JSON.parse(await readFile("reference/build.json", "utf8"));
  const files = {};
  for (const name of ["DUCKTALE.EXE", "PLANE.ARC", "MAIN.ARC"]) {
    const data = await readFile(`game/${name}`);
    assert.equal(data.length, build.files[name].bytes);
    assert.equal(
      createHash("sha256").update(data).digest("hex"),
      build.files[name].sha256,
    );
    files[name] = new Uint8Array(data);
  }
  const resources = {
    entries: parseArchive(files["PLANE.ARC"], "PLANE.ARC"),
    font: parseArchive(files["MAIN.ARC"], "MAIN.ARC")[42].data,
  };
  assert.equal(
    compareFlightScene(local, resources),
    manifest.expectedCheckpointCount,
  );
  assert.throws(
    () => compareFlightScene(local, resources, { omitFire: true }),
    /state divergence/,
  );
  assert.throws(
    () => compareFlightScene(local, resources, { alterPixels: true }),
    /pixel divergence/,
  );
  assert.throws(
    () =>
      compareFlightScene(
        { ...local, expected: { ...local.expected, outputs: [] } },
        resources,
      ),
    /missing flight checkpoints/,
  );
  assert.throws(
    () =>
      compareFlightScene(
        {
          ...local,
          inputs: {
            ...local.inputs,
            inputs: [...local.inputs.inputs, { step: 15, code: 0 }],
          },
        },
        resources,
      ),
    /unconsumed or missing/,
  );
  console.log(
    "Flight scene: 16 closed-loop state + 3 conditional state + 3 exact PNG checkpoints; 15 inputs consumed; 4 negative controls rejected.",
  );
}
if (process.argv[1]?.endsWith("verify-flight-scene.js"))
  await verifyFlightScene();
