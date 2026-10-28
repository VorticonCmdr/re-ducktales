import { OfficeMoneyBin } from "./office.js";
import { controlCenterDepartureCommands } from "./security.js";

// Overlay2:0485..053d, followed by the same06bf keyboard flush as the door.
// The single page flip is independent of the subsequent first-map challenge.
export class OfficeControlCenter extends OfficeMoneyBin {
  constructor(options) { super(options); this.action="map"; }
  *run() {
    this.source = 0x04fe;
    this.pending = controlCenterDepartureCommands();
    yield { clock: "retrace", remaining: 1 };
    if (this.audioEnabled) this.events.push({ type: "sound", id: 5 });
    this.outcome = { code: 40, action: "map" };
  }
}
