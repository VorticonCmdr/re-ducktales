// Independent provider regressions,not original waveform/runtime goldens.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TandyPlayback } from "../src/tandy-preview.js";
export function runLiveCase(bytes, c, sampleRate) {
  const p = new TandyPlayback(bytes, {
    sampleRate,
    auditionAlignment: true,
    trace: true,
  });
  const pcmHash = createHash("sha256"),
    checkpoints = [];
  let event = 0,
    ended = false;
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const checkpoint = (kind) =>
    checkpoints.push({
      kind,
      frame: p.frame,
      ticks: p.ticks,
      interrupts: p.interrupts,
      clock: p.clock,
      bios: p.bios,
      acknowledgements: p.acks,
      chains: p.chains,
      busWrites: p.bus.length,
      signalSamples: p.signalSamples,
      driverSHA256: sha(p.driver.memory.subarray(0, 12339)),
      chipSHA256: sha(JSON.stringify(p.chip.digitalState())),
      pcmSHA256: pcmHash.copy().digest("hex"),
    });
  while (p.frame < c.maxFrames) {
    while (event < c.events.length && c.events[event].frame === p.frame) {
      const input = c.events[event++];
      p.start(input.argument);
      checkpoint(`input-${event}`);
    }
    const next = event < c.events.length ? c.events[event].frame : c.maxFrames;
    assert.ok(next > p.frame, "unfinished or unordered input schedule");
    const n = Math.min(4096, next - p.frame, c.maxFrames - p.frame);
    const result = p.renderFrames(n, { haltWhenIdle: true });
    pcmHash.update(
      new Uint8Array(
        result.pcm.buffer,
        result.pcm.byteOffset,
        result.pcm.byteLength,
      ),
    );
    if (result.ended) {
      ended = true;
      checkpoint("ended");
      break;
    }
  }
  assert.equal(ended, true, "unfinished live sequence");
  assert.equal(event, c.events.length, "unconsumed required input events");
  if (c.ending === "requested-stop") {
    assert.equal(c.events.at(-1).argument, 0);
    assert.equal(p.frame, c.events.at(-1).frame, "premature ending");
  } else {
    assert.equal(c.ending, "natural");
    assert.equal(c.events.length, 1);
    assert.ok(p.frame > sampleRate * 40, "premature music ending");
  }
  assert.equal(p.acks + p.chains, p.interrupts, "unconsumed interrupt effects");
  assert.equal(p.driver.active, false);
  assert.ok(p.chip.volumes.every((v) => v === 15));
  assert.equal(p.biosFlags.length, p.ticks);
  assert.ok(p.signalSamples > 0, "silent live route");
  return { sound: c.sound, ending: c.ending, events: event, checkpoints };
}
