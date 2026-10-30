// Original11c4:0227 numeric formatter and its divisor10 helper paths only.
// Healthy original stack (DS=SS),transparent EGA text. No DOM,clock or RNG.
import { egaTransparentTextWork } from "./ega-text-work.js";
const IPS = {
  stack: [7838, 7839, 7840, 7842, 7844, 7846, 7850, 7852, 7854, 7855, 7856],
  divide: [
    18584, 18585, 18587, 18588, 18589, 18590, 18592, 18595, 18597, 18599, 18600,
    18603, 18605, 18607, 18610, 18613, 18616, 18619, 18621, 18623, 18624, 18627,
    18629, 18631, 18634, 18637, 18640, 18642, 18644, 18647, 18650, 18652, 18654,
    18656, 18659, 18661, 18663, 18665, 18667, 18670, 18673, 18676, 18678, 18680,
    18682, 18684, 18686, 18688, 18690, 18692, 18695, 18696, 18699, 18701, 18703,
    18705, 18708, 18710, 18712, 18715, 18717, 18718, 18720, 18721, 18722, 18724,
    18726, 18728, 18731, 18732, 18733, 18734, 18736, 18737,
  ],
  remainder: [
    18792, 18793, 18795, 18796, 18797, 18799, 18802, 18804, 18806, 18807, 18810,
    18812, 18814, 18817, 18820, 18823, 18826, 18828, 18830, 18833, 18835, 18837,
    18840, 18843, 18846, 18848, 18850, 18853, 18856, 18858, 18860, 18863, 18865,
    18867, 18869, 18870, 18872, 18874, 18876, 18879, 18882, 18885, 18887, 18889,
    18891, 18893, 18895, 18897, 18899, 18901, 18904, 18905, 18908, 18910, 18912,
    18915, 18917, 18919, 18922, 18924, 18927, 18930, 18933, 18936, 18937, 18939,
    18941, 18943, 18946, 18947, 18948, 18950, 18951,
  ],
  assign: [
    18978, 18979, 18981, 18984, 18987, 18990, 18993, 18995, 19000, 19003, 19006,
    19008, 19010, 19011,
  ],
  formatter: [
    551, 552, 554, 557, 562, 563, 567, 572, 575, 576, 577, 578, 581, 584, 589,
    591, 594, 597, 600, 603, 604, 605, 606, 609, 610, 615, 617, 619, 621, 623,
    625, 629, 631, 634, 637, 639, 641, 644, 648, 652, 655, 658, 659, 662, 665,
    668, 669, 670, 674, 675, 677, 678,
  ],
};
const s16 = (v) => (v << 16) >> 16;
function validate({ value, x, rightAlign = false }) {
  if (
    !Number.isInteger(value) ||
    value < -2147483648 ||
    value > 4294967295 ||
    !Number.isInteger(x) ||
    x < -32768 ||
    x > 65535 ||
    typeof rightAlign !== "boolean"
  )
    throw Error("Unsupported original HUD number");
}
export function formatOriginalHudNumber(input) {
  validate(input);
  let value = input.value | 0,
    text = "";
  do {
    text = String.fromCharCode(0x30 + (value % 10)) + text;
    value = Math.trunc(value / 10);
  } while (value > 0);
  return { text, x: s16(input.x - (input.rightAlign ? text.length * 8 : 0)) };
}
export function originalHudNumberWork(input, { instruction = null } = {}) {
  validate(input);
  if (instruction !== null && typeof instruction !== "function")
    throw Error("Invalid HUD work observer");
  if (input.stackAvailable === false)
    throw Error("Unsupported original formatter stack exhaustion");
  let instructions = 0,
    driverInstructions = 0;
  const block = (kind, lo, hi = lo) => {
    const ips = IPS[kind],
      a = ips.indexOf(lo),
      b = ips.indexOf(hi);
    if (a < 0 || b < a) throw Error("Invalid original number source block");
    for (let i = a; i <= b; i++) {
      instructions++;
      instruction?.(kind, ips[i]);
    }
  };
  function remainder(value) {
    block("remainder", 0x4968, 0x4974);
    if (value < 0) block("remainder", 0x4976, 0x4984);
    block("remainder", 0x4987, 0x498c);
    block("remainder", 0x499e, 0x49b6);
    if (value < 0) block("remainder", 0x49fb, 0x49ff);
    else block("remainder", 0x49b8);
    block("remainder", 0x4a02, 0x4a07);
  }
  function divide(value) {
    block("assign", 0x4a22, 0x4a33);
    block("divide", 0x4898, 0x48a5);
    if (value < 0) block("divide", 0x48a7, 0x48b5);
    block("divide", 0x48b8, 0x48bd);
    block("divide", 0x48d0, 0x48e7);
    block("divide", 0x4921, 0x4922);
    if (value < 0) block("divide", 0x4924, 0x4928);
    block("divide", 0x492b, 0x4931);
    block("assign", 0x4a38, 0x4a43);
  }
  block("formatter", 0x227, 0x22d);
  block("stack", 0x1e9e, 0x1eb0);
  block("formatter", 0x232, 0x237);
  let value = input.value | 0;
  for (;;) {
    block("formatter", 0x23c, 0x248);
    remainder(value);
    block("formatter", 0x24d, 0x262);
    divide(value);
    value = Math.trunc(value / 10);
    block("formatter", 0x267, 0x269);
    if (value >= 65536) continue;
    block("formatter", 0x26b);
    if (value < 0) break;
    block("formatter", 0x26d, 0x26f);
    if (value !== 0) continue;
    break;
  }
  block("formatter", 0x271, 0x275);
  if (input.rightAlign) block("formatter", 0x277, 0x281);
  block("formatter", 0x284, 0x29e);
  const formatted = formatOriginalHudNumber(input);
  const driver = egaTransparentTextWork(
    { ...input, ...formatted },
    {
      instruction: (ip) => {
        driverInstructions++;
        instruction?.("driver", ip);
      },
    },
  );
  block("formatter", 0x2a2, 0x2a6);
  return {
    ...formatted,
    instructions: instructions + driver.instructions,
    formatterInstructions: instructions,
    driverInstructions,
    portWrites: driver.portWrites,
  };
}
