import { s16 } from "./integer.js";
import { selectJungleActorAnimation } from "./jungle-animation.js";
import {
  jungleActorCenter,
  jungleFeetRow,
  junglePlatformAt,
  jungleLeftEdge,
  jungleRightEdge,
  queryJunglePlatform,
  findJungleFishSupport,
  jungleVineReach,
  leaveJungleMovingPlatform,
  updateJungleGrid,
} from "./jungle-collision.js";

// Main0651..0aad. Input is the independent joystick byte consumed at0680.
// The original key-matrix clear is game state; the BIOS queue flush is an
// explicit external effect. Neither supplies the next joystick byte.
export function sampleJungleControls(m, byte, effects = {}) {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255)
    throw Error("Invalid jungle joystick byte");
  m.i(0x5f44, byte);
  if (byte & 64) byte |= 128;
  if (m.i(0x3746) > 0) {
    m.i(0x3746, m.i(0x3746) - 1);
    return;
  }
  const action = m.i(0x6882),
    facing = m.i(0x3d12),
    moving = m.i(0x882a) * 50 + 0x6040;
  let keepVineFrame = false;
  const choose = (value) => m.i(0x6882, value);
  const leave = () => {
    m.i(0x6858, m.i(moving + 2) * 32 + 16);
    leaveJungleMovingPlatform(m, m.i(0x882a), effects);
  };
  const vineAt = (column) => m.i((0x5bb2 + column * 2) & 65535);
  if (action === 5) {
    if (byte === 1) {
      if (m.i(0x8924) !== 0 && facing === 1) choose(3);
      else if (!queryJunglePlatform(m, 2, 2)) {
        if (
          vineAt(m.i(0x544c)) !== 0 &&
          m.i(0x8d64) === 0 &&
          ((facing === 1 && vineAt(m.i(0x544c) + 1) !== 0) ||
            (facing === 0 && vineAt(m.i(0x544c) - 1) !== 0))
        )
          choose(facing === 1 ? 17 : 16);
        else choose(19);
      } else if (m.i(0x8d64) === 0) choose(20);
      else {
        m.i(0x8d64, 0);
        m.i(0x6858, 130);
        m.i(0x5462, 3);
        choose(12);
      }
    } else if (byte === 3) {
      choose(1);
      if (facing === 0) m.i(0x3d12, 1);
      if (s16(jungleActorCenter(m) + 20) > jungleRightEdge(m, m.i(0x544c))) {
        if (m.i(0x8924) !== 0) leave();
        else if (
          m.i(0x8d64) === 0 &&
          junglePlatformAt(m, m.i(0x544c) + 1, m.i(0x5462)) === 0 &&
          (queryJunglePlatform(m, 1, 3) ||
            (m.i(0x5462) === 2 &&
              findJungleFishSupport(m, s16(jungleActorCenter(m) + 16)) > 0))
        )
          choose(4);
      }
    } else if (byte === 5) {
      if (m.i(0x8d64) !== 0) choose(10);
      else if (jungleFeetRow(m) < 2) choose(21);
      else {
        if (m.i(0x8924) !== 0) leave();
        choose(13);
      }
    } else if (byte === 7) {
      if (m.i(0x5f46) > 16) {
        choose(1);
        if (facing === 1) m.i(0x3d12, 0);
        if (jungleLeftEdge(m, m.i(0x544c)) > s16(jungleActorCenter(m) - 18)) {
          if (
            m.i(0x8924) !== 0 &&
            junglePlatformAt(m, m.i(0x544c) + 1, m.i(moving + 2)) !== 0
          )
            leave();
          else if (
            m.i(0x8d64) === 0 &&
            junglePlatformAt(m, m.i(0x544c) - 1, m.i(0x5462)) === 0 &&
            (queryJunglePlatform(m, 0, 3) ||
              (m.i(0x5462) === 2 &&
                findJungleFishSupport(m, s16(jungleActorCenter(m) - 16)) > 0))
          )
            choose(4);
        }
      }
    } else if (byte === 192) choose(18);
    else m.i(0x88ac, m.i(0x88ac) + 1);
  } else if (action === 8) {
    m.i(0x3746, 2);
    const direction = byte === 3 ? 1 : byte === 7 ? -1 : 0;
    const candidate = s16(m.i(0x7166) + direction);
    if (
      direction !== 0 &&
      jungleVineReach(
        m,
        candidate,
        jungleActorCenter(m),
        s16(m.i(0x6858) + 16),
        256,
      )
    ) {
      m.i(0x7166, candidate);
      keepVineFrame = true;
    } else if (direction !== 0 || byte === 5) {
      m.i(0x5462, m.i(0x5462) + 1);
      m.i(0x6858, m.i(0x5462) * 32 + 16);
      m.i(0x7166, 0);
      choose(s16(m.i(0x5462) * 32 + 32) > 112 ? 2 : 5);
    } else m.i(0x3746, 0);
  }
  if (!keepVineFrame && (action !== m.i(0x6882) || facing !== m.i(0x3d12)))
    selectJungleActorAnimation(m, m.i(0x6882), effects);
  updateJungleGrid(m);
  m.bytes.fill(0, 0x276c, 0x27ec);
  effects.flushInput?.();
}
