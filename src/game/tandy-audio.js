import workletURL from "../tandy-game-worklet.js?worker&url";
import { GameAudioDevice } from "./audio-device.js";
export class GameTandyAudio extends GameAudioDevice {
  constructor(bytes, callbacks) {
    super(bytes, {
      ...callbacks,
      workletURL,
      processorName: "ducktales-tandy-game",
      label: "Tandy",
    });
  }
}
