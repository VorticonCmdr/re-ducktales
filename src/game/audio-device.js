// Browser effects adapter. Only actual processor acknowledgements/completions
// satisfy waits. Loading retains ordered requests; failures stop the game.
export class GameAudioDevice {
  constructor(
    bytes,
    {
      status,
      stats,
      fail,
      observe = () => {},
      workletURL,
      processorName,
      label,
    },
  ) {
    this.workletURL = workletURL;
    this.processorName = processorName;
    this.label = label;
    this.bytes = bytes;
    this.onStatus = status;
    this.onStats = stats;
    this.onFailure = fail;
    this.observe = observe;
    this.sequence = 0;
    this.acknowledged = 0;
    this.pending = [];
    this.tokens = new Map();
    this.inflight = new Map();
    this.disposed = false;
    this.suspended = false;
    this.onStats({ contextState: "uninitialized", sequence: 0 });
  }
  unlock() {
    if (this.disposed) return;
    if (!this.context) {
      this.context = new AudioContext();
      const context = this.context;
      context.onstatechange = () => {
        if (!this.disposed) this.onStats({ contextState: context.state });
      };
      this.ready = context.audioWorklet
        .addModule(this.workletURL)
        .then(() => {
          if (this.disposed) return;
          this.node = new AudioWorkletNode(context, this.processorName, {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            processorOptions: { bytes: Array.from(this.bytes) },
          });
          this.node.onprocessorerror = () =>
            this.failure(Error(`${this.label} game processor failed`));
          this.node.port.onmessage = ({ data }) => this.message(data);
          this.gain = context.createGain();
          this.gain.gain.value = 0.5;
          this.node.connect(this.gain).connect(context.destination);
          for (const request of this.pending)
            this.node.port.postMessage(request);
          this.pending = [];
        })
        .catch((error) => this.failure(error));
    }
    if (!this.suspended)
      this.context.resume().catch((error) => this.failure(error));
  }
  request(argument, token = null) {
    if (this.disposed) throw Error(`${this.label} device is closed`);
    if (this.closingSequence !== undefined)
      throw Error(`${this.label} device is finishing its reset`);
    if (!Number.isInteger(argument) || argument < 0 || argument > 65535)
      throw Error(`${this.label} game request must be a word`);
    if (token !== null && (typeof token !== "string" || !token.length))
      throw Error(`Invalid ${this.label} game token`);
    if (token !== null && this.tokens.has(token))
      throw Error(`Duplicate ${this.label} game token`);
    const request = {
      type: "request",
      sequence: ++this.sequence,
      argument,
      token,
    };
    this.onStats({ requests: this.sequence });
    this.inflight.set(request.sequence, request);
    if (token !== null) this.tokens.set(token, request.sequence);
    this.unlock();
    if (this.node) this.node.port.postMessage(request);
    else this.pending.push(request);
  }
  message(event) {
    if (this.disposed) return;
    try {
      if (event.type === "error") throw Error(event.message);
      if (event.type === "stats") {
        if (event.acknowledgements + event.chains !== event.interrupts)
          throw Error(`Unconsumed ${this.label} interrupt effects`);
        this.onStats(event);
        this.maybeClose(event);
        return;
      }
      if (!["ack", "complete"].includes(event.type))
        throw Error(`Unsupported ${this.label} game response`);
      if (
        !Number.isSafeInteger(event.frame) ||
        event.frame < 0 ||
        !Number.isInteger(event.playbackStatus) ||
        event.playbackStatus < 0 ||
        event.playbackStatus > 4 ||
        event.busy !== (event.playbackStatus !== 0) ||
        !Number.isInteger(event.marker) ||
        event.marker < 0 ||
        event.marker > 255
      )
        throw Error(`Invalid ${this.label} game status`);
      if (event.type === "ack") {
        if (
          event.sequence !== ++this.acknowledged ||
          event.sequence > this.sequence
        )
          throw Error(`Unordered ${this.label} game acknowledgement`);
        const request = this.inflight.get(event.sequence);
        if (
          !request ||
          request.argument !== event.argument ||
          request.token !== event.token
        )
          throw Error(`Changed ${this.label} game acknowledgement`);
        this.inflight.delete(event.sequence);
      } else if (event.busy || event.token === null) {
        throw Error(`Invalid ${this.label} completion response`);
      }
      if (event.token !== null) {
        if (this.tokens.get(event.token) !== event.sequence)
          throw Error(`Unexpected ${this.label} completion token`);
        if (typeof event.busy !== "boolean")
          throw Error(`Invalid ${this.label} busy result`);
        this.onStatus(event.token, event.busy);
        if (!event.busy) this.tokens.delete(event.token);
      }
      this.observe(event);
      this.onStats({
        lastArgument: event.argument,
        lastAcknowledged: this.acknowledged,
        playbackStatus: event.playbackStatus,
        marker: event.marker,
        pendingTokens: this.tokens.size,
      });
      this.maybeClose(event);
    } catch (error) {
      this.failure(error);
    }
  }
  maybeClose(event) {
    if (
      this.closingSequence === undefined ||
      this.acknowledged < this.closingSequence ||
      event.busy
    )
      return;
    if (this.tokens.size || this.inflight.size) return;
    this.close().then(this.resolveClosing, this.rejectClosing);
  }
  setSuspended(value) {
    this.suspended = value;
    if (!this.context || this.disposed) return;
    (value ? this.context.suspend() : this.context.resume()).catch((error) =>
      this.failure(error),
    );
  }
  failure(error) {
    if (this.disposed) return;
    this.rejectClosing?.(error);
    this.close();
    this.onFailure(Error(`${this.label} game audio: ${error.message}`));
  }
  close() {
    if (this.disposed) return this.closed ?? Promise.resolve();
    this.disposed = true;
    this.pending = [];
    this.tokens.clear();
    this.inflight.clear();
    this.node?.disconnect();
    this.gain?.disconnect();
    this.node?.port.close();
    this.closed =
      this.context && this.context.state !== "closed"
        ? this.context
            .close()
            .then(() => this.onStats({ contextState: "closed" }))
        : Promise.resolve();
    this.closed.catch((error) => this.onFailure(error));
    return this.closed;
  }
  stopAndClose() {
    if (this.disposed) return this.close();
    if (this.closing) return this.closing;
    this.request(0);
    this.closingSequence = this.sequence;
    this.closing = new Promise((resolve, reject) => {
      this.resolveClosing = resolve;
      this.rejectClosing = reject;
    });
    return this.closing;
  }
}
