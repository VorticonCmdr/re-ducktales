// Original overlay7 helper00b2..0143:four direct EGA line calls and the
// resident0227 signed film formatter. Sprite calls are counted separately.
import { egaDriverLineWork } from "./ega-line-work.js";
import { originalHudNumberWork } from "./hud-number-work.js";

export function photographyHudPrimitiveWork(command, context) {
  if (command.op === "line") {
    const { x, y, x2, y2, color } = command;
    if (color !== 4) throw Error("Unsupported photography HUD line color");
    if (x === 0 && x2 === 319 && (y === 176 || y === 199) && y2 === y)
      return egaDriverLineWork("horizontal", [y, 319, 0]);
    if ((x === 0 || x === 319) && x2 === x && y === 176 && y2 === 199)
      return egaDriverLineWork("vertical", [199, 176, x]);
    throw Error("Unsupported photography HUD line");
  }
  if (command.op === "text") {
    if (
      !context ||
      !Number.isInteger(context.film) ||
      context.film < -128 ||
      context.film > 127
    )
      throw Error("Missing photography signed film input for HUD work");
    const cost = originalHudNumberWork({
      value: context.film,
      x: 300,
      rightAlign: true,
      surfaceOffset: context.surfaceOffset ?? 0,
      backPage: context.backPage ?? false,
    });
    if (
      command.y !== 183 ||
      command.color !== 15 ||
      command.x !== cost.x ||
      command.text !== cost.text
    )
      throw Error("Photography numeric formatter command mismatch");
    return cost;
  }
  throw Error("Unsupported photography HUD operation " + command.op);
}
