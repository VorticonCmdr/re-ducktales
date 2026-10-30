import workletURL from "../speaker-game-worklet.js?worker&url";
import { GameAudioDevice } from "./audio-device.js";
export class GameSpeakerAudio extends GameAudioDevice {
  constructor(bytes, callbacks) {
    super(bytes, {
      ...callbacks,
      workletURL,
      processorName: "ducktales-speaker-game",
      label: "PC speaker",
    });
  }
}
