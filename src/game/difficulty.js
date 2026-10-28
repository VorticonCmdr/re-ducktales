import { executableText } from "./executable.js";

// Resident12f5:0aeb. The caller owns the seven-count input wait, sound-enable
// gate, BIOS reseed on confirmation and graphics cleanup. No clock/RNG here.
export function difficultyInput(selection, byte) {
  if (
    !Number.isInteger(selection) ||
    selection < 0 ||
    selection > 2 ||
    !Number.isInteger(byte) ||
    byte < 0 ||
    byte > 255
  )
    throw Error("Invalid difficulty input");
  // Fire precedes directional movement, including a simultaneous Fire+Up.
  if (byte & 0xc0) return { selection, action: "confirm", sound: 36 };
  if (byte & 0x20) return { selection, action: "quit", sound: null, code: 37 };
  const direction = byte & 0x3f;
  if (direction === 1)
    return { selection: (selection + 2) % 3, action: "select", sound: 36 };
  if (direction === 5)
    return { selection: (selection + 1) % 3, action: "select", sound: 36 };
  return { selection, action: "stay", sound: null };
}

// Pure selected-menu presentation. Initial load/flip and clock boundaries are
// deliberately outside this renderer. Text stays authoritative in the EXE.
export function difficultyCommands(image, selection) {
  if (!Number.isInteger(selection) || selection < 0 || selection > 2)
    throw Error("Invalid difficulty selection");
  const strings = [
    [0x675, 0x681, 0x690],
    [0x6cd, 0x6d8, 0x6e8],
    [0x6a1, 0x6ac, 0x6bb],
  ][selection];
  return [
    {
      op: "copy",
      asset: 32,
      x: 0,
      y: 0,
      sourceX: 0,
      sourceY: 0,
      width: 320,
      height: 200,
    },
    {
      op: "text",
      text: executableText(image, 0x662),
      x: 168,
      y: 60,
      color: 15,
    },
    ...strings.map((at, row) => ({
      op: "text",
      text: executableText(image, at),
      x: selection === row ? 168 : 176,
      y: 80 + row * 20,
      color: selection === row ? 12 : 15,
    })),
  ];
}

// Initial page12f5:0b31..0ba1. Unlike later selected pages, the first Easy
// label has no prefix and remains at x176. The EGA interleaved reveal and
// post-reveal keyboard flush belong to the caller, not this raster helper.
export function difficultyInitialCommands(image) {
  const commands = difficultyCommands(image, 0);
  commands[1] = { ...commands[1], text: executableText(image, 0x624) };
  for (const [row, at] of [0x637, 0x642, 0x651].entries())
    commands[row + 2] = {
      ...commands[row + 2],
      text: executableText(image, at),
      x: 176,
    };
  return commands;
}
