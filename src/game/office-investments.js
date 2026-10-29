import { OfficeMoneyBin, officeInvestmentFrames } from "./office.js";

// Original overlay2:0561..0698. Shared office clocks and common exit flush.
export class OfficeInvestmentDeparture extends OfficeMoneyBin {
  *run() {
    for (const step of officeInvestmentFrames()) {
      if (step.sound !== null && this.audioEnabled)
        this.events.push({ type: "sound", id: step.sound });
      this.pending = step.commands;
      this.source = step.source;
      yield { clock: "retrace", remaining: 1 };
      if (step.counts) yield { clock: "driver", remaining: step.counts };
    }
    this.outcome = { code: 39, action: "investments" };
  }
}
