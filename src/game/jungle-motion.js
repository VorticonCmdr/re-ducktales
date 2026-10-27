import { s16 } from "./integer.js";
import {
  advanceJungleActorFrame,
  selectJungleActorAnimation,
} from "./jungle-animation.js";
import {
  findJungleFishSupport,
  jungleActorCenter,
  jungleFeetRow,
  junglePlatformAt,
  jungleVineReach,
  leaveJungleMovingPlatform,
  flagJungleFishDirty,
  updateJungleGrid,
} from "./jungle-collision.js";

const word = (m, at) => m.i(at & 65535);
// Original118a:03b3 only reads the anchor and current endpoint. The separate
// vine hazard owns projection advancement, so no host trigonometry is used.
export function jungleVinePoint(m, index) {
  const at = index * 34;
  return {
    anchorX: word(m, at + 0x5d4c),
    anchorY: word(m, at + 0x5d4e),
    x: word(m, at + 0x5d52),
    y: word(m, at + 0x5d54),
  };
}
const animationEffects = (m, effects) => ({
  ...effects,
  vinePoint: effects.vinePoint ?? ((index) => jungleVinePoint(m, index)),
});
const sound = (m, effects, id) => {
  if (m.b(0x3be)) effects.sound?.(id);
};

function beginFishRide(m, id, effects) {
  if (typeof effects.wait !== "function")
    throw Error("Missing jungle driver wait provider");
  m.i(0x7158, id);
  m.i(0x5b24, 0);
  effects.wait(0);
  effects.wait(7);
  sound(m, effects, 0x5b);
}
// f26:0684. Repeated calls intentionally apply repeated four-pixel movement;
// landing paths below call this twice, exactly as the original does.
export function moveJungleFishRider(m, id, effects = {}) {
  const at = id * 32;
  if (
    word(m, at + 0x5156) < word(m, at + 0x5158) &&
    findJungleFishSupport(m, m.i(0x5f46)) >= 0
  ) {
    if (m.i(0x5b3e) !== 0) return;
    m.i(0x5f46, m.i(0x5f46) + 4);
    const y = s16(word(m, at + 0x5156) * 2 + word(m, at + 0x514c) - 26);
    if (m.i(0x5b24) === 0) m.i(0x5b24, m.i(0x6858));
    m.i(0x6858, m.i(0x6858) + s16(y - m.i(0x5b24)));
    m.i(0x5b24, y);
  } else {
    m.i(0x8d64, 0);
    m.i(0x7158, 0);
    m.i(0x6882, 6);
    selectJungleActorAnimation(m, 6, animationEffects(m, effects));
  }
}
// Original1090:0824's FILD/FISUB/FIMUL/FDIV sequence operates on integer
// operands and the exact original double104. __ftol truncates before AX stores.
export function moveJunglePlatformRider(m, id) {
  const at = id * 50 + 0x6040,
    frame = m.view.getUint16(at + 34, true);
  if (m.d(0x33ce) !== 104)
    throw Error("Unsupported jungle platform slope constant");
  let slope = s16(
      Math.trunc(((m.i(0x5f46) - m.i(at + 42)) * m.i(frame + 6)) / 104),
    ),
    dx = 0;
  if (
    m.i(frame + 2) === 2 &&
    s16(s16(jungleActorCenter(m) - m.i(at + 42)) - m.i(0x3a44)) > 45
  ) {
    slope = s16(slope + 5);
    dx = -5;
  }
  m.i(0x6858, m.i(0x6858) + s16(slope - m.i(0x3a46)));
  m.i(0x5f46, m.i(0x5f46) + s16(dx - m.i(0x3a44)));
  m.i(0x3a46, slope);
  m.i(0x3a44, dx);
}
// Main0aae: maintain the support's contribution before the action update.
export function updateJungleRider(m, effects = {}) {
  if (m.i(0x8924) !== 0) moveJunglePlatformRider(m, m.i(0x882a));
  else if (m.i(0x8d64) !== 0) {
    if (word(m, 0x5156 + m.i(0x7158) * 32) === 4) {
      m.i(0x6882, 2);
      selectJungleActorAnimation(m, 2, animationEffects(m, effects));
      m.i(0x8d64, 0);
    } else {
      moveJungleFishRider(m, m.i(0x7158), effects);
      flagJungleFishDirty(m, m.i(0x7158), 10);
    }
  }
}

