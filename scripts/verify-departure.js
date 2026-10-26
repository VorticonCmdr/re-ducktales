import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { Departure } from "../src/game/departure.js";
const parse = (raw) => {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.ok(r.results.length > 0);
  assert.ok(r.results.every((x) => x.status === "ok"));
  return r.results;
};
function bytes(read, length) {
  const b = Buffer.from(read.data, "base64");
  assert.equal(b.length, length, "incomplete departure memory read");
  return b;
}
export function compareDeparture(
  fixture,
  inputs,
  { alterResult = false, dropDraw = false } = {},
) {
  assert.deepEqual(Object.keys(fixture).sort(), [
    "before",
    "build",
    "entry",
    "prepared",
  ]);
  assert.equal(fixture.build, "dos-fb658562");
  assert.deepEqual(
    inputs,
    {
      from: 35,
      target: 25,
      days: 1,
      flags: 8,
      difficulty: 0,
      seed: 41725,
      rivalCollected: false,
    },
    "unexpected conditional starting contract",
  );
  const before = parse(fixture.before);
  assert.equal(before.length, 7);
  assert.equal(before[0].registers.eip, 0x6d9);
  assert.equal(before[0].registers.cs, 0x1f5);
  assert.equal(bytes(before[1], 2).readUInt16LE(), inputs.seed);
  assert.equal(bytes(before[2], 1)[0], 7);
  assert.equal(bytes(before[3], 1)[0], inputs.from);
  assert.equal(bytes(before[4], 1)[0], inputs.difficulty);
  const locals = bytes(before[6], 30);
  assert.equal(locals[0], inputs.target);
  assert.equal(locals.readUInt16LE(2), inputs.days);
  const prepared = parse(fixture.prepared);
  assert.equal(prepared.length, 9);
  assert.equal(prepared[0].registers.eip, 0x845);
  const d = new Departure(inputs);
  let consumed = 2;
  if (dropDraw) {
    d.seed = 0xa6a8;
    consumed--;
  }
  const actualSeed = bytes(prepared[1], 2).readUInt16LE();
  assert.equal(d.seed, actualSeed, "departure RNG divergence");
  const pLocals = bytes(prepared[6], 30);
  assert.equal(Number(d.racing), pLocals[8], "departure race flag divergence");
  assert.equal(d.raceRoll, actualSeed % 100);
  assert.equal(d.variant, 1, "observed briefing variant differs");
  assert.equal(bytes(prepared[2], 1)[0], 7);
  assert.equal(bytes(prepared[3], 1)[0], inputs.from);
  assert.equal(bytes(prepared[5], 2).readUInt16LE(), 0);
  assert.deepEqual(
    d.rivalRoute,
    { from: bytes(prepared[7], 1)[0], target: bytes(prepared[8], 1)[0] },
    "departure rival route divergence",
  );
  const entry = parse(fixture.entry);
  assert.equal(entry.length, 6);
  assert.equal(entry[0].registers.eip, 0);
  assert.equal(entry[0].registers.cs, 0xe0c);
  const stack = bytes(entry[1], 8);
  const expected = {
    days: stack.readUInt16LE(4),
    racing: stack.readUInt16LE(6),
  };
  if (alterResult) expected.days++;
  assert.deepEqual(
    d.flightRequest,
    expected,
    "departure flight arguments diverged",
  );
  assert.equal(bytes(entry[2], 2).readUInt16LE(), actualSeed);
  assert.equal(bytes(entry[3], 1)[0], 7);
  assert.equal(bytes(entry[4], 1)[0], inputs.from);
  assert.equal(
    bytes(entry[5], 16).toString("hex"),
    "558becb81c009a9e1e030656c606c103",
  );
  assert.equal(consumed, 2, "unconsumed RNG draw");
  return 2;
}
export async function verifyDeparture() {
  const m = JSON.parse(
    await readFile("reference/expedition-departure.json", "utf8"),
  );
  assert.equal(m.expectedCheckpointCount, 2);
  assert.equal(m.expectedRngDrawCount, 2);
  for (const a of Object.values(m.artifacts)) {
    const b = await readFile(a.path).catch(() => {
      throw Error(
        `SETUP: missing departure artifact ${a.path}; see docs/expedition-departures.md`,
      );
    });
    assert.equal(
      createHash("sha256").update(b).digest("hex"),
      a.sha256,
      `corrupt departure artifact ${a.path}`,
    );
  }
  const fixture = JSON.parse(await readFile(m.artifacts.trace.path, "utf8"));
  assert.equal(compareDeparture(fixture, m.routineInput), 2);
  assert.throws(
    () => compareDeparture(fixture, m.routineInput, { alterResult: true }),
    /arguments diverged/,
  );
  assert.throws(
    () => compareDeparture(fixture, m.routineInput, { dropDraw: true }),
    /RNG divergence/,
  );
  console.log(
    "Departure: 2 conditional original checkpoints; 2 RNG draws; 2 negative controls rejected.",
  );
}
if (process.argv[1]?.endsWith("verify-departure.js")) await verifyDeparture();
