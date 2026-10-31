import { SpeakerGameStream } from "./speaker-game.js";
class SpeakerGameProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.stream = new SpeakerGameStream(
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
        else throw Error("Unsupported speaker processor input");
        this.report();
      } catch (error) {
        this.fail(error);
      }
    };
  }
  report() {
    for (const event of this.stream.drainEvents()) this.port.postMessage(event);
  }
  fail(error) {
    this.failed = true;
    this.port.postMessage({ type: "error", message: error.message });
  }
  process(_inputs, outputs) {
    if (this.failed) return false;
    try {
      const output = outputs[0][0];
      output.set(this.stream.renderFrames(output.length));
      this.report();
      if (this.stream.frame >= this.nextReport) {
        this.port.postMessage({ type: "stats", ...this.stream.stats() });
        this.nextReport = this.stream.frame + 4096;
      }
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }
}
registerProcessor("ducktales-speaker-game", SpeakerGameProcessor);
