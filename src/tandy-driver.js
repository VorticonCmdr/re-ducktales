// IT.DRV resource004. These translated entry points retain the original driver
// layout so conditional original-function comparisons can check every byte.
// Sequencing rejects commands and device paths that have not been translated.
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
    // The original table has181 records. Standalone starts above127 remain
    // outside this translated entry boundary; opcode82 uses startSequence.
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
    this.startSequence(id);
  }
  startSequence(id) {
    // 0b4c..0ba8 starts an ordinary record, including records0 and8. Unlike
    // the far API, it does not interpret those IDs as reset/engine requests.
    if (!Number.isInteger(id) || id < 0 || id >= 181)
      throw Error(`Unsupported Tandy sequence record ${id}`);
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
  readAddress(at) {
    const low = this.readSequence(at);
    return low | (this.readSequence(at) << 8);
  }
  processControl(at, ch, op) {
    if (op === 0x80) this.byte(at + 0x11, this.readSequence(at));
    else if (op === 0x81) {
      this.byte(at + 0x11, this.byte(at + 0x11) - 1);
      if (this.byte(at + 0x11)) this.word(at, this.readAddress(at));
      else this.word(at, this.word(at) + 2); // No argument read on this path.
    } else if (op === 0x82) this.startSequence(this.readSequence(at));
    else if (op === 0x84) this.word(at, this.readAddress(at));
    else if (op === 0x85) {
      const depth = this.byte(at + 0x12);
      // The original shifts BL, so its index wraps at128. Keep its memory
      // aliasing for overflow rather than substituting an unbounded JS stack.
      this.word(at + 0x13 + ((depth << 1) & 255), this.word(at) + 2);
      this.byte(at + 0x12, depth + 1);
      this.word(at, this.readAddress(at));
    } else if (op === 0x86) {
      this.byte(at + 0x12, this.byte(at + 0x12) - 1);
      this.word(at, this.word(at + 0x13 + ((this.byte(at + 0x12) << 1) & 255)));
    } else if (op === 0x87) this.byte(at + 6, this.readSequence(at));
    else if (op === 0x83) this.byte(at + 0x2a, this.readSequence(at));
    else if (op === 0x8c) this.byte(at + 0x1b, this.readSequence(at));
    else if (op === 0x8d || op === 0x8e)
      this.word(at + (op === 0x8d ? 0x30 : 0x32), 0xf04);
    else if (op === 0x93) {
      const high = this.readSequence(at);
      this.word(at + 0x2c, (high << 8) | this.readSequence(at));
    } else if (op === 0x98) {
      const speed = (this.word(0x2e6) >>> 8) & 127;
      const period = this.word(0x2a + speed * 2);
      this.word(0x2e4, period);
      this.word(0x2e2, period);
    } else if (op === 0x8a) {
      // 0d31..0d60 deliberately overshoots at equality and wraps as a word.
      // Both OUT DX,AL instructions address tone0,regardless of channel.
      const current = this.word(0x2e2),
        target = this.word(0x2e4);
      const next =
        (current + (current > target ? -1 : 1) * this.byte(0x2e8)) & 65535;
      this.word(0x2e2, next);
      this.writePort(0xc0, 0x80 | (next & 15));
      this.writePort(0xc0, (next >>> 4) & 127);
    } else if (op === 0xa1) {
      const high = this.readSequence(at);
      this.word(0x2e4, (high << 8) | this.readSequence(at));
    } else if (op === 0x99) {
      if (!this.byte(0x1c5)) {
        this.stopChannel(at, ch);
        return "stop";
      }
    } else if (op === 0x9a) this.byte(at + 7, this.readSequence(at));
    else if (op === 0x9b) this.byte(0x2ea, this.readSequence(at));
    else if (op === 0x9f) {
      this.byte(0x1c9, this.readSequence(at));
      if (this.byte(0x1c9)) {
        this.writePort(0xc0, 0xd0 + (this.byte(0x2cf) >>> 4));
        this.writePort(0xc0, 0xf0 + (this.byte(0x2d0) >>> 4));
      }
    } else if (op === 0x95) {
      this.byte(at + 0x26, this.readSequence(at));
      this.byte(at + 0x22, this.readSequence(at));
      const span = this.readSequence(at);
      this.byte(at + 0x24, span);
      this.byte(at + 0x23, span >>> 1);
      this.byte(at + 0x25, this.readSequence(at));
      this.word(at + 0x32, 0xf05);
    } else if (op === 0x90) {
      // 0c43..0c6a zero-extends the operand, including on the noise channel.
      const period = this.readSequence(at);
      this.word(at + 8, period);
      this.word(0x2b9 + ch * 2, period);
    } else if (op === 0x97 || op === 0xa9)
      this.byte(at + 0x2e, this.readSequence(at)); // Shared handler0aab.
    else if (op === 0xaa)
      return true; // 0b18: no operand, just dispatch again.
    else return false;
    return true;
  }
  selectEnvelopeStage(at) {
    let index = this.byte(at + 12),
      pointer = this.word(at + 13);
    const delta = this.byte(pointer + index);
    if (delta !== 0) {
      this.byte(at + 10, delta < 128 ? 2 : 3);
      this.byte(at + 15, delta);
      index = (index + 1) & 255; // INC BL, not INC BX, in the ramp branch.
      this.byte(at + 11, this.byte(pointer + index));
      this.byte(at + 12, index + 1);
      return;
    }
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
    } else if (mode === 2) {
      const sum = this.byte(at + 16) + this.byte(at + 15);
      if (sum > 255 || sum >= this.byte(at + 11)) {
        this.byte(at + 16, this.byte(at + 11));
        this.selectEnvelopeStage(at);
      } else this.byte(at + 16, sum);
    } else if (mode === 3) {
      const next = this.byte(at + 16) - (-this.byte(at + 15) & 255);
      if (next < 0 || next <= this.byte(at + 11)) {
        if (this.byte(at + 11) === 0) {
          this.byte(at + 16, 0);
          this.byte(at + 10, 0);
        } else {
          // 09e4..09ed writes the target back to DI+0b, not the level
          // at DI+10. Preserve this original nonzero-target quirk.
          this.selectEnvelopeStage(at);
        }
      } else this.byte(at + 16, next);
    } else if (mode === 4) {
      this.byte(at + 11, this.byte(at + 11) - 1);
      if (this.byte(at + 11) === 0) {
        this.byte(at + 12, this.byte(at + 12) + 1);
        this.selectEnvelopeStage(at);
      }
    } else if (mode === 5) {
      this.word(at + 13, this.word(at + 0x34));
      this.byte(at + 12, 0);
      this.selectEnvelopeStage(at);
    } else if (mode !== 0)
      throw Error(`Unsupported Tandy envelope mode ${mode}`);
  }
  processEnvelope(at) {
    // 0910..0941 computes the saturated attenuation after the stage handler,
    // including a handler that has just changed the envelope mode to zero.
    if (this.byte(at + 10) === 0) return;
    this.advanceEnvelope(at);
    this.byte(
      0x2c1 + this.byte(0x1b3),
      Math.min(255, (this.byte(at + 16) ^ 255) + this.byte(at + 0x29)),
    );
  }
  processModulation(at, ch, offset) {
    const handler = this.word(at + offset);
    if (handler === 0xf04) return;
    if (handler === 0xf05) return this.processVibrato(at, ch);
    if (handler !== 0xf3f)
      throw Error(
        `Unsupported Tandy modulation handler ${handler.toString(16)}`,
      );
    // 0f3f..0f5a: a byte accumulator gates a wrapping word addition. The
    // sequence's word is a delta, not a target frequency or a clamped slide.
    const sum = this.byte(at + 0x1d) + this.byte(at + 0x1c);
    this.byte(at + 0x1d, sum);
    if (sum > 255) {
      const period = this.word(at + 8) + this.word(at + 0x1e);
      this.word(at + 8, period);
      this.word(0x2b9 + ch * 2, period);
    }
  }
  processVibrato(at, ch) {
    if (this.byte(at + 0x28)) {
      this.byte(at + 0x28, this.byte(at + 0x28) - 1);
      return;
    }
    const sum = this.byte(at + 0x27) + this.byte(at + 0x26);
    this.byte(at + 0x27, sum);
    if (sum <= 255) return;
    this.byte(at + 0x23, this.byte(at + 0x23) - 1);
    if (this.byte(at + 0x23) === 0) {
      this.word(at + 0x20, -this.word(at + 0x20));
      this.byte(at + 0x23, this.byte(at + 0x24));
    }
    const period = this.word(at + 8) + this.word(at + 0x20);
    this.word(at + 8, period);
    this.word(0x2b9 + ch * 2, period);
    return;
  }
  processPitch(at, ch, note) {
    // 0ea0..0f03 returns immediately for noise. Normal noise notes still
    // initialize their envelope/duration in the caller at084d..086e.
    if (ch === 3) return;
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
  }
  processLegato(at, ch) {
    // 0bfb..0c29 changes pitch/duration without restarting the envelope.
    this.processPitch(at, ch, this.readSequence(at));
    this.byte(at + 2, this.readSequence(at));
  }
  processNote(at, ch, note) {
    this.processPitch(at, ch, note);
    this.word(at + 13, this.word(at + 0x36));
    this.byte(at + 10, 1);
    this.byte(at + 12, 0);
    this.byte(at + 2, this.readSequence(at));
  }
  stopChannel(at, ch) {
    if (ch === 0) this.byte(0x1c9, 0);
    this.byte(0x2c1 + ch, 255);
    this.resetChannel(at);
    this.byte(0x2cd + ch, 255);
    this.writePort(0xc0, 0x9f + ch * 32);
  }
  processFastModulation() {
    // 02f5..0328,before the sequencer divider. XOR's sign selects the mute.
    if (!this.byte(0x1c9)) return;
    this.byte(0x1c7, this.byte(0x1c7) - 1);
    if (this.byte(0x1c7)) return;
    this.byte(0x1c7, this.byte(0x1c6));
    this.byte(0x1c8, this.byte(0x1c8) ^ 255);
    this.writePort(
      0xc0,
      this.byte(0x1c8) & 128 ? 0x9f : 0x90 + (this.byte(0x2cd) >>> 4),
    );
  }
  processInterrupt({ clearBiosFlags, incrementClock, chainInterrupt } = {}) {
    if (
      typeof clearBiosFlags !== "function" ||
      typeof incrementClock !== "function" ||
      typeof chainInterrupt !== "function"
    )
      throw Error(
        "Tandy interrupt requires BIOS,clock and chained-interrupt providers",
      );
    this.processFastModulation();
    let sequenced = false;
    this.byte(0x1ca, this.byte(0x1ca) - 1);
    if (!this.byte(0x1ca)) {
      this.byte(0x1ca, 12);
      incrementClock({ offset: this.word(0x1ba), segment: this.word(0x1bc) });
      this.processTick({ clearBiosFlags });
      sequenced = true;
    }
    this.byte(0x2dd, this.byte(0x2dd) - 1);
    if (!this.byte(0x2dd)) {
      this.byte(0x2dd, 48);
      chainInterrupt({ offset: this.word(0x2de), segment: this.word(0x2e0) });
    } else this.writePort(0x20, 0x20);
    return sequenced;
  }
  processTick({ clearBiosFlags } = {}) {
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
            const control = this.processControl(at, ch, op);
            if (control === "stop") {
              waited = skip = true;
              break;
            }
            if (control) continue;
            if (op === 0x91) {
              this.byte(at + 0x1c, this.readSequence(at));
              const high = this.readSequence(at);
              this.word(at + 0x1e, (high << 8) | this.readSequence(at));
              this.word(at + 0x30, 0xf3f);
            } else if (op === 0x8f) {
              const index = (this.readSequence(at) << 1) & 255;
              this.word(at + 0x36, this.word(0x1385 + index));
              this.word(at + 0x34, this.word(0x1387 + index));
              this.byte(at + 10, 1);
            } else if (op === 0x9e) this.byte(at + 0x29, this.readSequence(at));
            else if (op === 0x9d || op === 0x8b) {
              this.processLegato(at, ch);
              // Original jumps to0906, skipping this channel's modulation,
              // envelope advancement and OUTs for the current tick.
              waited = skip = true;
            } else if (op === 0x89 || op === 0xa0) {
              this.byte(at + 2, this.readSequence(at));
              if (op === 0x89) this.byte(at + 10, 5);
              waited = skip = true;
            } else if (
              [
                0x88, 0x92, 0x94, 0x96, 0x9c, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6,
                0xa7, 0xa8,
              ].includes(op)
            ) {
              this.stopChannel(at, ch);
              waited = skip = true;
            } else throw Error(`Unsupported Tandy command ${op.toString(16)}`);
          }
        }
      }
      if (skip) continue;
      for (const offset of [0x30, 0x32]) this.processModulation(at, ch, offset);
      this.processEnvelope(at);
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
  get marker() {
    // Far0686: AL=CS:[02ea], AH=0. This is not playback status.
    return this.byte(0x2ea);
  }
  get playbackStatus() {
    // Far06c8: first nonzero sequence pointer wins, returning4..1, else0.
    // Duration bytes may be zero while a channel still owns a sequence.
    for (let ch = 0; ch < 4; ch++)
      if (this.word(this.word(0x2b1 + ch * 2)) !== 0) return 4 - ch;
    return 0;
  }
  pollWait() {
    // One observation of far068d's wait condition. The original spins while
    // IRQs change these pointers. The caller supplies advancement separately;
    // querying never injects ticks, clears channels or advances host time.
    return this.playbackStatus === 0;
  }
  get active() {
    return this.playbackStatus !== 0;
  }
}
