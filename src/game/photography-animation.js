import {
  spawnPhotographyAnimals,
  positionPhotographyAnimal,
  photographyOccluders,
} from "./photography-actors.js";

// Overlay7 body1364..1b03. Draw the old pose, then advance its byte-sized
// state. The paired animals share control flow, but not every draw sequence:
// rare31/32/36..39 intentionally draw the ordinary animal before the rare one.
const descriptors = [
  0x8c98, 0x8b2a, 0x68c4, 0x7964, 0x6d86, 0x68b0, 0x4df4, 0x57c6, 0x78ec,
  0x88e6, 0x57b2, 0x5482, 0x546e, 0x4de0, 0x8b40, 0x8d7e,
];

export function advancePhotographyAnimals(m, effects) {
  if (typeof effects?.draw !== "function")
    throw Error(
      "Photography animal pass requires an explicit drawing provider",
    );
  spawnPhotographyAnimals(m, effects);
  for (let slot = 0; slot < 3; slot++) {
    const record = 0x896c + slot * 12,
      animal = m.i(record + 2);
    if (!m.b(record) || animal < 14 || animal > 45) continue;
    const kind = (animal - 14) % 16;
    const draw = (descriptor) => {
      positionPhotographyAnimal(m, record, descriptor);
      effects.draw(descriptor);
    };
    if (animal < 30) draw(descriptors[kind]);
    else {
      if ([1, 2, 6, 7, 8, 9].includes(kind)) draw(descriptors[kind]);
      draw(0x4da0);
    }
    for (const descriptor of photographyOccluders(m.b(record)))
      effects.draw(descriptor);
    advancePhotographyAnimalPose(m, record);
  }
}

// Original jump tables at1512,1674,171a,17c0,1888,1936,19fc,1a8f.
// Branch names below retain original body offsets for auditing shared tails.
const actions = [
  [0x14ce, 0x14e9, 0x19ed, 0x16ff, 0x16ff],
  [0x19ae, 0x156a, 0x157d, 0x157d, 0x157d],
  [0x15cb, 0x15d9, 0x161b, 0x1647, 0x165e, 0x165e],
  [0x15cb, 0x16cc, 0x16db, 0x16ff, 0x16ff],
  [0x15cb, 0x16cc, 0x16db, 0x16ff, 0x16ff],
  [0x175f, 0x1777, 0x178f, 0x179a, 0x179a],
  [0x182a, 0x1842, 0x1872, 0x16ff, 0x16ff],
  [0x182a, 0x1842, 0x1872, 0x16ff, 0x16ff],
  [0x18f2, 0x190a, 0x19ed, 0x16ff, 0x16ff],
  [0x18f2, 0x190a, 0x19ed, 0x16ff, 0x16ff],
  [0x19ae, 0x19c1, 0x19ed, 0x16ff, 0x16ff],
  [0x19ae, 0x19c1, 0x19ed, 0x16ff, 0x16ff],
  [0x15cb, 0x1a52, 0x1a73, 0x16ff, 0x16ff],
  [0x15cb, 0x1a52, 0x1a73, 0x16ff, 0x16ff],
  [0x19ae, 0x19c1, 0x19ed, 0x16ff, 0x16ff],
  [0x19ae, 0x19c1, 0x19ed, 0x16ff, 0x16ff],
];

