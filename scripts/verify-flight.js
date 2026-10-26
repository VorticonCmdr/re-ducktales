import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  FlightMemory,
  advanceFlightPhysics,
  sampleFlightControls,
} from "../src/game/flight-physics.js";

function snapshot(raw, ip) {
  assert.equal(raw.isError, false, "capture tool reported an error");
  const data = JSON.parse(raw.content[0].text);
  assert.equal(data.aborted, false);
  assert.equal(data.results.length, 2);
  assert.ok(data.results.every((r) => r.status === "ok"));
  const cpu = data.results[0].registers;
  assert.equal(cpu.cs, 0xe0c);
  assert.equal(cpu.eip, ip);
  assert.equal(cpu.ds, 0x1403);
  assert.equal(cpu.ss, 0x1403);
  const bytes = Buffer.from(data.results[1].data, "base64");
  assert.equal(bytes.length, 65536, "incomplete flight snapshot");
  return { cpu, bytes };
}

// Every non-stack game-state write in 1330..194a, including early crash return.
// Device effects and the software-FPU scratch workspace are separate contracts.
const compared = [
  [0x0fae, 12],
  [0x0fb9, 1],
  [0x5ed6, 2],
  [0x6d18, 4],
  [0x6d3e, 4],
  [0x974c, 2],
  [0x5466, 2],
  [0x8a9c, 2],
  [0x6f3e, 4],
  [0x6f50, 1],
  [0x36c8, 4],
  [0x36ce, 2],
  [0x36d4, 2],
  [0x4d1e, 4],
  [0x4d30, 1],
  [0x7182, 4],
];

export function compareFlight(
  cases,
  { dropTurn = false, alterResult = false } = {},
) {
  assert.equal(cases.length, 8, "missing flight cases");
  let checked = 0;
  for (const c of cases) {
    const before = snapshot(c.before, 0x1330),
      after = snapshot(c.after, 0x194a);
    const m = new FlightMemory(before.bytes);
    if (dropTurn && c.id === "31") m.i(0x5466, 0);
    const result = advanceFlightPhysics(m);
    if (alterResult && c.id === "37") m.f(0x6d18, m.f(0x6d18) + 1);
    assert.equal(
      result.sprite,
      after.cpu.eax & 65535,
      `${c.id}: return sprite`,
    );
    assert.equal(result.sound, c.sound, `${c.id}: sound request`);
    assert.equal(
      result.splashFrames,
      0,
      "water-device boundary is not captured here",
    );
    for (const [offset, length] of compared)
      assert.deepEqual(
        m.bytes.slice(offset, offset + length),
        new Uint8Array(after.bytes.subarray(offset, offset + length)),
        `${c.id}: flight state at DS:${offset.toString(16)}`,
      );
    checked++;
  }
  // Narrow control-boundary comparisons: other intervening frame logic is
  // excluded, so these are not a claim of a closed-loop flight replay.
  for (const [from, to] of [
    ["31", "32"],
    ["32", "33"],
  ]) {
    const m = new FlightMemory(
      snapshot(cases.find((c) => c.id === from).after, 0x194a).bytes,
    );
    const expected = snapshot(
      cases.find((c) => c.id === to).before,
      0x1330,
    ).bytes;
    sampleFlightControls(m, { fire: true, up: true });
    for (const [offset, length] of [
      [0x0fae, 4],
      [0x5466, 2],
      [0x8a9c, 2],
    ])
      assert.deepEqual(
        m.bytes.slice(offset, offset + length),
        new Uint8Array(expected.subarray(offset, offset + length)),
        `controls ${from}->${to}`,
      );
    checked++;
  }
  assert.equal(checked, 10, "unfinished checkpoint sequence");
  return checked;
}

export async function verifyFlight() {
  const manifest = JSON.parse(
    await readFile("reference/flight-physics.json", "utf8"),
  );
  assert.equal(manifest.expectedCheckpointCount, 10);
  assert.equal(manifest.cases.length, 8);
  assert.deepEqual(
    manifest.cases.map((c) => c.id),
    ["0", "1", "26", "31", "32", "33", "35", "37"],
  );
  async function artifact(a) {
    const data = await readFile(a.path).catch(() => {
      throw Error(`SETUP: missing ${a.path}; see docs/flight.md`);
    });
    assert.equal(
      createHash("sha256").update(data).digest("hex"),
      a.sha256,
      `corrupt ${a.path}`,
    );
    return JSON.parse(data);
  }
  const cases = [];
  for (const c of manifest.cases)
    cases.push({
      id: c.id,
      sound: c.sound,
      before: await artifact(c.before),
      after: await artifact(c.after),
    });
  assert.equal(compareFlight(cases), manifest.expectedCheckpointCount);
  assert.throws(() => compareFlight(cases, { dropTurn: true }), /flight state/);
  assert.throws(
    () => compareFlight(cases, { alterResult: true }),
    /flight state/,
  );
  assert.throws(() => compareFlight(cases.slice(1)), /missing flight cases/);
  console.log(
    "Flight: 8 conditional physics + 2 control checkpoints match exact bytes; 3 negative controls rejected.",
  );
}
if (process.argv[1]?.endsWith("verify-flight.js")) await verifyFlight();
