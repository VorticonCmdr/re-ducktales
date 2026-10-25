// All offsets and dimensions are validated before touching compressed data.
export function decompressLzw(bytes, expectedSize) {
  if (!Number.isInteger(expectedSize) || expectedSize < 0 || expectedSize > 16_777_216) throw Error('Invalid decoded size');
  const output = new Uint8Array(expectedSize);
  let table, size, previous, bits = 0, available = 0, position = 0, written = 0;
  const reset = () => { table = Array.from({ length: 258 }, (_, i) => i < 256 ? Uint8Array.of(i) : null); size = 9; previous = null; };
  reset();
  while (true) {
    while (available < size && position < bytes.length) { bits |= bytes[position++] << available; available += 8; }
    if (available < size) throw Error('Truncated LZW stream');
    const code = bits & ((1 << size) - 1); bits >>>= size; available -= size;
    if (code === 256) { reset(); continue; }
    if (code === 257) {
      if (written !== expectedSize) throw Error(`Decoded size ${written}, expected ${expectedSize}`);
      return output;
    }
    let value = table[code];
    if (code === table.length && previous) { value = new Uint8Array(previous.length + 1); value.set(previous); value[value.length - 1] = previous[0]; }
    if (!value || written + value.length > output.length) throw Error('Invalid LZW code or output overflow');
    output.set(value, written); written += value.length;
    if (previous && table.length < 4096) {
      const next = new Uint8Array(previous.length + 1); next.set(previous); next[next.length - 1] = value[0]; table.push(next);
      if (table.length === 1 << size && size < 12) size++;
    }
    previous = value;
  }
}

export function parseArchive(bytes, name = '') {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 2) throw Error('Truncated archive');
  const count = view.getUint16(0, true), directoryEnd = 2 + count * 4;
  if (!count || directoryEnd > bytes.length) throw Error('Invalid archive directory');
  const entries = [];
  for (let index = 0; index < count; index++) {
    const offset = view.getUint32(2 + index * 4, true);
    const end = index + 1 < count ? view.getUint32(6 + index * 4, true) : bytes.length;
    if (offset < directoryEnd || offset + 16 > end || end > bytes.length) throw Error(`Invalid resource ${index} bounds`);
    const packedSize = view.getUint32(offset, true), type = view.getUint16(offset + 4, true);
    const width = view.getUint16(offset + 6, true), height = view.getUint16(offset + 8, true);
    const words = [10, 12, 14].map(n => view.getUint16(offset + n, true));
    if (![1, 2, 4].includes(type) || offset + 16 + packedSize !== end) throw Error(`Invalid resource ${index} header`);
    const frames = type === 2 ? words[0] : 1;
    const expectedSize = type === 4 ? width : width * height * frames / 2;
    if (type !== 4 && (!width || width % 2 || !height || !frames)) throw Error('Invalid image dimensions');
    const data = decompressLzw(bytes.subarray(offset + 16, end), expectedSize);
    const font = type === 4 && data.length === 2056 && data[0] === 0xaa && data[1] === 0x55;
    const text = type === 4 && !font && data.every(c => [9, 10, 13, 26].includes(c) || c >= 32 && c < 127);
    entries.push({ name: `${name} #${String(index).padStart(3, '0')}`, archive: name, index, offset, packedSize, type, width, height, frames, words, data, kind: font ? 'Font' : text ? 'Text / data' : type === 1 ? 'Picture' : type === 2 ? 'Sprite' : 'Driver' });
  }
  return entries;
}

export const EGA = ['000000','0000aa','00aa00','00aaaa','aa0000','aa00aa','aa5500','aaaaaa','555555','5555ff','55ff55','55ffff','ff5555','ff55ff','ffff55','ffffff'].map(hex => [0,2,4].map(i => parseInt(hex.slice(i,i+2),16)));
export function imagePixels(entry, frame = 0, transparent = -1) {
  if (frame < 0 || frame >= entry.frames) throw Error('Frame out of range');
  const rgba = new Uint8ClampedArray(entry.width * entry.height * 4), start = frame * entry.width * entry.height / 2;
  for (let i = 0; i < entry.width * entry.height; i++) {
    const row = Math.floor(i / entry.width), column = i % entry.width;
    const address = entry.type === 2 ? row * entry.width * entry.frames / 2 + frame * entry.width / 2 + (column >> 1) : start + (i >> 1);
    const byte = entry.data[address], color = i % 2 ? byte & 15 : byte >> 4;
    rgba.set([...EGA[color], color === transparent ? 0 : 255], i * 4);
  }
  return rgba;
}
export function fontPixels(data) {
  const rgba = new Uint8ClampedArray(128 * 128 * 4);
  for (let glyph = 0; glyph < 256; glyph++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const p = ((glyph >> 4) * 8 * 128 + y * 128 + (glyph & 15) * 8 + x) * 4;
    const on = data[8 + glyph * 8 + y] & (128 >> x);
    rgba.set(on ? [245, 213, 128, 255] : [16, 20, 28, 255], p);
  }
  return rgba;
}
