import { parseLocations, parseLoot } from "./campaign.js";
import { Game } from "./application.js";
import { Scheduler } from "./scheduler.js";
import { Renderer } from "./renderer.js";
import { verifiedResources, REQUIRED_FILES } from "./resources.js";
import { renderSound, wavFile } from "../audio.js";
import { parseCaveMaps } from "./cave-scene.js";
import { investmentResources } from "./investments.js";
import { GameTandyAudio } from "./tandy-audio.js";
const $ = (id) => document.getElementById(id);
let game,
  renderer,
  resources,
  playing,
  scheduler,
  resumeAudio = false,
  pausedAt = null;
let tandyAudio,
  tandyGeneration = 0,
  pendingAudioInput = null;
function ensureTandyAudio() {
  if (tandyAudio?.disposed) tandyAudio = null;
  if (!tandyAudio && resources) {
    const generation = ++tandyGeneration;
    tandyAudio = new GameTandyAudio(resources.archives.get("IT.DRV")[4].data, {
      status: (token, busy) => dispatch({ type: "audio-status", token, busy }),
      stats: (values) => {
        if (generation !== tandyGeneration) return;
        $("sound").dataset.device = $("audio-device").value;
        for (const [key, value] of Object.entries(values))
          if (value !== undefined) $("sound").dataset[key] = String(value);
      },
      fail: fatal,
      observe: (event) =>
        $("sound").dispatchEvent(
          new CustomEvent("gameaudio", { detail: event, bubbles: true }),
        ),
    });
  }
  return tandyAudio;
}
function unlockTandyAudio() {
  try {
    if ($("audio-device").value === "tandy") ensureTandyAudio()?.unlock();
  } catch (error) {
    fatal(error);
  }
}
const held = new Set();
function mapDirection() {
  const x = Number(held.has("ArrowRight")) - Number(held.has("ArrowLeft"));
  const y = Number(held.has("ArrowDown")) - Number(held.has("ArrowUp"));
  return (
    [
      y < 0 ? "up" : y > 0 ? "down" : null,
      x < 0 ? "left" : x > 0 ? "right" : null,
    ]
      .filter(Boolean)
      .join("-") || null
  );
}
function flightControls() {
  dispatch({
    type: "controls",
    fire: held.has("Space") || held.has("Enter"),
    direction:
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
        .filter((k) => held.has(k))
        .at(-1)
        ?.slice(5)
        .toLowerCase() ?? null,
  });
  if (game?.scene === "map")
    dispatch({ type: "direction", direction: mapDirection() });
}
function fatal(error) {
  if (game) game.fail(error);
  if (game) {
    $("game").dataset.scene = game.scene;
    $("game").dataset.state = JSON.stringify(game.snapshot());
  }
  $("diagnostic").hidden = false;
  $("diagnostic").textContent =
    `Stopped: ${error.message}\nRestart after resolving this diagnostic.`;
  playing?.pause();
  tandyAudio?.close();
}
function dispatch(event) {
  if (!game) return;
  try {
    scheduler.enqueue(event, performance.now());
  } catch (e) {
    fatal(e);
  }
}
function present(state) {
  renderer.render(state);
  $("game").dispatchEvent(
    new CustomEvent("gamepresent", { detail: state.snapshot() }),
  );
}
async function load(read) {
  try {
    $("status").textContent = "Checking original files…";
    resources = await verifiedResources(read);
    tandyAudio?.close();
    tandyAudio = null;
    pendingAudioInput = null;
    game = new Game({
      biosSeed: 0,
      audioEnabled: $("audio").checked,
      locations: parseLocations(resources.archives.get("LOC.ARC")),
      loot: parseLoot(resources.archives.get("LOOT.ARC")),
      investmentResources: {
        ...investmentResources(
          resources.archives.get("INVEST.ARC"),
          resources.archives.get("CHART.ARC"),
        ),
        image: resources.executable,
      },
      expeditionResources: {
        image: resources.executable,
        entries: resources.archives.get("EXP.ARC"),
        maps: parseCaveMaps(resources.archives.get("CAVEMAPS.ARC")),
        clues: resources.archives.get("CLUES.ARC"),
        mountainEntries: resources.archives.get("MT.ARC"),
        jungleEntries: resources.archives.get("JG.ARC"),
        photographyEntries: resources.archives.get("PS.ARC"),
        mainEntries: resources.archives.get("MAIN.ARC"),
      },
      flightResources: {
        image: resources.executable,
        entries: resources.archives.get("PLANE.ARC"),
      },
    });
    renderer = new Renderer($("game"), resources);
    $("loader").hidden = true;
    $("actions").hidden = false;
    $("diagnostic").hidden = true;
    scheduler = new Scheduler(game, performance.now(), { present });
    renderer.render(game);
    $("game").focus();
  } catch (e) {
    fatal(e);
    $("status").textContent = "Could not load this game build.";
  }
}
async function local() {
  await load(async (name) => {
    const r = await fetch(`${import.meta.env.BASE_URL}game/${name}`);
    if (!r.ok) throw Error(`Missing game/${name}`);
    return r.arrayBuffer();
  });
}
$("open-folder").onclick = () => $("folder").click();
$("load-local").onclick = local;
$("folder").onchange = async (event) => {
  const files = new Map(
    [...event.target.files].map((f) => [f.name.toUpperCase(), f]),
  );
  await load((name) => {
    const file = files.get(name);
    if (!file)
      throw Error(`Missing ${name}; required: ${REQUIRED_FILES.join(", ")}`);
    return file.arrayBuffer();
  });
};
$("fire").onclick = () =>
  dispatch({ type: "fire", direction: held.has("ArrowUp") ? "up" : null });