// Main0c98..11c4, translated from the original21-entry dispatch table and
// disassembly. Its Ghidra decompilation follows overlapping invalid flow.
export function advanceJungleMotion(m, effects = {}) {
  if (m.i(0x8b56) > 0) return;
  const oldAction = m.i(0x6882),
    complete = s16(m.i(0x88ae) + 1) >= m.i(0x6d9a);
  updateJungleGrid(m);
  let skipAnimation = false;
  const choose = (action) => m.i(0x6882, action);
  const addY = (delta) => m.i(0x6858, m.i(0x6858) + delta);
  const idle = () => choose(5),
    fall = () => choose(2);
  const attachVine = (id) => {
    m.i(0x7166, id);
    choose(8);
  };
  const currentVine = () => word(m, 0x5bb2 + m.i(0x544c) * 2);
  const landFish = (id) => {
    beginFishRide(m, id, effects);
    m.i(0x8d64, 1);
    idle();
    moveJungleFishRider(m, m.i(0x7158), effects);
    moveJungleFishRider(m, m.i(0x7158), effects);
  };
  switch (oldAction) {
    case 1:
      if (complete) {
        sound(m, effects, 0x0a);
        m.b(0x8e26, m.b(0x8e26) ^ 1);
        idle();
      }
      break;
    case 2:
      if (s16(m.i(0x6858) + 40) >= 154) {
        const id = findJungleFishSupport(m, jungleActorCenter(m));
        if (id < 0) choose(6);
        else landFish(id);
      } else {
        addY(16);
        skipAnimation = true;
      }
      break;
    case 3: {
      let falling = false;
      if (m.i(0x88ae) === 1) leaveJungleMovingPlatform(m, m.i(0x882a), effects);
      else if (m.i(0x88ae) === 6) {
        const id = junglePlatformAt(m, m.i(0x544c), jungleFeetRow(m));
        if (id === 0 || (m.i(0x8924) !== 0 && id === m.i(0x882a))) {
          fall();
          falling = true;
        }
      } else if (complete) {
        m.i(0x6858, (s16(m.i(0x6858) + 14) >> 5) * 32 + 16);
        idle();
        sound(m, effects, 0x77);
      }
      if (!falling) {
        const id = currentVine();
        if (
          id !== 0 &&
          jungleVineReach(
            m,
            id,
            jungleActorCenter(m),
            s16(m.i(0x6858) + 16),
            1024,
          )
        )
          attachVine(id);
      }
      break;
    }
    case 4:
      if (m.i(0x88ae) === 4 && jungleFeetRow(m) > 2) addY(8);
      else if (complete) {
        if (m.i(0x5462) >= 3) {
          const id = findJungleFishSupport(m, jungleActorCenter(m));
          if (id >= 0) {
            beginFishRide(m, id, effects);
            moveJungleFishRider(m, m.i(0x7158), effects);
            moveJungleFishRider(m, m.i(0x7158), effects);
            m.i(0x8d64, 1);
          } else choose(6);
        }
        // Original1001→1007 overwrites the no-fish drowning action with idle.
        idle();
        sound(m, effects, 0x77);
      }
      break;
    case 6:
      if (complete) choose(7);
      break;
    case 8: {
      const p = (effects.vinePoint ?? ((id) => jungleVinePoint(m, id)))(
        m.i(0x7166),
      );
      m.i(0x5f46, p.x);
      m.i(0x6858, p.y);
      const facing = m.i(0x3d12) === 1;
      let frame, dx, dy;
      if (p.anchorX > p.x) {
        frame = facing ? 28 : 30;
        dx = facing ? -9 : -20;
        dy = facing ? -12 : -13;
      } else if (p.anchorX < p.x) {
        frame = facing ? 29 : 31;
        dx = facing ? 4 : -6;
        dy = facing ? -10 : -12;
      } else {
        frame = facing ? 23 : 27;
        dx = facing ? -5 : -12;
        dy = facing ? 0 : -1;
      }
      m.b(m.view.getUint16(0x797a, true) + 18, frame);
      m.i(0x5f46, m.i(0x5f46) + dx);
      addY(dy);
      skipAnimation = true;
      break;
    }
    case 10:
      if (complete) idle();
      break;
    case 12:
      if (complete) {
        m.i(0x6858, (m.i(0x6858) >> 5) * 32 + 16);
        idle();
      }
      break;
    case 13:
      if (complete) {
        addY(5);
        const id = findJungleFishSupport(m, m.i(0x5f46));
        if (id < 0) fall();
        else landFish(id);
      }
      break;
    case 14:
      if (complete) fall();
      break;
    case 16:
    case 17:
      if (complete) {
        const id = currentVine(),
          right = oldAction === 17;
        if (
          id !== 0 &&
          jungleVineReach(
            m,
            id,
            s16(m.i(0x5f46) + (right ? 15 : 4)),
            s16(m.i(0x6858) + (right ? 24 : 8)),
            324,
          )
        )
          attachVine(id);
        else fall();
      }
      break;
    case 18:
      if (complete) {
        idle();
        m.i(0x5f46, m.i(0x5f46) + (m.i(0x3d12) === 0 ? 14 : -14));
      }
      break;
    case 19:
      if (complete) {
        addY(8);
        idle();
      }
      break;
    case 20:
      if (complete) {
        addY(7);
        idle();
      }
      break;
    case 21:
      if (complete) {
        addY(6);
        idle();
      } else if (
        m.i(0x88ae) === 5 &&
        junglePlatformAt(m, m.i(0x544c), m.i(0x5462) + 1) === 0
      )
        fall();
      break;
    default:
      skipAnimation = true;
  }
  if (!skipAnimation) {
    if (m.i(0x6882) !== oldAction)
      selectJungleActorAnimation(m, m.i(0x6882), animationEffects(m, effects));
    else advanceJungleActorFrame(m);
  }
  updateJungleGrid(m);
}
