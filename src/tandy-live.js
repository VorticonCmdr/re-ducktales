import workletURL from "./tandy-worklet.js?worker&url";

export function attachTandyLiveControls(section, bytes, sound, onError) {
  const play = document.createElement("button"),
    stop = document.createElement("button"),
    status = document.createElement("p");
  play.textContent = "Play live Tandy";
  stop.textContent = "Stop Tandy playback";
  stop.disabled = true;
  status.textContent =
    "Long or looping sequence. Live playback continues until it ends or you stop it.";
  section.dataset.state = "live-ready";
  section.append(play, stop, status);
  let context,
    node,
    gain,
    disposed = false,
    version = 0;
  const close = () => {
    node?.disconnect();
    gain?.disconnect();
    node?.port.close();
    node = null;
    gain = null;
    if (context && context.state !== "closed")
      return context.close().catch(() => {});
  };
  const fail = (error) => {
    section.dataset.state = "error";
    status.textContent = "Playback stopped.";
    play.disabled = false;
    stop.disabled = true;
    onError(error);
    close();
  };
  play.onclick = async () => {
    const current = ++version;
    await close();
    if (disposed || current !== version) return;
    play.disabled = true;
    stop.disabled = true;
    section.dataset.state = "loading";
    status.textContent = "Starting live playback…";
    document.querySelectorAll("audio").forEach((audio) => audio.pause());
    try {
      context = new AudioContext();
      const ownContext = context;
      ownContext.onstatechange = () => {
        if (context === ownContext)
          section.dataset.contextState = ownContext.state;
      };
      await ownContext.resume();
      await ownContext.audioWorklet.addModule(workletURL);
      if (disposed || current !== version) {
        await ownContext.close();
        return;
      }
      node = new AudioWorkletNode(ownContext, "ducktales-tandy", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { bytes: Array.from(bytes), sound },
      });
      node.onprocessorerror = () => {
        if (!disposed && current === version)
          fail(Error("Tandy audio processor failed"));
      };
      node.port.onmessage = (event) => {
        if (disposed || current !== version) return;
        const message = event.data;
        if (message.type === "error") {
          fail(Error(message.message));
          return;
        }
        if (!["playing", "ended", "stopped"].includes(message.type)) {
          fail(Error("Unsupported Tandy audio response"));
          return;
        }
        for (const key of [
          "frames",
          "interrupts",
          "ticks",
          "signalSamples",
          "acknowledgements",
          "chains",
          "sampleRate",
        ])
          section.dataset[key] = String(message[key]);
        section.dataset.state = message.type;
        stop.disabled = message.type !== "playing";
        play.disabled = message.type === "playing";
        status.textContent =
          message.type === "playing"
            ? "Playing live."
            : message.type === "ended"
              ? "Original sequence complete."
              : "Playback stopped.";
        if (message.type !== "playing") close();
      };
      gain = ownContext.createGain();
      gain.gain.value = 0.5;
      node.connect(gain).connect(ownContext.destination);
    } catch (error) {
      if (!disposed && current === version) fail(error);
    }
  };
  stop.onclick = () => {
    if (!node) return;
    stop.disabled = true;
    section.dataset.state = "stopping";
    status.textContent = "Stopping…";
    node.port.postMessage({ type: "stop" });
  };
  const otherAudio = () => {
    if (node) stop.onclick();
  };
  document.addEventListener("play", otherAudio, true);
  return () => {
    disposed = true;
    version++;
    document.removeEventListener("play", otherAudio, true);
    close();
  };
}