$("map").onclick = () => dispatch({ type: "map" });
$("investments").onclick = () => dispatch({ type: "investments" });
$("left").onclick = () =>
  dispatch(
    game?.scene === "map" && !game.campaign.info
      ? { type: "step", direction: "left" }
      : { type: "left" },
  );
$("right").onclick = () =>
  dispatch(
    game?.scene === "map" && !game.campaign.info
      ? { type: "step", direction: "right" }
      : { type: "right" },
  );
$("back").onclick = () => {
  dispatch({ type: "back" });
  $("game").focus();
};
$("pause").onclick = () => dispatch({ type: "pause" });
$("quit").onclick = () => dispatch({ type: "quit" });
$("quit-yes").onclick = () => dispatch({ type: "quit-yes" });
$("quit-no").onclick = () => dispatch({ type: "quit-no" });
$("up").onclick = () =>
  dispatch(
    game?.scene === "map" ? { type: "step", direction: "up" } : { type: "up" },
  );
$("down").onclick = () =>
  dispatch(
    game?.scene === "map"
      ? { type: "step", direction: "down" }
      : { type: "down" },
  );
$("money-bin").onclick = () => {
  if (game?.scene !== "office") return;
  dispatch({ type: "money-bin" });
};
$("restart").onclick = () => {
  pendingAudioInput = null;
  stopSound();
  held.clear();
  if (game) {
    game.diagnostic = null;
    game.input({ type: "restart" });
    scheduler = new Scheduler(game, performance.now(), { present });
    $("diagnostic").hidden = true;
  }
};
window.addEventListener("keydown", (event) => {
  if (
    ![
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "Enter",
      "Escape",
      "KeyP",
      "KeyS",
      "KeyQ",
      "KeyY",
      "KeyN",
      "F1",
    ].includes(event.code)
  )
    return;
  if (event.target instanceof HTMLInputElement) return;
  if (event.target instanceof HTMLSelectElement) return;
  if ($("audio").checked || event.code === "KeyS") unlockTandyAudio();
  event.preventDefault();
  const systemKey = {
    KeyP: "pause",
    KeyS: "toggle-sound",
    KeyQ: "quit",
    Escape: "quit",
    F1: "quit",
    KeyY: "quit-yes",
    KeyN: "quit-no",
  }[event.code];
  if (systemKey) {
    dispatch({
      type: systemKey,
      scanCode: { Escape: 1, KeyQ: 0x10, KeyP: 0x19, KeyS: 0x1f, F1: 0x3b }[
        event.code
      ],
    });
    return;
  }
  held.add(event.code);
  flightControls();
  if (event.repeat) return;
  if (event.code === "Space" || event.code === "Enter")
    dispatch({
      type: "fire",
      direction: held.has("ArrowUp")
        ? "up"
        : held.has("ArrowLeft")
          ? "left"
          : held.has("ArrowRight")
            ? "right"
            : null,
    });
  else if (event.code === "ArrowUp") dispatch({ type: "up" });
  else if (event.code === "ArrowDown") dispatch({ type: "down" });
  else if (event.code === "ArrowLeft") dispatch({ type: "left" });
  else if (event.code === "ArrowRight") dispatch({ type: "right" });
});
window.addEventListener("keyup", (event) => {
  held.delete(event.code);
  flightControls();
});
$("game").addEventListener("pointerdown", (event) => {
  if (game?.scene !== "map" || game.campaign.info) return;
  const r = $("game").getBoundingClientRect();
  dispatch({
    type: "point",
    x: ((event.clientX - r.left) * 320) / r.width,
    y: ((event.clientY - r.top) * 200) / r.height,
  });
  $("game").focus();
});
window.addEventListener("blur", () => {
  held.clear();
  flightControls();
  dispatch({ type: "direction", direction: null });
});
document.addEventListener("visibilitychange", () => {
  held.clear();
  flightControls();
  const now = performance.now();
  if (document.hidden) {
    pausedAt = now;
    resumeAudio = !!playing && !playing.paused;
    audioGeneration++;
    playing?.pause();
    tandyAudio?.setSuspended(true);
  } else if (pausedAt !== null) {
    scheduler?.pauseDuration(now - pausedAt);
    pausedAt = null;
    if (resumeAudio && $("audio").checked) {
      const generation = audioGeneration;
      playing?.play().catch((e) => audioFailure(e, generation));
    }
    resumeAudio = false;
    tandyAudio?.setSuspended(false);
  }
});
const sounds = new Map();
let activeAudioToken = null;
let audioGeneration = 0;
function audioFailure(error, generation) {
  // A newer sound,explicit stop,or visibility pause cancels the old request.
  // The original driver has one channel too. Only that known cancellation
  // is expected; failures of the current playback still stop development.
  if (error.name === "AbortError" && generation !== audioGeneration) return;
  fatal(new Error(`Audio playback: ${error.message}`));
}
function stopSound() {
  audioGeneration++;
  playing?.pause();
  if (tandyAudio && !tandyAudio.disposed) tandyAudio.request(0);
  if (activeAudioToken !== null) {
    dispatch({ type: "audio-status", token: activeAudioToken, busy: false });
    activeAudioToken = null;
  }
}
function effects() {
  for (const event of game.drainEffects()) {
    if (event.type === "flushControls") held.clear();
    if (event.type === "stopAudio") stopSound();
    if (event.type === "sound" && game.audioEnabled) {
      if ($("audio-device").value === "tandy") {
        ensureTandyAudio().request(
          event.argument ?? event.id,
          event.token ?? null,
        );
        continue;
      }
      // The existing speaker audition omits its parameterized engine. Tandy
      // receives the real start/speed words through its persistent device.
      if (event.engine) continue;
      if (!sounds.has(event.id))
        sounds.set(
          event.id,
          URL.createObjectURL(
            new Blob(
              [
                wavFile(
                  renderSound(
                    resources.archives.get("IT.DRV")[5].data,
                    event.id,
                  ),
                ),
              ],
              { type: "audio/wav" },
            ),
          ),
        );
      stopSound();
      playing = $("sound");
      activeAudioToken = event.token ?? null;
      const token = activeAudioToken;
      const generation = audioGeneration;
      playing.onended = () => {
        if (token !== null)
          dispatch({ type: "audio-status", token, busy: false });
        if (activeAudioToken === token) activeAudioToken = null;
      };
      playing.onerror = () => fatal(new Error("Audio playback failed"));
      playing.src = sounds.get(event.id);
      playing.volume = 0.35;
      playing.play().catch((e) => audioFailure(e, generation));
    }
  }
}
$("audio").onchange = () => {
  if ($("audio").checked) unlockTandyAudio();
  const event = { type: "audio-enabled", enabled: $("audio").checked };
  pendingAudioInput = { event, from: scheduler?.consumed.length ?? 0 };
  dispatch(event);
  if (!$("audio").checked) stopSound();
};
$("audio-device").onchange = () => {
  if (game?.audioEnabled) {
    fatal(Error("Switch sound off before changing its device"));
    return;
  }
  const previous = tandyAudio;
  tandyAudio = null;
  previous?.stopAndClose().catch(fatal);
  $("sound").dataset.device = $("audio-device").value;
};
window.addEventListener("pagehide", () => tandyAudio?.close());
function frame() {
  const now = performance.now();
  try {
    if (game && !game.diagnostic && !document.hidden) {
      scheduler.advanceTo(now);
      effects();
      renderer.render(game);
      const overlay = game.systemOverlay;
      for (const id of ["fire", "up", "down", "left", "right"])
        $(id).disabled = !!overlay;
      $("money-bin").disabled = !!overlay || game.scene !== "office";
      $("map").disabled = !!overlay || game.scene !== "office";
      $("investments").disabled = !!overlay || game.scene !== "office";
      $("back").disabled =
        !!overlay || ["departure", "ending"].includes(game.scene);
      $("pause").disabled =
        game.exiting ||
        (game.scene === "ending" && game.ending.phase === "closed") ||
        (!!overlay &&
          (overlay.kind !== "pause" || overlay.phase !== "waiting"));
      $("pause").textContent = overlay?.kind === "pause" ? "Resume" : "Pause";
      $("quit").disabled =
        !!overlay ||
        game.exiting ||
        (game.scene === "ending" && game.ending.phase === "closed");
      $("quit-yes").hidden = $("quit-no").hidden = overlay?.kind !== "quit";
      if (
        pendingAudioInput &&
        scheduler.consumed
          .slice(pendingAudioInput.from)
          .some((entry) => entry.event === pendingAudioInput.event)
      )
        pendingAudioInput = null;
      // Retain checkbox intent until the scheduler consumes that exact input.
      // A later S event can then publish its own authoritative final setting.
      $("audio").checked =
        pendingAudioInput?.event.enabled ?? game.audioEnabled;
      $("audio-device").disabled =
        game.audioEnabled || pendingAudioInput?.event.enabled === true;
      $("status").textContent = overlay
        ? overlay.kind === "pause"
          ? "Game paused · P to resume"
          : "Quit game? · Y to quit · N to keep playing"
        : game.scene === "ending"
          ? game.ending.phase === "closed"
            ? "Game finished · Restart to play again"
            : game.ending.phase === "replay"
              ? "Play again? · Arrows choose · Fire confirms"
              : game.ending.phase === "credits"
                ? "Credits · Fire to skip"
                : game.ending.phase === "farewell"
                  ? "Thanks for playing · Fire to finish"
                  : `Month over · ${game.ending.won ? "Scrooge wins" : "Glomgold wins"} · Banked $${game.ending.banked} · Rival $${game.ending.rivalBanked} · Fire to continue`
          : game.scene === "investments"
            ? `Investments · Arrows to choose · Fire to select, buy, or sell · Cash $${game.money}`
            : game.scene === "photography"
              ? `Photography · Left / Up / Right to aim · Fire to take a picture · Film ${game.photography.snapshot().film} · Cash $${game.money}`
              : game.scene === "jungle"
                ? `Jungle · Arrow keys to move, climb, or drop · Fire to jump · Lives ${game.jungle.snapshot().lives} · Cash $${game.money}`
                : game.scene === "mountain"
                  ? `Mountain · Arrow keys to move · Hold Fire to swing the hook; release to throw · Lives ${game.mountain.snapshot().lives} · Cash $${game.money}`
                  : game.scene === "atomic-transport"
                    ? `Atomic transport · ${game.atomicTransport.phase === "report" ? "Misdirected to " + game.campaign.locations[game.atomicTransport.target].name + " · Fire to continue" : "Transporting"} · Day ${game.campaign.day}`
                    : game.scene === "departure"
                      ? `Departure confirmed · ${game.campaign.locations[game.departure.target].name} · ${game.departure.days} travel day(s) · Fire to fly`
                      : game.scene === "cave"
                        ? `Cave · ${game.cave.phase === "exploring" ? "Hold an arrow to point; press Space to move" : game.cave.phase} · Lamp ${game.cave.snapshot().torch}/${game.cave.snapshot().limit} · Cash $${game.cave.snapshot().money}`
                        : game.scene === "expedition-result"
                          ? `Expedition ${game.expeditionResult.phase === "failure" ? "failed" : game.expeditionResult.phase === "award" ? "treasure recovered" : "atomic transport unlocked"} · Fire to continue · Cash $${game.money}`
                          : game.scene === "visit-notice"
                            ? `${game.visitNotice.reason === "player" ? "This treasure is already collected" : "Glomgold has already taken this treasure"} · Fire to return to the map`
                            : game.scene === "expedition-briefing"
                              ? "The Junior Woodchuck Guide"
                              : game.scene === "flight"
                                ? game.flight.phase === "return-wait"
                                  ? `Flight complete · Fire to continue · Day ${game.flight.snapshot().day}`
                                  : `Flight · ${game.flight.phase} · Hold Space for throttle · Down raises the nose; Up lowers it · Day ${game.flight.snapshot().day}`
                                : ["rival-claim", "rival-report"].includes(
                                      game.scene,
                                    )
                                  ? `Glomgold has taken the treasure · Fire to continue`
                                  : game.scene === "money-bin"
                                    ? `Money bin · ${game.bin.phase} · Fire to dive`
                                    : game.scene === "map"
                                      ? `World map · Day ${game.campaign.day} · Cash $${game.money} · Banked $${game.campaign.banked} · ${game.campaign.selected === 35 ? "Office" : game.campaign.locations[game.campaign.selected].name} · ${game.campaign.snapshot().travelDays} travel days`
                                      : `${game.scene === "office" ? "Office" : game.scene === "difficulty" ? "Choose difficulty" : "Press Space or Enter to start"} · Cash $${game.money.toLocaleString()}${game.rareCoinTaken ? " · Rare coin found" : ""}`;
      $("game").dataset.scene = game.scene;
      $("game").dataset.overlay = overlay?.kind ?? "";
      $("game").dataset.state = JSON.stringify(game.snapshot());
    }
  } catch (e) {
    fatal(e);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (import.meta.env.DEV) local();
else {
  $("load-local").hidden = true;
  $("status").textContent = "Select your original game folder.";
}