export function advancePhotographyAnimalPose(m, at) {
  const animal = m.i(at + 2);
  if (animal < 14 || animal > 45) return;
  const action = actions[(animal - 14) % 16][m.b(at + 4)];
  if (action === undefined) return; // Original switch default leaves pose alone.
  const frame = (v) => m.b(at + 4, v),
    phase = (v) => m.b(at + 5, v),
    counter = (v) => m.b(at + 6, v),
    remove = () => m.b(at, 0),
    p = () => m.b(at + 5),
    late = () => m.b(0x5eec) > 5,
    decrement = () => counter(m.b(at + 6) - 1),
    expired = () => {
      decrement();
      return m.signedByte(at + 6) < 0;
    },
    zero = () => decrement() === 0,
    advance = (limit) => {
      frame(m.b(at + 4) + 1);
      if (m.b(at + 4) > limit) remove();
    };
  switch (action) {
    case 0x14ce:
    case 0x18f2:
      if (expired()) {
        counter(1);
        if (!p()) remove();
        else frame(1);
      }
      break;
    case 0x14e9:
      if (zero()) {
        counter(1);
        if (p() === 2 && late()) remove();
        else if (p() === 2) {
          phase(0);
          frame(0);
        } else frame(2);
      }
      break;
    case 0x19ed:
      if (expired()) {
        counter(1);
        frame(1);
        phase(2);
      }
      break;
    case 0x16ff:
      if (expired()) {
        counter(3);
        advance(4);
      }
      break;
    case 0x19ae:
      if (expired()) {
        counter(1);
        if (p() === 2) remove();
        else frame(1);
      }
      break;
    case 0x156a:
      if (expired()) {
        counter(1);
        frame(0);
        phase(2);
      }
      break;
    case 0x157d:
      if (expired()) {
        counter(7);
        advance(4);
      }
      break;
    case 0x15cb:
      if (expired()) {
        counter(1);
        frame(1);
      }
      break;
    case 0x15d9:
      if (expired()) {
        counter(1);
        if (p() === 2 && late()) remove();
        else if (p() === 2) frame(3);
        else if (p() === 3) {
          frame(2);
          phase(4);
        } else if (p() === 5) remove();
        else frame(2);
      }
      break;
    case 0x161b:
      if (expired()) {
        counter(1);
        if (p() === 1) {
          phase(2);
          frame(1);
        } else if (p() === 4) {
          phase(5);
          frame(1);
        }
      }
      break;
    case 0x1647:
      if (expired()) {
        counter(1);
        frame(1);
        phase(3);
      }
      break;
    case 0x165e:
      if (expired()) {
        counter(3);
        advance(5);
      }
      break;
    case 0x16cc:
      if (expired()) {
        counter(1);
        frame(2);
      }
      break;
    case 0x16db:
      if (expired()) {
        counter(1);
        if (p() !== 1) remove();
        else {
          frame(1);
          phase(2);
          if (late()) remove();
        }
      }
      break;
    case 0x175f:
      if (expired()) {
        counter(1);
        frame(p() === 2 ? 2 : 1);
      }
      break;
    case 0x1777:
      if (expired()) {
        counter(1);
        if (p() === 1) {
          frame(0);
          phase(2);
        } else frame(2);
      }
      break;
    case 0x178f:
      if (expired()) remove();
      break;
    case 0x179a:
      if (expired()) {
        counter(0);
        frame(m.b(at + 4) + 1);
        if (m.b(at + 4) > 4) {
          frame(3);
          phase(p() + 1);
          if (p() > 7) remove();
        }
      }
      break;
    case 0x182a:
      if (expired()) {
        counter(1);
        if (p() === 4) phase(5);
        frame(1);
      }
      break;
    case 0x1842:
      if (expired()) {
        counter(1);
        if (p() > 1 && late()) remove();
        else if (p() === 3) {
          frame(0);
          phase(4);
        } else if (p() === 5) remove();
        else frame(2);
      }
      break;
    case 0x1872:
      if (expired()) {
        counter(1);
        frame(1);
        phase(p() + 1);
      }
      break;
    case 0x190a:
      if (zero()) {
        counter(1);
        if (p() > 1 && late()) remove();
        else if (p() === 2) {
          phase(0);
          frame(0);
        } else frame(2);
      }
      break;
    case 0x19c1:
      if (zero()) {
        counter(1);
        if (p() > 1 && late()) remove();
        else frame(p() === 2 ? 0 : 2);
      }
      break;
    case 0x1a52:
      if (zero()) {
        if (p() === 2 && late()) remove();
        counter(1);
        frame(2);
      }
      break;
    case 0x1a73:
      if (expired()) {
        counter(1);
        if (p() === 1) {
          frame(1);
          phase(2);
        } else remove();
      }
      break;
    default:
      throw Error(
        `Untranslated photography animation branch ${action.toString(16)}`,
      );
  }
}
