import {
  egaCopyWork,
  egaSpriteWork,
  normalCoreGraphicsMilliseconds,
} from "./ega-work.js";
import { photographyHudPrimitiveWork } from "./photography-hud-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

// Original overlay7 source calls only. Do not pass the synthetic full-page
// black fill used to reconstruct Canvas pixels. Background copy is RAM -> EGA
// video;HUD line/text calls use their original primitive/formatter paths.
export function photographyWork(entries, commands, context) {
  const work = {
    instructions: 0,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
    sprites: 0,
    copies: 0,
    omittedLines: 0,
    omittedTexts: 0,
    hudInstructions: 0,
    hudPortWrites: 0,
  };
  for (const command of commands) {
    let cost;
    if (command.op === "sprite") {
      cost = egaSpriteWork(
        entries[command.asset],
        command.frame,
        command.x,
        command.y,
      );
      work.sprites++;
    } else if (command.op === "copy") {
      if (
        command.asset !== 0 ||
        command.sourceX !== 0 ||
        command.sourceY !== 0 ||
        command.x !== 0 ||
        command.y !== 0 ||
        command.width !== 320 ||
        command.height !== 176
      )
        throw Error("Unsupported photography source copy");
      cost = egaCopyWork({
        width: 320,
        height: 176,
        sourceX: 0,
        sourceY: 0,
        destinationX: 0,
        destinationY: 0,
        sourceStrideBytes: 40,
        destinationStrideBytes: 40,
        sourceVideo: false,
        destinationVideo: true,
      });
      work.copies++;
    } else if (command.op === "line" || command.op === "text") {
      cost = photographyHudPrimitiveWork(command, context);
      work.hudInstructions += cost.instructions;
      work.hudPortWrites += cost.portWrites;
    } else
      throw Error(`Unsupported photography source operation ${command.op}`);
    for (const key of [
      "instructions",
      "portWrites",
      "repeatOpcodes",
      "repeatIterations",
    ])
      work[key] += cost[key] ?? 0;
  }
  return {
    ...work,
    milliseconds:
      work.instructions === 0
        ? 0
        : normalCoreGraphicsMilliseconds(
            work,
            ORIGINAL_GRAPHICS_TIMING.cyclesPerMillisecond,
          ),
  };
}
