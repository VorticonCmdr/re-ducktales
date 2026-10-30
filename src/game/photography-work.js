import {
  egaCopyWork,
  egaSpriteWork,
  normalCoreGraphicsMilliseconds,
} from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";

// Original overlay7 source calls only. Do not pass the synthetic full-page
// black fill used to reconstruct Canvas pixels. HUD lines/text are explicit
// omissions, not substitute timing. Background copy is RAM -> EGA video.
export function photographyWork(entries, commands) {
  const work = {
    instructions: 0,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
    sprites: 0,
    copies: 0,
    omittedLines: 0,
    omittedTexts: 0,
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
    } else if (command.op === "line") {
      if (
        ![
          [0, 176, 319, 176],
          [0, 199, 319, 199],
          [0, 176, 0, 199],
          [319, 176, 319, 199],
        ].some(
          ([x, y, x2, y2]) =>
            command.x === x &&
            command.y === y &&
            command.x2 === x2 &&
            command.y2 === y2 &&
            command.color === 4,
        )
      )
        throw Error("Unsupported photography HUD line");
      work.omittedLines++;
      continue;
    } else if (command.op === "text") {
      if (
        !/^-?\d{1,3}$/.test(command.text) ||
        command.y !== 183 ||
        command.x !== 300 - command.text.length * 8 ||
        command.color !== 15
      )
        throw Error("Unsupported photography HUD text");
      work.omittedTexts++;
      continue;
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
