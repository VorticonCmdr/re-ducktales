// Shared ordinary-key boundary for the browser and independent DOM replays.
// This normalizes external input only; the simulation owns consumption/flags.
const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
const officeCodes = Object.freeze({
  KeyI: 0x17,
  KeyJ: 0x24,
  KeyK: 0x25,
  KeyM: 0x32,
  Numpad7: 0x47,
  Numpad8: 0x48,
  Numpad9: 0x49,
  Numpad4: 0x4b,
  Numpad5: 0x4c,
  Numpad6: 0x4d,
  Numpad1: 0x4f,
  Numpad2: 0x50,
  Numpad3: 0x51,
  NumpadEnter: 0x1c,
  Enter: 0x1c,
  Space: 0x39,
  ArrowUp: 0x48,
  ArrowLeft: 0x4b,
  ArrowRight: 0x4d,
  ArrowDown: 0x50,
});

export function ordinaryScanCodeForKey(key) {
  return Object.hasOwn(officeCodes, key) ? officeCodes[key] : undefined;
}
export function mapKeyEvent(key, pressed) {
  const scanCode = ordinaryScanCodeForKey(key);
  if (scanCode === undefined || typeof pressed !== "boolean")
    throw Error(`Unsupported map key ${key}`);
  return { type: "map-key", scanCode, pressed };
}

export function heldControlEvent(held, office = false) {
  if (typeof office !== "boolean") throw Error("Invalid office input context");
  return {
    type: "controls",
    fire: held.has("Space") || held.has("Enter") || held.has("NumpadEnter"),
    direction:
      arrows
        .filter((k) => held.has(k))
        .at(-1)
        ?.slice(5)
        .toLowerCase() ?? null,
    ...(office
      ? {
          officeKeys: [...held]
            .map((k) => officeCodes[k])
            .filter((k) => k !== undefined),
        }
      : {}),
  };
}

export function ordinaryMakeEvent(key, held, office = false) {
  if (typeof office !== "boolean" || !Object.hasOwn(officeCodes, key))
    throw Error(`Unsupported ordinary key ${key}`);
  const physical = office ? { physicalKey: true } : {};
  if (office && !["Space", "Enter", ...arrows].includes(key))
    return { type: "ordinary-key", physicalKey: true };
  if (key === "Space" || key === "Enter")
    return {
      type: "fire",
      ...physical,
      direction: held.has("ArrowUp")
        ? "up"
        : held.has("ArrowLeft")
          ? "left"
          : held.has("ArrowRight")
            ? "right"
            : null,
    };
  return { type: key.slice(5).toLowerCase(), ...physical };
}

export function expeditionKeyEvent(key, pressed) {
  return { ...mapKeyEvent(key, pressed), type: "expedition-key" };
}
