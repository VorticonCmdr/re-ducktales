// Conditional reader tests start AFTER the real graphics entry. The fake device
// receives only explicit test audio-status events;fresh queries consume that
// independent value. No expected state supplies status or timing.
import {
  advanceReportUntil,
  finishReport,
} from "../../tests/helpers/report-fixture.js";
export async function prepareReportInputFixture(game, model) {
  const input = game.input.bind(game),
    device = { known: false, busy: null };
  const replied = new Set();
  const pump = () => {
    if (!device.known || !model.statusToken || replied.has(model.statusToken))
      return;
    replied.add(model.statusToken);
    input({
      type: "audio-status",
      token: model.statusToken,
      busy: device.busy,
    });
  };
  game.input = (event) => {
    if (event.type === "audio-status" && event.token === model.token) {
      device.known = true;
      device.busy = event.busy;
      if (!model.queryStatus) input(event);
      else pump();
    } else input(event);
    pump();
  };
  game.reportInputFixture = { pump };
  advanceReportUntil(game, () => game.reportPresentation.phase === "reading");
}
export function readerTicks(game, n) {
  for (let i = 0; i < n; i++) {
    game.advanceTick();
    game.reportInputFixture?.pump();
  }
}
export function finishReportInputExit(game) {
  if (game.reportPresentation?.phase !== "exit-wipe")
    throw Error("Expected source report exit wipe");
  finishReport(game);
}
