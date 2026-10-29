import { executableText } from "./executable.js";

const sprite = (asset, x, y) => ({ op: "sprite", asset, frame: 0, x, y });
const text = (value, x, y, color = 15) => ({
  op: "text",
  text: value,
  x,
  y,
  color,
});

// Overlay2:1757..1ec7. Immutable commands for a completed destination page.
// Entry page transitions, input polling and driver waits are owned by the caller.
export function destinationCommands({
  image,
  location,
  treasure,
  bank = false,
  collected = false,
  days,
  day,
  money,
  choice,
  atomicAvailable = false,
}) {
  if (
    !location ||
    typeof location.name !== "string" ||
    !Array.isArray(location.description) ||
    location.description.length > 4 ||
    (!bank && (!treasure || !Array.isArray(treasure.description))) ||
    !Number.isInteger(days) ||
    days < 0 ||
    days > 3 ||
    !Number.isInteger(day) ||
    day < 0 ||
    day > 127 ||
    !Number.isInteger(money) ||
    money < 0 ||
    money > 0x7fffffff ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice > (atomicAvailable ? 2 : 1) ||
    typeof bank !== "boolean" ||
    typeof collected !== "boolean" ||
    typeof atomicAvailable !== "boolean"
  )
    throw Error("Unsupported destination presentation inputs");
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
    sprite(25, 8, 175),
    sprite(23, 40, 172),
    sprite(26, 192, 170),
    sprite(27, 248, 174),
    ...(atomicAvailable ? [sprite(29, 281, 170)] : []),
    text(location.name, 160 - location.name.length * 4, 6, 1),
  ];
  let y = 22;
  // The original makes four line-reader calls, including empty fourth lines.
  for (let line = 0; line < 4; line++, y += 8)
    commands.push(text(location.description[line] ?? "", 32, y));
  y -= 8;
  if (!bank) {
    y += 16;
    commands.push(text(executableText(image, 0xe2b), 32, y));
    let x = 112;
    if (treasure.name.length >= 24) {
      x = 32;
      y += 8;
    }
    commands.push(text(treasure.name, x, y));
    y += 16;
    commands.push(text(executableText(image, 0xe36), 32, y));
    for (let line = 0; line < 2; line++) {
      y += 8;
      commands.push(text(treasure.description[line] ?? "", 32, y));
    }
    y += 16;
    commands.push(text(executableText(image, 0xe4d), 32, y));
    commands.push(text(String(collected ? 0 : treasure.value), 160, y));
  }
  y += 16;
  commands.push(text(executableText(image, 0xe5e), 32, y));
  if (days !== 1) commands.push(text(executableText(image, 0xe71), 176, y));
  commands.push(text(String(days), 136, y));
  commands.push(text(String(money), 176 - String(money).length * 8, 175));
  commands.push(text(String(day), day < 10 ? 18 : 14, 182, 1));
  // 16e1 draws inclusive integer EGA lines around the selected sprite. Browser
  // strokeRect has different endpoint/half-pixel behavior and is not used here.
  const [x, top, width, height] = [
    [192, 170, 52, 27],
    [248, 174, 32, 18],
    [281, 170, 37, 27],
  ][choice];
  const left = x - 1,
    right = x + width,
    bottom = top + height;
  for (const [x1, y1, x2, y2] of [
    [left, top - 1, left, bottom],
    [right, top - 1, right, bottom],
    [left, top - 1, right, top - 1],
    [left, bottom, right, bottom],
  ])
    commands.push({ op: "line", x: x1, y: y1, x2, y2, color: 15 });
  return commands;
}
