import { JUNGLE_SPRITES } from "./jungle-scene.js";
import { egaSpriteWork, egaCopyWork } from "./ega-work.js";
import { egaLinePrimitiveWork } from "./ega-line-work.js";
import { originalHudNumberWork } from "./hud-number-work.js";

// Observe actual source drawing calls, before a renderer consumes them. This
// does not count Canvas reconstruction, alter commands, or read expected output.
export function jungleWorkEffects(m, resources, sink) {
  const word = (at) => m.view.getUint16(at, true);
  const assets = new Map(
    [...JUNGLE_SPRITES].map(([at, asset]) => [word(at), asset]),
  );
  const video = word(0x2038);
  const surfaces = new Set([video, word(0x203a), word(0x7118)]);
  const work = {
    instructions: 0,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
    sprites: 0,
    copies: 0,
    lines: 0,
    lineInstructions: 0,
    linePortWrites: 0,
    omittedLines: 0,
    texts: 0,
    textInstructions: 0,
    textFormatterInstructions: 0,
    textDriverInstructions: 0,
    textPortWrites: 0,
    omittedTexts: 0,
    rowCrossingCopies: 0,
  };
  function add(cost) {
    for (const key of [
      "instructions",
      "portWrites",
      "repeatOpcodes",
      "repeatIterations",
    ])
      work[key] += cost[key] ?? 0;
  }
  const effects = {
    ...sink,
    draw(resource) {
      const asset = assets.get(resource);
      if (asset === undefined) throw Error("Unsupported jungle work resource");
      add(
        egaSpriteWork(
          resources.entries[asset],
          m.b(resource + 18),
          m.i(resource),
          m.i(resource + 2),
        ),
      );
      work.sprites++;
      sink.draw(resource);
    },
    copy(command) {
      const { from, to, sourceX, sourceY, x, y, width, height } = command;
      if (
        !surfaces.has(from) ||
        !surfaces.has(to) ||
        from === to ||
        ![sourceX, sourceY, x, y, width, height].every(Number.isInteger) ||
        [sourceX, sourceY, x, y].some((v) => v < 0 || v > 32767)
      )
        throw Error("Unsupported jungle work copy");
      const sourceStrideBytes = word(from),
        destinationStrideBytes = word(to);
      // EGA01ef..035c has no X clipping or X-dependent branches: SHR and
      // address arithmetic have the same opcode cost for every X. Its row
      // copies can cross a scanline. Normalize X ONLY for the existing bounded
      // work counter; pass the untouched rectangle to the planar renderer,
      // whose independent validity masks check actual storage reads/writes.
      add(
        egaCopyWork({
          width,
          height,
          sourceX: 0,
          sourceY,
          destinationX: 0,
          destinationY: y,
          sourceStrideBytes,
          destinationStrideBytes,
          sourceVideo: from === video,
          destinationVideo: to === video,
        }),
      );
      work.copies++;
      if (
        sourceX + width > sourceStrideBytes * 8 ||
        x + width > destinationStrideBytes * 8
      )
        work.rowCrossingCopies++;
      sink.copy(command);
    },
    line(command) {
      const cost = egaLinePrimitiveWork(command, m.b(0x2046));
      add(cost);
      work.lines++;
      work.lineInstructions += cost.instructions;
      work.linePortWrites += cost.portWrites;
      sink.line(command);
    },
    text(command) {
      if (
        m.b(0x2046) !== 0 ||
        resources.font?.length !== 2056 ||
        resources.font[2] !== 8 ||
        resources.font[4] !== 8
      )
        throw Error("Unsupported jungle HUD font/scale");
      let input;
      if (command.y === 180 && command.color === 14)
        input = {
          value: m.view.getUint32(0x8cc0, true),
          x: 175,
          rightAlign: true,
        };
      else if (command.y === 185 && command.color === 0) {
        const day = m.signedByte(0x4e0e);
        input = { value: day, x: day < 10 ? 18 : 14 };
      } else throw Error("Unsupported jungle numeric text call");
      const cost = originalHudNumberWork({
        ...input,
        surfaceOffset: word(video + 4),
        backPage: m.b(0x2052) !== 0,
      });
      if (command.text !== cost.text || command.x !== cost.x)
        throw Error("Jungle numeric formatter command mismatch");
      add(cost);
      work.texts++;
      work.textInstructions += cost.instructions;
      work.textFormatterInstructions += cost.formatterInstructions;
      work.textDriverInstructions += cost.driverInstructions;
      work.textPortWrites += cost.portWrites;
      sink.text(command);
    },
  };
  return { effects, work };
}
