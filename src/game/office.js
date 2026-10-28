import { executableText } from "./executable.js";

// Overlay2:03c7..0468. The current poll determines the selection; neutral
// input clears it. Fire without a direction does not reuse an earlier choice.
export function officeInput(byte) {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255)
    throw Error("Invalid office input byte");
  const direction = byte & 63;
  const selection =
    { 1: "money-bin", 3: "map", 7: "investments" }[direction] ?? null;
  return { selection, action: byte & 192 ? selection : null };
}

const sprite = (asset, frame, x, y) => ({ op: "sprite", asset, frame, x, y });
// Overlay2:0000..0129. Background and sprite order are original. MAIN5 is
// at33 here; the opening story uses32 in a separate resident routine.
export function officeCommands({
  roofFrame = 0,
  scroogeFrame = 0,
  pendulumFrame = 0,
  doorFrame = 0,
  leftFrame = 0,
  hideLeft = false,
  pendulumOnTop = false,
} = {}) {
  if (
    ![roofFrame, scroogeFrame, pendulumFrame, doorFrame, leftFrame].every(
      Number.isInteger,
    )
  )
    throw Error("Invalid office frame");
  if (
    roofFrame < 0 ||
    roofFrame > 3 ||
    scroogeFrame < 0 ||
    scroogeFrame > 3 ||
    pendulumFrame < 0 ||
    pendulumFrame > 2 ||
    doorFrame < 0 ||
    doorFrame > 1 ||
    leftFrame < 0 ||
    leftFrame > 3 ||
    typeof hideLeft !== "boolean" ||
    typeof pendulumOnTop !== "boolean"
  )
    throw Error("Unsupported office frame");
  return [
    {
      op: "copy",
      asset: 3,
      x: 0,
      y: 0,
      sourceX: 0,
      sourceY: 0,
      width: 320,
      height: 200,
    },
    sprite(8, scroogeFrame, 216, 32),
    sprite(4, roofFrame, 120, 8),
    ...(!hideLeft ? [sprite(5, leftFrame, 33, 48)] : []),
    ...(roofFrame === 0
      ? pendulumOnTop
        ? [sprite(7, doorFrame, 120, 48), sprite(6, pendulumFrame, 136, 32)]
        : [sprite(6, pendulumFrame, 136, 32), sprite(7, doorFrame, 120, 48)]
      : []),
  ];
}

// Overlay2 uses the opaque two-colour text callback200c for these labels.
// Each eight-pixel row has black background and white foreground (word0f00).
export function officeSelectionCommands(image, byte) {
  const selection = officeInput(byte).selection;
  if (selection === null) return officeCommands();
  const [at, x, y] = {
    "money-bin": [0xcf8, 120, 16],
    map: [0xd02, 200, 32],
    investments: [0xd11, 14, 32],
  }[selection];
  const text = executableText(image, at);
  return [
    ...officeCommands(),
    { op: "fill", x, y, width: text.length * 8, height: 8, color: 0 },
    { op: "text", text, x, y, color: 15 },
  ];
}

// Overlay2:0182..02e3, entered by the Up+Fire branch. Driver-count waits
// start AFTER the page flip; each flip independently waits for a retrace.
// No RNG is consumed by this path. Sound calls are gated by the caller.
export function* officeMoneyBinFrames() {
  yield { source: 0x0199, commands: officeCommands(), counts: 0, sound: null };
  for (let counter = 15; counter >= 3; counter--)
    yield {
      source: 0x01e5,
      commands: officeCommands({
        pendulumFrame: counter % 3,
        pendulumOnTop: true,
      }),
      counts: 7,
      sound: counter === 15 ? 4 : null,
    };
  yield {
    source: 0x0238,
    commands: officeCommands({ doorFrame: 1 }),
    counts: 7,
    sound: 35,
  };
  yield {
    source: 0x028e,
    commands: officeCommands({ doorFrame: 1 }),
    counts: 73,
    sound: 34,
  };
  for (let roofFrame = 1; roofFrame <= 3; roofFrame++)
    yield {
      source: 0x02bc,
      commands: officeCommands({ roofFrame }),
      counts: 28,
      sound: null,
    };
}

// Uninterruptible overlay2:0182 money-bin departure. The caller owns the
// pre-entry sound reset, archive lifetime and subsequent overlay dispatch.
export class OfficeMoneyBin {
  constructor({ audioEnabled = false } = {}) {
    if (typeof audioEnabled !== "boolean")
      throw Error("Invalid office sound flag");
    this.audioEnabled = audioEnabled;
    this.tick = 0;
    this.retrace = 0;
    this.presentations = 0;
    this.events = [];
    this.frame = officeCommands();
    this.pending = null;
    this.outcome = null;
    this.iterator = this.run();
    this.resume();
  }
  *run() {
    for (const step of officeMoneyBinFrames()) {
      if (step.sound !== null && this.audioEnabled)
        this.events.push({ type: "sound", id: step.sound });
      this.pending = step.commands;
      this.source = step.source;
      yield { clock: "retrace", remaining: 1 };
      if (step.counts) yield { clock: "driver", remaining: step.counts };
    }
    this.outcome = { code: 38, action: "money-bin" };
  }
  resume() {
    const next = this.iterator.next();
    this.wait = next.done ? null : next.value;
  }
  advance(clock) {
    if (clock === "driver") this.tick++;
    else if (clock === "retrace") this.retrace++;
    else throw Error("Invalid office clock");
    if (!this.wait || this.wait.clock !== clock) return;
    if (--this.wait.remaining) return;
    if (clock === "retrace") {
      this.frame = this.pending;
      this.pending = null;
      this.presentations++;
    }
    this.resume();
  }
  advanceTick() {
    this.advance("driver");
  }
  advanceRetrace() {
    this.advance("retrace");
  }
}
