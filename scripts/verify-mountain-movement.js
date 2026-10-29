import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Mountain } from "../src/game/mountain.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

function decode(raw, ip, count = 2) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual(
    [cpu.cs, cpu.eip, cpu.ds, cpu.ss],
    [0xe0c, ip, 0x1403, 0x1403],
  );
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes };
}

export async function verifyMountainMovement(resources) {
  const manifest = JSON.parse(
    await readFile("reference/mountain-movement.json", "utf8"),
  );
  assert.equal(manifest.expectedInputCount, 15);
  assert.equal(manifest.expectedCheckpointCount, 15);
  const stream = manifest.inputEvents.flatMap((e) =>
    Array(e.count).fill(e.byte),
  );
  assert.equal(stream.length, 15);
  const artifacts = {};
  for (const [key, a] of Object.entries({
    entry: manifest.initialArtifact,
    ...manifest.artifacts,
  })) {
    const raw = await readFile(a.path).catch(() => {
      throw Error(`SETUP: missing ${a.path}; see docs/mountain.md`);
    });
    assert.equal(
      createHash("sha256").update(raw).digest("hex"),
      a.sha256,
      `corrupt ${a.path}`,
    );
    artifacts[key] = JSON.parse(raw);
  }
  assert.equal(
    Object.keys(artifacts).length,
    31,
    "missing checkpoint artifact",
  );
  const entry = decode(artifacts.entry, 0, 3),
    bp = entry.cpu.esp - 2;
  assert.equal(bp, 0x9f48);
  function compare({
    omitInput = false,
    alterResult = false,
    omitCheckpoint = false,
  } = {}) {
    const m = new FlightMemory(entry.bytes);
    const g = new Mountain(
      {
        ...resources,
        variant: 0,
        difficulty: m.b(0x8990),
        day: m.b(0x4e0e),
        money: m.view.getUint32(0x8cc0, true),
        seed: m.view.getUint16(0x2229, true),
        stackBytes: entry.bytes.subarray(bp - 0x52, bp),
      },
      m,
    );
    for (let step = 0; step < 100 && g.presentations < 1; step++)
      g.advanceRetrace();
    assert.equal(g.presentations, 1, "Unfinished opening page");
    assert.equal(g.inputs.length, 0);
    const ranges = [
      [0x5ae0, 2],
      [0x5c72, 2],
      [0x5c70, 2],
      [0x54f6, 2],
      [0x6882, 2],
      [0x6d3c, 2],
      [0x3d12, 2],
      [0x5510, 2],
      [0x6df0, 2],
      [0x370a, 1],
      [0x1615, 1],
      [0x17da, 12],
      [0x3742, 4],
      [0x2229, 2],
      [0x1618, 150],
      ...[0x36ea, 0x36ec, 0x36ee, 0x36f0, 0x3734, 0x3736, 0x3706, 0x3708].map(
        (at) => [at, 2],
      ),
    ];
    const locals = [
      [-0x1e, 1],
      [-0x36, 1],
      [-0x50, 2],
      [-0x32, 1],
      [-0x34, 1],
      [-0x2c, 1],
      [-0x28, 1],
      [-0x22, 2],
      [-0x4c, 2],
      [-0x24, 1],
    ];
    let executed = 0;
    const cache = new WeakMap();
    for (let i = 0; i < stream.length; i++) {
      if (omitCheckpoint && i === 4) continue;
      const key = String(i).padStart(2, "0"),
        input = decode(artifacts[`${key}-input`], 0x31c),
        after = decode(artifacts[`${key}-after`], 0x145d);
      assert.equal(input.cpu.ebp, bp);
      assert.equal(after.cpu.ebp, bp);
      assert.equal(
        input.cpu.eax & 255,
        stream[i],
        `input${i}: capture/stream disagreement`,
      );
      const byte = omitInput && i === 1 ? 0 : stream[i];
      g.setControls({ fire: false, direction: byte === 3 ? "right" : null });
      // This routine comparison supplies the declared input at its consumption
      // boundary. It does not supply native timer values or fit an elapsed time.
      for (let step = 0; step < 100 && g.inputs.length === i; step++) {
        g.advanceTick();
        g.advanceRetrace();
      }
      assert.equal(g.inputs.length, i + 1, "input consumption boundary");
      if (alterResult && i === 3) after.bytes[0x5ae0] ^= 1;
      for (const [at, n] of ranges)
        assert.deepEqual(
          Buffer.from(m.bytes.subarray(at, at + n)),
          after.bytes.subarray(at, at + n),
          `checkpoint${i} DS:${at.toString(16)} divergence`,
        );
      for (const [offset, n] of locals)
        assert.deepEqual(
          Buffer.from(
            g.locals.bytes.subarray(0x52 + offset, 0x52 + offset + n),
          ),
          after.bytes.subarray(bp + offset, bp + offset + n),
          `checkpoint${i} local${offset.toString(16)} divergence`,
        );
      renderFlightPixels(
        g.current,
        g.entries,
        resources.mainEntries[42].data,
        "MT.ARC / MAIN.ARC",
        cache,
      );
      executed++;
    }
    assert.equal(executed, 15, "missing checkpoint");
    assert.equal(g.inputs.length, 15, "unfinished input sequence");
    assert.equal(g.outcome, null, "unexpected outcome");
    return executed;
  }
  const count = compare();
  assert.throws(() => compare({ omitInput: true }), /divergence/);
  assert.throws(() => compare({ alterResult: true }), /divergence/);
  assert.throws(
    () => compare({ omitCheckpoint: true }),
    /input consumption boundary|missing checkpoint/,
  );
  console.log(
    `Mountain original movement: ${count} conditional closed-loop checkpoints and consumed input samples, exact actor/action/RNG/hazards/page histories/live locals; 3 negative controls. No hook/pixel/timing parity claimed.`,
  );
}
