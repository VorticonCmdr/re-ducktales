import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TandyGameStream } from "../src/tandy-game.js";

export function runTandyGameCase(bytes, c, environment, chunk = 256) {
  assert.ok(c.events.length > 0, "zero executed Tandy game inputs");
  assert.ok(Number.isInteger(c.frames) && c.frames > 0);
  const stream = new TandyGameStream(bytes, environment),
    hash = (b) => createHash("sha256").update(b).digest("hex"),
    pcm = createHash("sha256"),
    checkpoints = [],
    events = [];
  let input = 0;
  function capture(kind) {
    checkpoints.push({
      kind,
      ...stream.stats(),
      driverSHA256: hash(stream.playback.driver.memory.subarray(0, 12339)),
      chipSHA256: hash(JSON.stringify(stream.playback.chip.digitalState())),
      pcmSHA256: pcm.copy().digest("hex"),
    });
  }
  while (stream.playback.frame < c.frames) {
    const frame = stream.playback.frame;
    while (input < c.events.length && c.events[input].frame === frame) {
      const e = c.events[input++];
      stream.request({
        sequence: input,
        argument: e.argument,
        token: e.token ?? null,
      });
      events.push(...stream.drainEvents());
      capture(`input-${input}`);
    }
    const next = input < c.events.length ? c.events[input].frame : c.frames;
    assert.ok(next > frame, "unfinished or unordered Tandy game inputs");
    const result = stream.renderFrames(
      Math.min(chunk, next - frame, c.frames - frame),
    );
    pcm.update(
      new Uint8Array(result.buffer, result.byteOffset, result.byteLength),
    );
    events.push(...stream.drainEvents());
  }
  assert.equal(input, c.events.length, "unconsumed Tandy game inputs");
  assert.equal(stream.waiters.size, 0, "unfinished Tandy completion tokens");
  assert.equal(
    stream.playback.driver.pollWait(),
    true,
    "unfinished Tandy game sound",
  );
  assert.ok(
    stream.playback.chip.volumes.every((v) => v === 15),
    "unmuted final device",
  );
  assert.ok(stream.playback.signalSamples > 0, "silent game replay");
  assert.equal(
    stream.playback.acks + stream.playback.chains,
    stream.playback.interrupts,
  );
  assert.deepEqual(
    events.filter((e) => e.type === "ack").map((e) => e.sequence),
    c.events.map((_, i) => i + 1),
  );
  for (const e of c.events.filter((e) => e.token !== undefined)) {
    const acknowledgements = events.filter(
      (x) => x.type === "ack" && x.token === e.token,
    );
    assert.equal(acknowledgements.length, 1);
    const completions = events.filter(
      (x) => x.type === "complete" && x.token === e.token,
    );
    assert.equal(
      completions.length,
      acknowledgements[0].busy ? 1 : 0,
      "unconsumed completion",
    );
  }
  capture("end");
  return { name: c.name, inputs: input, checkpoints, events };
}
