// IT.DRV resource004. These translated entry points retain the original driver
// layout so conditional original-function comparisons can check every byte.
// Sequencing is currently bounded to the source paths exercised by sound036.
export class TandyDriver {
  constructor(bytes, { writePort } = {}) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 12339)
      throw Error("Unsupported Tandy driver resource");
    if (typeof writePort !== "function")
      throw Error("Tandy driver requires a port-write provider");
    this.memory = new Uint8Array(65536);
    this.memory.set(bytes);
    this.view = new DataView(this.memory.buffer);
    this.writePort = writePort;
  }
  byte(at, value) {
    if (value !== undefined) this.view.setUint8(at, value);
    return this.view.getUint8(at);
  }
  word(at, value) {
    if (value !== undefined) this.view.setUint16(at, value, true);
    return this.view.getUint16(at, true);
  }
  resetChannel(at) {
    // 0e7c..0e9f,DI argument; preserves AX in the original.
    this.memory.fill(0, at, at + 0x38);
    this.byte(at + 0x2e, 255);
    this.byte(at + 0x2f, 255);
    this.word(at + 0x30, 0xf04);
    this.word(at + 0x32, 0xf04);
  }
  reset(port61) {
    // 0727..0801. Port61 is an explicit external read,not a fitted value.
    if (!Number.isInteger(port61) || port61 < 0 || port61 > 255)
      throw Error("Tandy reset requires the port61 byte");
    this.writePort(0x61, port61 | 0x60);
    for (const at of [0x1d1, 0x209, 0x241, 0x279]) this.resetChannel(at);
    this.memory.fill(0, 0x2c5, 0x2d1);
    this.memory.fill(0, 0x2b9, 0x2c5);
    for (let ch = 0; ch < 4; ch++) {
      this.byte(0x2c1 + ch, 255);
      this.byte(0x2cd + ch, 255);
      this.writePort(0xc0, 0x9f + ch * 32);
    }
  }
  start(argument, { port61 } = {}) {
    // 0415..0531,16-bit far caller-cleaned stack argument.
    if (!Number.isInteger(argument) || argument < 0 || argument > 65535)
      throw Error("Tandy sound argument must be a word");
    const id = argument & 255;
    // The supplied build's table has128 records. Higher IDs fall outside this
    // translated boundary; do not interpret adjacent bytes as a made-up sound.
    if (id > 127) throw Error(`Unsupported Tandy sound ID ${id}`);
    if (id === 0) {
      this.reset(port61);
      return;
    }
    if (id === 8) {
      this.word(0x2e6, argument);
      const speed = (argument >>> 8) & 127;
      if (!(argument & 0x8000)) this.byte(0x1c5, 1);
      this.byte(0x1c6, this.byte(0x130 + speed));
      this.word(0x2e4, this.word(0x2a + speed * 2));
      if (argument & 0x8000 && this.byte(0x1c5)) {
        for (const ch of [2, 3]) {
          this.byte(0x2c1 + ch, 255);
          this.byte(0x2cd + ch, 255);
          this.writePort(0xc0, 0x9f + ch * 32);
          this.resetChannel(this.word(0x2b1 + ch * 2));
        }
        this.byte(0x1c5, 0);
      }
      return;
    }
    const sequence = this.word(0xfb1 + id * 2),
      channel = this.byte(sequence),
      priority = this.byte(sequence + 1);
    if (channel > 3) throw Error(`Unsupported Tandy sound channel ${channel}`);
    if (channel === 0) this.byte(0x1c9, 0);
    const at = this.word(0x2b1 + channel * 2),
      signed = (v) => (v << 24) >> 24;
    if (signed(priority) < signed(this.byte(at + 7))) return;
    this.byte(0x2c1 + channel, 255);
    this.resetChannel(at);
    this.byte(at + 7, priority);
    this.word(at, sequence + 2);
    this.byte(at + 2, 1);
  }
  readSequence(at) {
    const pc = this.word(at);
    if (pc < 0x111b || pc >= 12339)
      throw Error(`Unsupported Tandy sequence pointer ${pc.toString(16)}`);
    this.word(at, pc + 1);
    return this.byte(pc);
  }
  selectEnvelopeStage(at) {
    let index = this.byte(at + 12),
      pointer = this.word(at + 13);
    const delta = this.byte(pointer + index);
    if (delta !== 0) throw Error(`Unsupported Tandy envelope slope ${delta}`);
    index = (index + 1) & 65535;
    const hold = this.byte(pointer + index);
    if (hold === 0) {
      this.byte(at + 10, 0);
      return;
    }
    this.byte(at + 10, 4);
    this.byte(at + 11, hold);
    this.byte(at + 12, index);
  }
  advanceEnvelope(at) {
    const mode = this.byte(at + 10);
    if (mode === 1) {
      this.byte(at + 16, this.byte(this.word(at + 13) + this.byte(at + 12)));
      this.byte(at + 12, this.byte(at + 12) + 1);
      this.selectEnvelopeStage(at);
    } else if (mode === 4) {
      this.byte(at + 11, this.byte(at + 11) - 1);
      if (this.byte(at + 11) === 0) {
        this.byte(at + 12, this.byte(at + 12) + 1);
        this.selectEnvelopeStage(at);
      }
    } else if (mode !== 0)
      throw Error(`Unsupported Tandy envelope mode ${mode}`);
  }
  processNote(at, ch, note) {
    if (ch === 3) throw Error("Tandy noise sequencing is not implemented");
    let octave = ((note + this.byte(at + 6)) & 255) >>> 4;
    let semitone = ((note & 15) + this.byte(at + 0x1b)) & 255;
    if ((semitone << 24) >> 24 > 11) {
      semitone = (semitone - 12) & 255;
      octave++;
    }
    const period =
      ((this.word(0x12 + ((semitone << 1) & 255)) >>> octave) +
        this.word(at + 0x2c)) &
      65535;
    this.word(at + 8, period);
    this.word(0x2b9 + ch * 2, period);
    this.word(
      at + 0x20,
      Math.max(1, period >>> ((this.byte(at + 0x22) & 7) ^ 6)),
    );
    this.byte(at + 0x28, this.byte(at + 0x25));
    this.word(at + 13, this.word(at + 0x36));
    this.byte(at + 10, 1);
    this.byte(at + 12, 0);
    this.byte(at + 2, this.readSequence(at));
  }
  processTick({ clearBiosFlags } = {}) {
    if (this.byte(0x1c5))
      throw Error("Tandy engine sequencing is not implemented");
    if (typeof clearBiosFlags !== "function")
      throw Error("Tandy tick requires an explicit BIOS-flag effect provider");
    clearBiosFlags(0xf7); // 0040:0018 &=f7; this is not driver/code memory.
    for (let ch = 3; ch >= 0; ch--) {
      this.byte(0x1b3, ch);
      const at = this.word(0x2b1 + ch * 2);
      if (!this.byte(at + 2)) continue;
      const sum = this.byte(at + 0x2f) + this.byte(at + 0x2e);
      this.byte(at + 0x2f, sum);
      let skip = false;
      if (sum > 255) {
        this.byte(at + 2, this.byte(at + 2) - 1);
        if (!this.byte(at + 2)) {
          let waited = false;
          for (let burst = 0; !waited; burst++) {
            if (burst >= 4096) throw Error("Tandy command burst has no wait");
            const op = this.readSequence(at);
            if (op < 128) {
              this.processNote(at, ch, op);
              break;
            }
            if (op === 0x8f) {
              const index = (this.readSequence(at) << 1) & 255;
              this.word(at + 0x36, this.word(0x1385 + index));
              this.word(at + 0x34, this.word(0x1387 + index));
              this.byte(at + 10, 1);
            } else if (op === 0x9e) this.byte(at + 0x29, this.readSequence(at));
            else if (op === 0x89 || op === 0xa0) {
              this.byte(at + 2, this.readSequence(at));
              if (op === 0x89) this.byte(at + 10, 5);
              waited = skip = true;
            } else if (op === 0x88) {
              if (ch === 0) this.byte(0x1c9, 0);
              this.byte(0x2c1 + ch, 255);
              this.resetChannel(at);
              this.byte(0x2cd + ch, 255);
              this.writePort(0xc0, 0x9f + ch * 32);
              waited = skip = true;
            } else throw Error(`Unsupported Tandy command ${op.toString(16)}`);
          }
        }
      }
      if (skip) continue;
      for (const offset of [0x30, 0x32])
        if (this.word(at + offset) !== 0xf04)
          throw Error(
            `Unsupported Tandy modulation handler ${this.word(at + offset).toString(16)}`,
          );
      if (this.byte(at + 10)) {
        this.advanceEnvelope(at);
        this.byte(
          0x2c1 + ch,
          Math.min(255, (this.byte(at + 16) ^ 255) + this.byte(at + 0x29)),
        );
      }
      const volume = this.byte(0x2c1 + ch);
      if (volume !== this.byte(0x2cd + ch)) {
        this.byte(0x2cd + ch, volume);
        this.writePort(0xc0, (volume >>> 4) | (ch * 32 + 0x90));
      }
      const period = this.word(0x2b9 + ch * 2);
      if (period !== this.word(0x2c5 + ch * 2)) {
        this.word(0x2c5 + ch * 2, period);
        this.writePort(0xc0, (ch << 5) | 0x80 | (period & 15));
        if (ch !== 3) this.writePort(0xc0, (period >>> 4) & 127);
      }
    }
    this.byte(0x1b3, 255);
  }
  get active() {
    return [0, 1, 2, 3].some(
      (ch) => this.byte(this.word(0x2b1 + ch * 2) + 2) !== 0,
    );
  }
}
