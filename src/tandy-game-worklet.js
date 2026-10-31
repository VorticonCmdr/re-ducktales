import { TandyGameStream } from "./tandy-game.js";

class TandyGameProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.stream = new TandyGameStream(
      Uint8Array.from(options.processorOptions.bytes),
      { sampleRate },
    );
    this.nextReport = 0;
    this.port.onmessage = ({ data }) => {
      try {
        if (data.type === "request") this.stream.request(data);
        else if (data.type === "request-batch")
          this.stream.requestBatch(data.requests);
        else if (data.type === "query") this.stream.query(data);
        else throw Error("Unsupported Tandy game input");
        this.reportEvents();
      } catch (error) {
        this.fail(error);
      }
    };
  }
  fail(error) {
    this.failed = true;
    this.port.postMessage({ type: "error", message: error.message });
  }
  reportEvents() {
    for (const event of this.stream.drainEvents()) this.port.postMessage(event);
  }
  process(_inputs, outputs) {
    if (this.failed) return false;
    try {
      const output = outputs[0][0];
      output.set(this.stream.renderFrames(output.length));
      this.reportEvents();
      if (this.stream.playback.frame >= this.nextReport) {
        this.port.postMessage({ type: "stats", ...this.stream.stats() });
        this.nextReport = this.stream.playback.frame + 4096;
      }
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }
}
registerProcessor("ducktales-tandy-game", TandyGameProcessor);
