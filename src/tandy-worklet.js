import { TandyPlayback } from "./tandy-preview.js";

class TandyProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { bytes, sound } = options.processorOptions;
    this.playback = new TandyPlayback(Uint8Array.from(bytes), {
      sampleRate,
      auditionAlignment: true,
    });
    this.playback.start(sound);
    this.stopRequested = false;
    this.started = false;
    this.nextReport = 0;
    this.port.onmessage = (event) => {
      if (event.data.type !== "stop")
        return this.fail("Unsupported Tandy audio input");
      try {
        this.playback.start(0);
        this.stopRequested = true;
      } catch (error) {
        this.fail(error.message);
      }
    };
  }
  fail(message) {
    this.failed = true;
    this.port.postMessage({ type: "error", message });
  }
  process(_inputs, outputs) {
    if (this.failed) return false;
    try {
      const output = outputs[0][0];
      const { pcm, ended } = this.playback.renderFrames(output.length, {
        haltWhenIdle: true,
      });
      output.fill(0);
      output.set(pcm);
      const p = this.playback;
      if (ended || !this.started || p.frame >= this.nextReport) {
        this.port.postMessage({
          type: ended ? (this.stopRequested ? "stopped" : "ended") : "playing",
          frames: p.frame,
          interrupts: p.interrupts,
          ticks: p.ticks,
          signalSamples: p.signalSamples,
          acknowledgements: p.acks,
          chains: p.chains,
          sampleRate,
        });
        this.nextReport = p.frame + 4096;
        this.started = true;
      }
      return !ended;
    } catch (error) {
      this.fail(error.message);
      return false;
    }
  }
}
registerProcessor("ducktales-tandy", TandyProcessor);
