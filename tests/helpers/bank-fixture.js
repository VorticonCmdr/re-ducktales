import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseArchive } from "../../src/assets.js";
import { unpackImage } from "../../src/game/executable.js";
import { Scheduler } from "../../src/game/scheduler.js";
import build from "../../reference/build.json" with { type: "json" };
function supported(name) {
  const bytes = readFileSync(`game/${name}`);
  if (
    bytes.length !== build.files[name].bytes ||
    createHash("sha256").update(bytes).digest("hex") !==
      build.files[name].sha256
  )
    throw Error(`SETUP: unsupported bank original ${name}`);
  return bytes;
}
export const bankResources = {
  entries: parseArchive(supported("MAC.ARC")),
  image: unpackImage(supported("DUCKTALE.EXE")),
};
// Conditional environment: hold Fire before the first bank reader and release
// on return. No idle RNG is consumed. Both clocks advance independently from a
// declared phase-zero provider; this does not fit original elapsed CPU time.
export function advanceBankToReturn(game) {
  if (game.scene !== "bank") throw Error("Expected bank entry");
  const clock = new Scheduler(game);
  let clocks = 0;
  while (game.scene === "bank" && clocks++ < 50000)
    clock.advanceTo(Math.min(clock.tickAt, clock.retraceAt));
  if (game.scene === "bank") throw Error("Unfinished bank input sequence");
  return clocks;
}

export function finishBankWithHeldFire(game) {
  game.input({ type: "controls", fire: true, direction: null });
  const clocks = advanceBankToReturn(game);
  game.input({ type: "controls", fire: false, direction: null });
  return clocks;
}
