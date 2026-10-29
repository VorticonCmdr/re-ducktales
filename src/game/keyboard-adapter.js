// Shared ordinary-key boundary for the browser and independent DOM replays.
// This normalizes external input only; the simulation owns consumption/flags.
const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
const officeCodes = Object.freeze({
  Enter: 0x1c,
  Space: 0x39,
  ArrowUp: 0x48,
  ArrowLeft: 0x4b,
  ArrowRight: 0x4d,
  ArrowDown: 0x50,
});

export function heldControlEvent(held, office = false) {
  if (typeof office !== "boolean") throw Error("Invalid office input context");
  return {
    type: "controls",
    fire: held.has("Space") || held.has("Enter"),
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
