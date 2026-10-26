import { nextRandom } from "./integer.js";

// Overlay 4, 2da8..2f4a and 3498..36c8. Resource loading and obstacle placement
// follow this routine; neither is inferred from the generated terrain.
export function generateFlightTerrain(days, seed) {
  if (!Number.isInteger(days) || days < 1 || days > 3)
    throw Error(`Unsupported flight duration ${days}`);
  const tiles = new Int16Array(130);
  let draws = 0,
    progress = 0;
  const random = () => {
    draws++;
    return (seed = nextRandom(seed));
  };
  const quarter = Math.trunc((days * 42) / 4);
  const initialRoll = random() % 100;
  let theme =
    initialRoll < 8 ? 7 : initialRoll < 14 ? 3 : initialRoll < 18 ? 1 : 20;
  function section(kind) {
    let at = progress;
    progress += quarter;
    if (at === 0) at = 2;
    for (; at < progress; at++) {
      const previous = tiles[at - 1];
      if (kind === 21) {
        tiles[at] = previous === 12 || previous === 14 ? 12 : 14;
        continue;
      }
      if (previous === 12) {
        tiles[at] = 13;
        continue;
      }
      const roll = random() % 100;
      const continuation = { 1: 2, 3: 4, 5: 6, 7: 11, 11: 8, 9: 10 }[previous];
      if (continuation !== undefined) tiles[at] = continuation;
      else if (kind === 7 && at < progress - 2 && random() % 100 < 95)
        tiles[at] = 7;
      else if (kind === 3 && at < progress - 2 && random() % 100 < 75)
        tiles[at] = 3;
      else if (kind === 1 && at < progress - 2 && random() % 100 < 75)
        tiles[at] = 1;
      else if (roll < 80 && at < progress - 2 && kind === 20)
        tiles[at] = [1, 3, 5, 7, 9][random() % 5];
    }
  }
  section(theme);
  const arrangement = random() % 100;
  if (arrangement < 33) {
    if ((random() & 1) === 1) {
      section(21);
      section(theme);
    } else {
      section(theme);
      section(21);
    }
    if (theme !== 20) {
      const roll = random() % 100;
      theme = roll < 10 ? 7 : roll < 20 ? 3 : roll < 30 ? 1 : 20;
    }
    section(theme);
  } else if (arrangement <= 65) {
    section(21);
    section(21);
    section(theme);
  } else
    for (let part = 0; part < 3; part++) {
      let current = theme;
      if (theme !== 20 && part === 1) {
        const roll = random() % 100;
        // Original 31f8 compares the existing theme, not the new random roll.
        current = roll < 10 ? 7 : theme < 20 ? 3 : theme < 30 ? 1 : 20;
      }
      section(current);
    }
  tiles[0] = 15;
  tiles[1] = 16;
  tiles[days * 42 - 1] = 15;
  tiles[days * 42] = 16;
  return { tiles, seed, draws };
}
