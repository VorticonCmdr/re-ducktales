import { nextRandom } from "./integer.js";
import { executableText } from "./executable.js";
import { officeCommands } from "./office.js";

// Overlay2:07ad..0a42. Internal RNG is carried; no observed final value or
// host randomness supplies a subsequent draw. Duplicate letters redraw.
export function securitySetup(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 65535)
    throw Error("Invalid security RNG seed");
  const draws = [];
  const random = (source, slot) => {
    const before = seed;
    seed = nextRandom(seed);
    draws.push({ source, slot, before, after: seed });
    return seed;
  };
  const quad = (source) => {
    const result = [];
    while (result.length < 4) {
      const letter = random(source, result.length) % 26;
      if (!result.includes(letter)) result.push(letter);
    }
    return String.fromCharCode(...result.map((n) => n + 65));
  };
  const target = quad(0x08e7);
  const targetRow = random(0x08fd, 4) % 10;
  const choices = Array.from({ length: 10 }, (_, row) =>
    row === targetRow ? target : quad(0x09a5),
  );
  return { seed, target, targetRow, choices, draws };
}

// Whole-byte direction comparisons precede Fire. Thus Fire+Right confirms
// the existing row. Up/Down crossing an end clamps to9/0 rather than modulo10.
export function securityInput(selection, failures, targetRow, byte) {
  if (
    ![selection, failures, targetRow, byte].every(Number.isInteger) ||
    selection < 0 ||
    selection > 9 ||
    failures < 0 ||
    failures > 2 ||
    targetRow < 0 ||
    targetRow > 9 ||
    byte < 0 ||
    byte > 255
  )
    throw Error("Invalid security input");
  if (byte === 3) selection++;
  else if (byte === 7) selection--;
  else if (byte === 5) selection += 2;
  else if (byte === 1) selection -= 2;
  if (selection > 9) selection = 0;
  if (selection < 0) selection = 9;
  let action = "stay";
  if (byte & 192) {
    if (selection === targetRow || failures === 2) action = "accept";
    else if (failures === 0) {
      failures = 1;
      action = "warning";
    } else {
      failures = 2;
      action = "alarm";
    }
  }
  return { selection, failures, action, redraw: byte !== 0 };
}

const sprite = (asset, x, y) => ({ op: "sprite", asset, frame: 0, x, y });
// Office02e4's Right+Fire exit, before the first map/security call.
export function controlCenterDepartureCommands() {
  return [
    ...officeCommands(),
    sprite(17, 264, 0),
    sprite(18, 208, 0),
    sprite(8, 216, 32),
  ];
}

export function securityCommands(
  image,
  setup,
  { selection = 0, warning = false, alarm = null, day = 1, money = 0 } = {},
) {
  securityInput(selection, 0, setup.targetRow, 0);
  if (
    !Array.isArray(setup.choices) ||
    setup.choices.length !== 10 ||
    !setup.choices.every((s) => /^[A-Z]{4}$/.test(s)) ||
    !/^[A-Z]{4}$/.test(setup.target) ||
    typeof warning !== "boolean" ||
    ![null, true, false].includes(alarm) ||
    !Number.isInteger(day) ||
    day < 0 ||
    day > 255 ||
    !Number.isInteger(money) ||
    money < -2147483648 ||
    money > 2147483647
  )
    throw Error("Invalid security presentation");
  const text = (at, x, y, color) => ({
    op: "text",
    text: executableText(image, at),
    x,
    y,
    color,
  });
  const signedDay = (day << 24) >> 24;
  const commands = [
    {
      op: "copy",
      asset: 20,
      x: 0,
      y: 0,
      sourceX: 0,
      sourceY: 0,
      width: 320,
      height: 200,
    },
    text(0xdf8, 100, 6, 15),
    sprite(25, 8, 175),
    sprite(23, 40, 172),
    // Overlay2:0ea2..0ec3 passes the signed32 purse to the decimal helper.
    {
      op: "text",
      text: String(money),
      x: 176 - String(money).length * 8,
      y: 175,
      color: 15,
    },
    {
      op: "text",
      text: String(signedDay),
      x: signedDay < 10 ? 18 : 14,
      y: 182,
      color: 1,
    },
    text(0xd1d, 64, 24, 2),
    text(0xd36, 40, 32, 12),
    text(0xd56, 80, 40, 2),
    text(0xd6c, 72, 48, 2),
    text(0xd82, 64, 56, 2),
    ...Array.from(setup.target, (c, i) => ({
      op: "copy",
      asset: 40,
      x: 144 + i * 8,
      y: 72,
      sourceX: (c.charCodeAt(0) - 65) * 8,
      sourceY: 0,
      width: 8,
      height: 8,
    })),
    ...setup.choices.map((s, row) => ({
      op: "text",
      text: s,
      x: row % 2 ? 168 : 120,
      y: 88 + 8 * Math.floor(row / 2),
      color: 15,
    })),
  ];
  const x = selection % 2 ? 168 : 120,
    y = 88 + 8 * Math.floor(selection / 2);
  for (const [x1, y1, x2, y2] of [
    [x - 1, y, x - 1, y + 7],
    [x + 32, y, x + 32, y + 7],
    [x - 1, y - 1, x + 32, y - 1],
    [x - 1, y + 7, x + 32, y + 7],
  ])
    commands.push({ op: "line", x: x1, y: y1, x2, y2, color: 12 });
  if (warning) {
    const label = executableText(image, 0xd9c);
    commands.push(
      {
        op: "fill",
        x: 48,
        y: 144,
        width: label.length * 8,
        height: 8,
        color: 14,
      },
      text(0xd9c, 48, 144, 0),
    );
  }
  if (alarm !== null) {
    commands.push({
      op: "fill",
      x: 48,
      y: 144,
      width: 224,
      height: 8,
      color: 0,
    });
    if (alarm)
      commands.push(
        { op: "fill", x: 96, y: 144, width: 128, height: 8, color: 4 },
        text(0xdd6, 96, 144, 15),
      );
  }
  return commands;
}
