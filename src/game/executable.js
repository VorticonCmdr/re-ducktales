// Read-only asset access to the EXEPACK image. Mirrors prepare-analysis.py;
// no execution, relocation, or emulation is performed here.
export function unpackImage(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const word = (at) => {
    if (at < 0 || at + 2 > bytes.length) throw Error("Truncated executable");
    return view.getUint16(at, true);
  };
  if (word(0) !== 0x5a4d) throw Error("Expected DOS MZ executable");
  const imageStart = word(8) * 16,
    pack = imageStart + word(22) * 16;
  if (word(pack + 14) !== 0x4252 || word(20) !== 16)
    throw Error("Unsupported EXEPACK header");
  const image = new Uint8Array(word(pack + 12) * 16);
  if (image.length !== 87664) throw Error("Unsupported unpacked image size");
  let source = pack - 1,
    destination = image.length - 1;
  while (bytes[source] === 255) source--;
  while (true) {
    const op = bytes[source],
      count = word(source - 2);
    source -= 3;
    if (!count || count > destination + 1 || source < imageStart)
      throw Error("Invalid EXEPACK output bounds");
    if ((op & 254) === 176) {
      image.fill(bytes[source--], destination - count + 1, destination + 1);
    } else if ((op & 254) === 178) {
      if (source - count + 1 < imageStart)
        throw Error("Invalid EXEPACK input bounds");
      image.set(
        bytes.subarray(source - count + 1, source + 1),
        destination - count + 1,
      );
      source -= count;
    } else throw Error(`Unsupported EXEPACK opcode ${op}`);
    destination -= count;
    if (op & 1) break;
  }
  if (source - imageStart !== destination)
    throw Error("EXEPACK prefix does not align");
  image.set(bytes.subarray(imageStart, source + 1));
  return image;
}
export function executableText(image, offset) {
  const start = 0x120e0 + offset;
  if (!Number.isInteger(offset) || offset < 0 || start >= image.length)
    throw Error("Invalid executable text address");
  const end = image.indexOf(0, start);
  if (end < start || end - start > 512)
    throw Error(`Unterminated executable string ${offset.toString(16)}`);
  const bytes = image.subarray(start, end);
  if (bytes.some((c) => c < 32 || c > 126))
    throw Error(`Non-text executable data ${offset.toString(16)}`);
  return new TextDecoder("ascii").decode(bytes);
}
