// PC-speaker sequence interpreter, reverse-engineered from IT.DRV resource 5.
// This is a bounded audition renderer, not an x86 emulator. Noise is approximate.
export const SOUND_COUNT = 121;
const PIT = 1193182;
const TICK = 1365 * 12 / PIT;
export function soundOffset(driver, id) {
  if (driver.length !== 7253 || id < 0 || id >= SOUND_COUNT) throw Error('Unsupported sound driver / sound ID');
  return driver[0x92b + id * 2] | driver[0x92c + id * 2] << 8;
}
export function renderSound(driver, id, { seconds = 60, sampleRate = 22050 } = {}) {
  seconds = Math.max(1, Math.min(120, seconds));
  const start = soundOffset(driver, id);
  let pc = start + 1, loop = 0, ret = 0, tempo = 255, accumulator = 0, delay = 1;
  let octave = 0, transpose = 0, detune = 0, divisor = 0, enabled = false, stopped = false;
  let slide = 0, noise = false, noiseBase = 0, noiseTarget = 0, noiseStep = 0, noiseLimit = 65535, noiseMask = 0;
  let gate = 0, gateRemaining = 0, vibrato = null, stutter = 0, stutterRemaining = 0;
  let phase = 0, seed = 0x123456, length = 0, approximate = false;
  const pcm = new Float32Array(Math.ceil(seconds * sampleRate));
  const read = () => { if (pc >= driver.length || pc < 0) throw Error('Sound pointer out of bounds'); return driver[pc++]; };
  const word = () => read() | read() << 8;
  const signed = v => v > 32767 ? v - 65536 : v;
  const tableWord = address => { if (address + 1 >= driver.length) throw Error('Sound table out of bounds'); return driver[address] | driver[address + 1] << 8; };
  let ticks = 0;
  while (!stopped && length < pcm.length) {
    ticks++;
    if (slide) divisor = (divisor + slide) & 65535;
    if (noiseStep) noiseBase = noiseStep < 0 ? Math.max(noiseLimit, noiseBase + noiseStep) : Math.min(noiseLimit, noiseBase + noiseStep);
    if (stutter) { enabled = true; if (--stutterRemaining === 0) { stutterRemaining = stutter; enabled = false; } }
    if (vibrato) {
      if (vibrato.wait) vibrato.wait--;
      else {
        vibrato.acc += vibrato.rate;
        if (vibrato.acc > 255) {
          vibrato.acc &= 255;
          if (!vibrato.remaining) { vibrato.remaining = vibrato.span; vibrato.delta = -vibrato.delta; }
          vibrato.remaining--; divisor = (divisor + vibrato.delta) & 65535;
        }
      }
    }
    accumulator += tempo;
    if (accumulator > 255) {
      accumulator &= 255;
      if (gate && --gateRemaining === 0) enabled = false;
      delay = (delay - 1) & 255;
      if (!delay) {
        let burst = 0;
        while (!stopped) {
          if (++burst > 4096) throw Error('Sound command loop has no wait');
          const command = read();
          if (command < 128) {
            delay = read();
            divisor = ((tableWord(0x21c + (((command & 15) + transpose) & 255) * 2) >>> (((command & 240) + octave & 255) >> 4)) + detune) & 65535;
            if (vibrato) {
              vibrato.wait = vibrato.initialWait; vibrato.remaining = vibrato.span >> 1;
              vibrato.delta = (((divisor >>> 8 | divisor << 8) << vibrato.shift) & 255);
            }
            gateRemaining = gate * (delay >> 2) & 255;
            enabled = true;
            break;
          }
          switch (command) {
            case 0x80: loop = read(); break;
            case 0x81: { const target = word(); loop = (loop - 1) & 255; if (loop) pc = target; break; }
            case 0x84: pc = word(); break;
            case 0x85: { const target = word(); ret = pc; pc = target; break; }
            case 0x86: pc = ret; break;
            case 0x87: octave = read(); break;
            case 0x89: delay = read(); enabled = false; break;
            case 0x8a: noiseBase += noiseBase > noiseTarget ? -1 : 1; approximate = true; break;
            case 0x8b: gate = read(); break;
            case 0x8c: transpose = read(); break;
            case 0x8d: stutter = stutterRemaining = read(); vibrato = null; break;
            case 0x8e: noiseStep = signed(word()); noiseLimit = word(); slide = 0; break;
            case 0x8f: noiseBase = word(); break;
            case 0x91: slide = signed(word()); noiseStep = 0; break;
            case 0x92: break;
            case 0x93: detune = word(); break;
            case 0x94: {
              read(); read(); noiseMask = word(); noise = enabled = true; approximate = true; break;
            }
            case 0x95: vibrato = { rate: read(), span: read(), shift: read(), initialWait: read(), acc: 0, delta: 0, remaining: 0, wait: 0 }; stutter = 0; break;
            case 0x96: noise = enabled = false; read(); break;
            case 0x97: noiseTarget = word(); break;
            case 0x98: {
              // ID 8 is a parameterized engine sound. Audition at a fixed midpoint.
              const speed = 64; noiseBase = noiseTarget = tableWord(0x12 + speed * 2); noiseMask = driver[0x199 + speed] << 8; approximate = true; break;
            }
            case 0x99: break;
            case 0x9a: case 0x9b: read(); break; // priority / game synchronization flags
            case 0x9c: slide = noiseStep = 0; break;
            case 0x9d: vibrato = null; stutter = 0; break;
            case 0x9e: read(); approximate = true; break;
            case 0xa0: delay = read(); break;
            case 0xa9: tempo = read(); break;
            case 0x83: throw Error('Native subroutine command cannot be auditioned');
            default: stopped = true; enabled = false;
          }
          if (command === 0x89 || command === 0xa0) break;
        }
      }
    }
    const end = Math.min(pcm.length, Math.round(ticks * TICK * sampleRate));
    while (length < end) {
      let frequency = PIT / (divisor || 65536);
      if (noise) {
        if (length % 25 === 0) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; }
        frequency = PIT / ((noiseBase + ((seed >>> 0) & noiseMask) & 65535) || 65536);
      }
      phase = (phase + Math.min(frequency, sampleRate / 2) / sampleRate) % 1;
      pcm[length++] = enabled ? (phase < 0.5 ? 0.18 : -0.18) : 0;
    }
  }
  // Short edge fades avoid clicks when a looping sequence hits the preview limit.
  for (let i = 0; i < Math.min(100, length); i++) { pcm[i] *= i / 100; pcm[length - 1 - i] *= i / 100; }
  return { pcm: pcm.slice(0, length), sampleRate, duration: length / sampleRate, truncated: !stopped, approximate, start };
}
export function wavFile({ pcm, sampleRate }) {
  const buffer = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(buffer);
  const tag = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  tag(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  tag(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((value, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true));
  return new Uint8Array(buffer);
}
