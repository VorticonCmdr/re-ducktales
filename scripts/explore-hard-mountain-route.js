// Exploratory Hard variant0 route search, not acceptance. Fresh memory is a
// conditional planning input; the resulting controls require browser validation
// with carried campaign memory. Exploratory route search. Each branch replays its entire input prefix from
// the independent initial contract. No game memory or expected state is injected.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Mountain } from "../src/game/mountain.js";
const options = {
  image: unpackImage(readFileSync("game/DUCKTALE.EXE")),
  entries: parseArchive(readFileSync("game/MT.ARC")),
  mainEntries: parseArchive(readFileSync("game/MAIN.ARC")),
  variant: 0,
  difficulty: 2,
  day: 15,
  seed: 21409,
  money: 9450,
};
const macroNames = [
  "left",
  "right",
  "up",
  ...Array.from({ length: 16 }, (_, i) => `hook${i + 10}`),
];
function sample(g, byte, stream) {
  if (g.outcome) return false;
  g.setControls({
    fire: !!(byte & 0xc0),
    direction: { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
  });
  const target = g.inputs.length + 1;
  for (let i = 0; i < 500 && g.inputs.length < target && !g.outcome; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  if (g.inputs.length === target) {
    stream.push(byte);
    return true;
  }
  if (g.outcome) return false;
  throw Error("unfinished sample");
}
function stable(g) {
  const s = g.snapshot();
  return s.action === 0 && [20, 26].includes(s.frame);
}
function replay(prefix, macro) {
  const g = new Mountain(options),
    stream = [];
  for (const byte of prefix) if (!sample(g, byte, stream)) return null;
  if (macro?.startsWith("hook")) {
    const turns = Number(macro.slice(4));
    for (let i = 0; i <= turns; i++) if (!sample(g, 64, stream)) break;
    sample(g, 0, stream);
  } else if (macro) sample(g, { left: 7, right: 3, up: 1 }[macro], stream);
  if (macro) {
    for (let i = 0; i < 180 && !g.outcome; i++) {
      if (stable(g) && i > 0) break;
      sample(g, 0, stream);
    }
  }
  if (g.locals.b(-0x2c))
    for (let i = 0; i < 10 && !g.outcome; i++) {
      g.advanceTick();
      g.advanceRetrace();
    }
  return { g, stream, s: g.snapshot() };
}
const start = replay([], null);
sample(start.g, 0, start.stream);
sample(start.g, 0, start.stream);
start.s = start.g.snapshot();
function key(s) {
  return `${s.row}:${s.column}:${s.facing}:${s.lives}:${s.money}`;
}
function score(n) {
  return n.s.lives * 10000 + n.s.row * 1000 - n.stream.length * 0.2;
}
let queue = [{ stream: start.stream, s: start.s, path: [] }],
  seen = new Map([[key(start.s), start.stream.length]]),
  best = 0,
  evaluations = 0;
while (queue.length && evaluations < 4000) {
  queue.sort((a, b) => score(b) - score(a));
  const node = queue.shift();
  for (const macro of macroNames) {
    const child = replay(node.stream, macro);
    evaluations++;
    if (!child || child.s.lives < 2 || child.stream.length > 1800) continue;
    if (child.g.outcome?.code === 1) {
      const result = {
        initial: {
          variant: 0,
          difficulty: 2,
          day: 15,
          seed: 21409,
          money: 9450,
        },
        inputs: child.stream,
        macros: [...node.path, macro],
        final: child.s,
        evaluations,
      };
      writeFileSync(
        ".local/hard-mountain-ascent-found.json",
        JSON.stringify(result, null, 2) + "\n",
      );
      console.log(
        "WIN",
        JSON.stringify({
          inputs: child.stream.length,
          macros: result.macros,
          final: child.s,
          evaluations,
        }),
      );
      process.exit(0);
    }
    if (child.g.outcome || !stable(child.g)) continue;
    const k = key(child.s);
    if ((seen.get(k) ?? Infinity) <= child.stream.length) continue;
    seen.set(k, child.stream.length);
    queue.push({
      stream: child.stream,
      s: child.s,
      path: [...node.path, macro],
    });
    if (child.s.row > best) {
      best = child.s.row;
      console.log(
        "best",
        best,
        "inputs",
        child.stream.length,
        "path",
        [...node.path, macro].join(","),
      );
    }
  }
  if (evaluations % 190 === 0)
    console.log(
      "explored",
      evaluations,
      "queued",
      queue.length,
      "seen",
      seen.size,
    );
  if (queue.length > 400)
    queue = queue.sort((a, b) => score(b) - score(a)).slice(0, 400);
}
console.log(
  "NO ROUTE",
  JSON.stringify({ evaluations, queued: queue.length, best, seen: seen.size }),
);
process.exitCode = 2;
