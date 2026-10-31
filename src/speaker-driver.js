// IT.DRV resource5: persistent sequence/IRQ state. Device time and port61's
// initial value are external inputs. No host randomness or browser clock.
const U16 = (n) => n & 65535;
const S16 = (n) => (n << 16) >> 16;
export class SpeakerDriver {
  constructor(bytes, { port61 = 0 } = {}) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 7253)
      throw Error("Unsupported PC-speaker driver");
    if (!Number.isInteger(port61) || port61 < 0 || port61 > 255)
      throw Error("Invalid PC-speaker port61 provider");
    this.memory = Uint8Array.from(bytes);
    this.port61 = port61;
    this.events = [];
    this.interrupts = this.ticks = this.chains = this.acknowledgements = 0;
    this.reset();
  }
  b(at, value) {
    if (!Number.isInteger(at) || at < 0 || at >= this.memory.length)
      throw Error("PC-speaker byte address outside driver");
    if (value !== undefined) this.memory[at] = value & 255;
    return this.memory[at];
  }
  w(at, value) {
    if (value !== undefined) {
      this.b(at, value);
      this.b(at + 1, value >>> 8);
    }
    return this.b(at) | (this.b(at + 1) << 8);
  }
  out(port, value) {
    value &= 255;
    if (port === 0x61) this.port61 = value;
    this.events.push({ type: "out", port, value, interrupt: this.interrupts });
  }
  divisor(word) {
    this.out(0x42, word);
    this.out(0x42, word >>> 8);
  }
  reset() {
    //0576: only this interval is cleared;RNG/dividers survive.
    this.memory.fill(0, 0x24c, 0x272);
    this.b(0x269, 0);
    this.b(0x287, 0);
    this.b(0x268, 255);
    this.w(0x270, 0x820);
    this.w(0x272, 0x820);
    this.out(0x61, this.port61 & 252);
  }
  get busy() {
    return this.b(0x269) !== 0;
  }
  get marker() {
    return this.b(0x2a7);
  }
  speed(word, initialize = false) {
    const index = (initialize ? word : word & 0x7fff) >>> 8;
    this.b(0x284, this.b(0x116 + index));
    this.w(0x2a3, this.b(0x199 + index) << 8);
    const target = this.w(0x12 + index * 2);
    this.w(0x27f, target);
    if (initialize) this.w(0x27d, target);
  }
  request(argument) {
    //0408: unsigned word API,signed priority comparison.
    if (!Number.isInteger(argument) || argument < 0 || argument > 65535)
      throw Error("PC-speaker request must be a word");
    const id = argument & 255;
    if (id > 120) return false;
    if (id === 8) {
      if (!this.b(0x287)) return false;
      this.w(0x2a5, argument);
      this.speed(argument);
      return true;
    }
    const address = this.w(0x92b + id * 2),
      priority = this.b(address);
    if ((this.b(0x259) << 24) >> 24 > (priority << 24) >> 24) return false;
    this.reset();
    this.b(0x259, priority);
    this.w(0x24e, address + 1);
    this.b(0x250, 1);
    this.b(0x269, 1);
    return true;
  }
  randomByte() {
    //02c2/02ed: RCL/XOR feedback,then low/mid/high RCR.
    const high = this.b(0x283);
    let carry = ((high >>> 3) ^ (high >>> 7)) & 1;
    for (const at of [0x281, 0x282, 0x283]) {
      const byte = this.b(at);
      this.b(at, (byte >>> 1) | (carry << 7));
      carry = byte & 1;
    }
    return this.b(0x283);
  }
  interrupt() {
    //02a8: the fast hardware IRQ runs even between sequences.
    this.interrupts++;
    if (this.b(0x267) && this.b(0x27c, this.b(0x27c) - 1) === 0) {
      const high = this.randomByte();
      this.b(0x27c, (high & this.b(0x2a1)) + 1);
      const low = this.randomByte();
      this.divisor(U16((((high << 8) | low) & this.w(0x2a3)) + this.w(0x27d)));
      if (this.b(0x287) && this.b(0x285, this.b(0x285) - 1) === 0) {
        this.b(0x286, (this.b(0x286) ^ 255) & 3);
        this.out(0x61, (this.port61 & 252) | this.b(0x286));
        this.b(0x285, this.b(0x284));
      }
    }
    if (this.b(0x291, this.b(0x291) - 1) === 0) {
      this.b(0x291, 12);
      this.ticks = (this.ticks + 1) >>> 0;
      this.tick();
    }
    if (this.b(0x290, this.b(0x290) - 1) === 0) {
      this.b(0x290, 48);
      this.chains++;
      this.events.push({ type: "chain", interrupt: this.interrupts });
    } else {
      this.acknowledgements++;
      this.out(0x20, 0x20);
    }
  }
  modulation(routine) {
    if (routine === 0x820) return;
    if (routine === 0x8ba) {
      this.w(0x254, this.w(0x254) + this.w(0x24c));
      this.divisor(this.w(0x254));
      return;
    }
    if (routine === 0x867) {
      const step = S16(this.w(0x26c));
      if (!step) return;
      const next = U16(this.w(0x27d) + step),
        limit = this.w(0x26e);
      this.w(0x27d, step < 0 ? Math.max(limit, next) : Math.min(limit, next));
      return;
    }
    if (routine === 0x8a0) {
      this.out(0x61, this.port61 | 3);
      if (this.b(0x264, this.b(0x264) - 1) === 0) {
        this.b(0x264, this.b(0x263));
        this.out(0x61, this.port61 & 252);
      }
      return;
    }
    if (routine !== 0x821)
      throw Error("Unsupported speaker modulation routine");
    if (this.b(0x25f)) {
      this.b(0x25f, this.b(0x25f) - 1);
      return;
    }
    const sum = this.b(0x25d) + this.b(0x25e);
    this.b(0x25e, sum);
    if (sum < 256) return;
    if (!this.b(0x25c)) {
      this.b(0x25c, this.b(0x25a));
      this.w(0x260, -this.w(0x260));
    }
    this.b(0x25c, this.b(0x25c) - 1);
    this.w(0x254, this.w(0x254) + this.w(0x260));
    this.divisor(this.w(0x254));
  }
  tick() {
    if (this.b(0x269) !== 1) return;
    this.modulation(this.w(0x270));
    this.modulation(this.w(0x272));
    const tempo = this.b(0x268) + this.b(0x258);
    this.b(0x258, tempo);
    if (tempo < 256) return;
    if (this.b(0x26a) && this.b(0x26b, this.b(0x26b) - 1) === 0)
      this.out(0x61, this.port61 & 252);
    const delay = (this.b(0x250) - 1) & 255;
    if (delay) {
      this.b(0x250, delay);
      return;
    }
    let pc = this.w(0x24e);
    const read = () => this.b(pc++);
    const word = (low) => low | (read() << 8);
    const saveWait = (duration) => {
      this.b(0x250, duration);
      this.w(0x24e, pc);
    };
    for (let burst = 0; burst < 4096; burst++) {
      const op = read();
      // The final resource byte can be a stop. Native LODSW also fetches an
      // unused AH beyond that byte; no driver state consumes that value.
      if (
        op >= 128 &&
        (op > 0xb0 || this.w(0x8cb + (op - 128) * 2) === 0x576)
      ) {
        this.reset();
        return;
      }
      const arg = read();
      if (op < 128) {
        const note = ((((op & 15) + this.b(0x256)) & 255) * 2) & 255;
        const shift = (((op & 240) + this.b(0x257)) & 255) >>> 4;
        const divisor = U16((this.w(0x21c + note) >>> shift) + this.w(0x265));
        this.w(0x254, divisor);
        this.divisor(divisor);
        if (this.b(0x25a)) {
          this.b(0x25f, this.b(0x25b));
          this.b(0x25c, this.b(0x25a) >>> 1);
          this.w(
            0x260,
            ((((divisor & 255) << 8) | (divisor >>> 8)) << this.b(0x262)) & 255,
          );
        }
        //066c/0671 skips the write when gating is disabled. The previous
        // counter survives;it is not reset by an ungated note.
        if (this.b(0x26a)) this.b(0x26b, this.b(0x26a) * (arg >>> 2));
        this.out(0x61, this.port61 | 3);
        saveWait(arg);
        return;
      }
      if (op > 0xb0) {
        this.reset();
        return;
      }
      const handler = this.w(0x8cb + (op - 128) * 2);
      if (handler === 0x576) {
        this.reset();
        return;
      }
      switch (op) {
        case 0x80:
          this.b(0x251, arg);
          break;
        case 0x81: {
          const target = word(arg);
          if (this.b(0x251, this.b(0x251) - 1)) pc = target;
          break;
        }
        case 0x83:
          throw Error("Unsupported native PC-speaker sequence call");
        case 0x84:
          pc = word(arg);
          break;
        case 0x85: {
          const target = word(arg);
          this.w(0x252, pc);
          pc = target;
          break;
        }
        case 0x86:
          pc = this.w(0x252);
          break;
        case 0x87:
          this.b(0x257, arg);
          break;
        case 0x89:
          this.out(0x61, this.port61 & 252);
          saveWait(arg);
          return;
        case 0x8a:
          this.w(
            0x27d,
            this.w(0x27d) +
              (this.w(0x27d) > this.w(0x27f) ? -this.b(0x2a2) : this.b(0x2a2)),
          );
          pc--;
          break;
        case 0x8b:
          this.b(0x26a, arg);
          break;
        case 0x8c:
          this.b(0x256, arg);
          break;
        case 0x8d:
          this.b(0x263, arg);
          this.b(0x264, arg);
          this.w(0x272, 0x8a0);
          break;
        case 0x8e:
          this.w(0x26c, word(arg));
          this.w(0x26e, word(read()));
          this.w(0x270, 0x867);
          break;
        case 0x8f:
          this.w(0x27d, word(arg));
          break;
        case 0x91:
          this.w(0x24c, word(arg));
          this.w(0x270, 0x8ba);
          break;
        case 0x92:
          pc--;
          break;
        case 0x93:
          this.w(0x265, word(arg));
          break;
        case 0x94:
          this.b(0x267, 1);
          this.b(0x2a2, arg);
          this.b(0x2a1, read());
          this.w(0x2a3, word(read()));
          this.out(0x61, this.port61 | 3);
          break;
        case 0x95:
          this.b(0x25d, arg);
          this.b(0x25a, read());
          this.b(0x262, read());
          this.b(0x25b, read());
          this.b(0x25f, this.b(0x25b));
          this.w(0x272, 0x821);
          break;
        case 0x96:
          this.b(0x267, 0);
          this.out(0x61, this.port61 & 252);
          break;
        case 0x97:
          this.w(0x27f, word(arg));
          break;
        case 0x98:
          this.speed(this.w(0x2a5), true);
          pc--;
          break;
        case 0x99:
          pc--;
          if (S16(this.w(0x2a5)) < 0) {
            this.reset();
            return;
          }
          break;
        case 0x9a:
          this.b(0x259, arg);
          break;
        case 0x9b:
          this.b(0x2a7, arg);
          break;
        case 0x9c:
          this.w(0x270, 0x820);
          pc--;
          break;
        case 0x9d:
          this.w(0x272, 0x820);
          pc--;
          break;
        case 0x9e:
          this.b(0x287, arg);
          break;
        case 0xa0:
          saveWait(arg);
          return;
        case 0xa9:
          this.b(0x268, arg);
          break;
        default:
          throw Error(`Unsupported PC-speaker handler ${op.toString(16)}`);
      }
    }
    throw Error("PC-speaker sequence has no wait");
  }
  drainEvents() {
    return this.events.splice(0);
  }
}
