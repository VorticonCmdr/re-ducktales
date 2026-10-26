import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { Game } from "../src/game/application.js";
import { MoneyBin } from "../src/game/money-bin.js";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function compareFailedDive(
  fixture,
  { dropFire = false, alterResult = false } = {},
) {
  assert.equal(
    fixture.checkpoints.length,
    14,
    "expected exactly 14 original checkpoints",
  );
  assert.deepEqual(
    fixture.input,
    { fireAtNextPose: 4, coinAvailable: false },
    "unexpected starting contract",
  );
  const bin = new MoneyBin({ coinAvailable: false });
  let executed = 0,
    consumed = 0;
  // Independent input stream: one fire after 6 intro and 2 idle frames.
  for (let tick = 0; tick < 3000 && !bin.complete; tick++) {
    if (tick === 182 && !dropFire) {
      bin.enqueueFire();
      consumed++;
    }
    bin.advanceTick();
    if (bin.phase === "dive" && bin.current.source === "09da") {
      const checkpoint = fixture.checkpoints[executed];
      assert.ok(checkpoint, "unexpected extra checkpoint");
      const bytes = Buffer.from(checkpoint.reads[0].data, "base64");
      assert.equal(bytes.length, 60);
      const local = Buffer.from(checkpoint.reads[1].data, "base64");
      assert.equal(local.length, 10);
      const frame = local.readInt16LE(6);
      assert.equal(frame, executed, "checkpoint skipped or out of order");
      const original =
        frame < 7
          ? {
              asset: 9,
              frame: bytes[18],
              x: bytes.readInt16LE(0),
              y: bytes.readInt16LE(2),
            }
          : {
              asset: 10,
              frame: bytes[38],
              x: bytes.readInt16LE(20),
              y: bytes.readInt16LE(22),
            };
      if (alterResult && executed === 3) original.x++;
      assert.deepEqual(
        bin.current.sprites[0],
        original,
        `original divergence at checkpoint ${executed}`,
      );
      assert.deepEqual(bin.current.sprites[1], {
        asset: 8,
        frame: bytes[58],
        x: bytes.readInt16LE(40),
        y: bytes.readInt16LE(42),
      });
      executed++;
    }
    bin.advanceRetrace();
  }
  assert.equal(consumed, 1, "required fire event not consumed");
  assert.equal(executed, 14, "missing required original checkpoints");
  assert.equal(bin.complete, true, "unfinished input / animation sequence");
  assert.equal(bin.won, false);
  return executed;
}
export function compareSuccessfulDive(
  fixture,
  { dropFire = false, alterResult = false } = {},
) {
  assert.deepEqual(fixture.input, { fireAtNextPose: 3, coinAvailable: true });
  assert.equal(
    fixture.checkpoints.length,
    14,
    "missing successful pose checkpoints",
  );
  assert.equal(
    fixture.gate.stop.registers.eax & 255,
    192,
    "original fire input differs",
  );
  const gate = Buffer.from(fixture.gate.read.results[0].data, "base64");
  assert.equal(gate.readUInt16LE(2), 3, "original next-pose differs");
  assert.equal(
    Buffer.from(fixture.gate.read.results[1].data, "base64").readUInt16LE(0),
    0,
    "original coin latch differs",
  );
  const game = new Game();
  game.input({ type: "fire" });
  game.input({ type: "fire" });
  game.input({ type: "money-bin" });
  let executed = 0,
    consumed = 0;
  for (let tick = 0; tick < 3000 && game.scene === "money-bin"; tick++) {
    if (tick === 168 && !dropFire) {
      game.input({ type: "fire" });
      consumed++;
    }
    const bin = game.bin;
    if (bin.current.source === "08cd" && bin.remaining === 1) {
      const checkpoint = fixture.checkpoints[executed];
      assert.ok(checkpoint, "unexpected successful checkpoint");
      const bytes = Buffer.from(checkpoint.reads[0].data, "base64");
      assert.equal(bytes.length, 20);
      const local = Buffer.from(checkpoint.reads[1].data, "base64");
      assert.equal(
        local.readUInt16LE(6),
        executed,
        "successful checkpoint out of order",
      );
      const original = {
        asset: 7,
        frame: bytes[18],
        x: bytes.readInt16LE(0),
        y: bytes.readInt16LE(2),
      };
      if (alterResult && executed === 3) original.frame ^= 1;
      assert.deepEqual(
        bin.current.sprites[0],
        original,
        `original success divergence at ${executed}`,
      );
      executed++;
    }
    game.advanceTick();
    game.advanceRetrace();
  }
  assert.equal(consumed, 1, "required successful fire not consumed");
  assert.equal(executed, 14, "successful checkpoints missing");
  assert.equal(game.scene, "office", "successful route unfinished");
  const expectedCash = Buffer.from(
    fixture.cash.reads[0].data,
    "base64",
  ).readUInt32LE(0);
  assert.equal(game.money, expectedCash, "cash differs from original");
  assert.equal(game.money, 1000);
  assert.equal(game.rareCoinTaken, true);
  return executed + 2;
}

export async function verify() {
  let total = 0;
  for (const file of [
    "reference/money-bin-failed.json",
    "reference/money-bin-win.json",
  ]) {
    const manifest = JSON.parse(await readFile(file, "utf8"));
    const artifacts = new Map();
    for (const [name, artifact] of Object.entries(manifest.artifacts)) {
      const bytes = await readFile(artifact.path).catch(() => {
        throw Error(
          `SETUP: missing local original artifact ${artifact.path}; see docs/original-scenario.md`,
        );
      });
      assert.equal(
        hash(bytes),
        artifact.sha256,
        `corrupt original artifact ${name}`,
      );
      artifacts.set(name, bytes);
    }
    const compare = file.includes("failed")
      ? compareFailedDive
      : compareSuccessfulDive;
    const fixture = JSON.parse(artifacts.get("trace"));
    const count = compare(fixture);
    assert.equal(
      count,
      manifest.expectedCheckpointCount,
      "unexpected checkpoint count",
    );
    assert.throws(
      () => compare(fixture, { dropFire: true }),
      /required.*fire/,
      "negative control failed: omitted input accepted",
    );
    assert.throws(
      () => compare(fixture, { alterResult: true }),
      /divergence/,
      "negative control failed: altered output accepted",
    );
    total += count;
  }
  assert.equal(total, 30, "zero or incomplete original cases");
  console.log(
    `Original segments: ${total} exact checkpoints in 2 cases; all 4 negative controls rejected.`,
  );
}
if (process.argv[1]?.endsWith("verify-reference.js")) await verify();
