// Ordinary-key subset of IRQ9 140e:1aa9,scanner19c5 and reader1124:0002.
// Callers own polling,mode3c1 and flush boundaries. No DOM,time or RNG here.
const aliases = new Map([
  [0x17, 0x48],
  [0x24, 0x4b],
  [0x25, 0x4d],
  [0x32, 0x50],
]);
const directions = new Map([
  [0x47, 8],
  [0x48, 1],
  [0x49, 2],
  [0x4b, 7],
  [0x4c, 0],
  [0x4d, 3],
  [0x4f, 6],
  [0x50, 5],
  [0x51, 4],
]);
const fire = new Set([0x1c, 0x39]);
const ordinaryScanCodes = new Set([
  ...aliases.keys(),
  ...directions.keys(),
  ...fire,
]);
export function isOrdinaryScanCode(scan) {
  return ordinaryScanCodes.has(scan);
}
function table(flags) {
  if (!(flags instanceof Map)) throw Error("Invalid ordinary keyboard table");
}
function scanCode(scan) {
  if (!ordinaryScanCodes.has(scan))
    throw Error(`Unsupported ordinary scan code ${scan}`);
}
export function ordinaryKeyEvent(flags, scan, pressed, modifiers = 0) {
  table(flags);
  scanCode(scan);
  if (
    typeof pressed !== "boolean" ||
    !Number.isInteger(modifiers) ||
    modifiers < 0 ||
    modifiers > 3
  )
    throw Error("Invalid ordinary keyboard IRQ input");
  // A release after a caller/reader flush does not recreate a key slot.
  if (pressed) flags.set(scan, 0x80 | modifiers);
  else if (flags.has(scan)) flags.set(scan, 0x40 | modifiers);
}
export function readOrdinaryKeys(flags, mode) {
  table(flags);
  if (mode !== 0 && mode !== 1)
    throw Error("Unsupported ordinary keyboard mode");
  for (const [scan, flag] of flags) {
    scanCode(scan);
    if (
      !Number.isInteger(flag) ||
      ![0x80, 0x81, 0x82, 0x83, 0x40, 0x41, 0x42, 0x43].includes(flag)
    )
      throw Error("Invalid ordinary keyboard flag");
  }
  let direction = 0,
    buttons = 0;
  // Scan live raw slots in ascending order. Normalization and mode1 clearing
  // happen afterwards;clearing a normalized slot can affect a later raw key.
  for (let scan = 0; scan < 128; scan++) {
    const flag = flags.get(scan);
    if (flag === undefined) continue;
    if (flag & 0x40) flags.delete(scan);
    const key = aliases.get(scan) ?? scan;
    if (fire.has(key)) buttons = 0xc0;
    else direction = directions.get(key);
    if (mode) flags.delete(key);
  }
  return (direction | buttons) & 0xff;
}
export class OrdinaryKeyboard {
  constructor(mode, flags = new Map()) {
    table(flags);
    if (mode !== 0 && mode !== 1)
      throw Error("Unsupported ordinary keyboard mode");
    this.mode = mode;
    this.flags = flags;
  }
  event(scan, pressed, modifiers = 0) {
    ordinaryKeyEvent(this.flags, scan, pressed, modifiers);
  }
  poll() {
    return readOrdinaryKeys(this.flags, this.mode);
  }
  flush() {
    this.flags.clear();
  }
  bytes() {
    const bytes = new Uint8Array(128);
    for (const [scan, flag] of this.flags) bytes[scan] = flag;
    return bytes;
  }
}
