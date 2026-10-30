import {
  egaSpriteWork,
  egaCopyWork,
  normalCoreGraphicsMilliseconds,
} from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

// Original overlay6:20b8 restores one complete room buffer and emits five or
// six sprites. Supply ONLY that call's newly emitted commands: nested cached
// room reconstruction is a renderer concern, not another original drawing call.
export function cavePartyWork(entries, commands) {
  const work = {
    ...egaCopyWork({
      width: 320,
      height: 200,
      sourceX: 0,
      sourceY: 0,
      destinationX: 0,
      destinationY: 0,
      sourceStrideBytes: 40,
      destinationStrideBytes: 40,
      sourceVideo: false,
      destinationVideo: true,
    }),
    sprites: 0,
    copies: 1,
    omittedFills: 0,
  };
  for (const command of commands) {
    if (command.op === "sprite") {
      const cost = egaSpriteWork(
        entries[command.asset],
        command.frame,
        command.x,
        command.y,
      );
      work.instructions += cost.instructions;
      work.portWrites += cost.portWrites;
      work.sprites++;
    } else if (
      command.op === "fill" &&
      [
        command.x,
        command.y,
        command.width,
        command.height,
        command.color,
      ].every(Number.isInteger) &&
      command.width > 0 &&
      command.height > 0 &&
      command.color >= 0 &&
      command.color < 16
    ) {
      work.omittedFills++;
    } else throw Error(`Unsupported cave party work operation ${command.op}`);
  }
  if (work.sprites < 5 || work.sprites > 6)
    throw Error("Incomplete cave party source drawing calls");
  return {
    ...work,
    milliseconds: normalCoreGraphicsMilliseconds(
      work,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
  };
}

// One explicit source CALL through the original sprite primitive (1ff0).
export function caveSpriteWork(entries, command) {
  const work = egaSpriteWork(
    entries[command.asset],
    command.frame,
    command.x,
    command.y,
  );
  return {
    ...work,
    sprites: 1,
    copies: 0,
    omittedFills: 0,
    milliseconds: normalCoreGraphicsMilliseconds(
      work,
      ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
    ),
  };
}
