import { parseLocations, parseLoot } from "./campaign.js";
import { Game } from "./application.js";
import { Scheduler } from "./scheduler.js";
import { Renderer } from "./renderer.js";
import { verifiedResources, REQUIRED_FILES } from "./resources.js";
import { renderSound, wavFile } from "../audio.js";
import { parseCaveMaps } from "./cave-scene.js";
const $ = (id) => document.getElementById(id);
let game,
  renderer,
  resources,
  playing,
  scheduler,
  resumeAudio = false,
  pausedAt = null;
const held = new Set();
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
    game = new Game({
      biosSeed: 0,
      audioEnabled: $("audio").checked,
      locations: parseLocations(resources.archives.get("LOC.ARC")),
      loot: parseLoot(resources.archives.get("LOOT.ARC")),
      expeditionResources: {
        image: resources.executable,
        entries: resources.archives.get("EXP.ARC"),
        maps: parseCaveMaps(resources.archives.get("CAVEMAPS.ARC")),
        clues: resources.archives.get("CLUES.ARC"),
        mountainEntries: resources.archives.get("MT.ARC"),
        jungleEntries: resources.archives.get("JG.ARC"),
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
$("back").onclick = () => dispatch({ type: "back" });
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
  playing?.pause();
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
    ].includes(event.code)
  )
    return;
  if (event.target instanceof HTMLInputElement) return;
  event.preventDefault();
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
  else if (event.code === "Escape") dispatch({ type: "back" });
  if (event.code.startsWith("Arrow"))
    dispatch({
      type: "direction",
      direction: event.code.slice(5).toLowerCase(),
    });
});
window.addEventListener("keyup", (event) => {
  held.delete(event.code);
  flightControls();
  if (event.code.startsWith("Arrow"))
    dispatch({ type: "direction", direction: null });
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
    playing?.pause();
  } else if (pausedAt !== null) {
    scheduler?.pauseDuration(now - pausedAt);
    pausedAt = null;
    if (resumeAudio && $("audio").checked)
      playing
        ?.play()
        .catch((e) => fatal(new Error(`Audio playback: ${e.message}`)));
    resumeAudio = false;
  }
});
const sounds = new Map();
let activeAudioToken = null;
function stopSound() {
  playing?.pause();
  if (activeAudioToken !== null) {
    dispatch({ type: "audio-status", token: activeAudioToken, busy: false });
    activeAudioToken = null;
  }
}
function effects() {
  for (const event of game.drainEffects()) {
    if (event.type === "stopAudio") stopSound();
    if (event.type === "sound" && $("audio").checked) {
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
      playing.onended = () => {
        if (token !== null)
          dispatch({ type: "audio-status", token, busy: false });
        if (activeAudioToken === token) activeAudioToken = null;
      };
      playing.onerror = () => fatal(new Error("Audio playback failed"));
      playing.src = sounds.get(event.id);
      playing.volume = 0.35;
      playing
        .play()
        .catch((e) => fatal(new Error(`Audio playback: ${e.message}`)));
    }
  }
}
$("audio").onchange = () => {
  dispatch({ type: "audio-enabled", enabled: $("audio").checked });
  if (!$("audio").checked) stopSound();
};
function frame() {
  const now = performance.now();
  try {
    if (game && !game.diagnostic && !document.hidden) {
      scheduler.advanceTo(now);
      effects();
      renderer.render(game);
      $("money-bin").disabled = game.scene !== "office";
      $("map").disabled = game.scene !== "office";
      $("back").disabled = game.scene === "departure";
      $("status").textContent =
        game.scene === "jungle"
          ? `Jungle · Arrow keys to move, climb, or drop · Fire to jump · Lives ${game.jungle.snapshot().lives} · Cash $${game.money}`
          : game.scene === "mountain"
            ? `Mountain · Arrow keys to move · Hold Fire to swing the hook; release to throw · Lives ${game.mountain.snapshot().lives} · Cash $${game.money}`
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
                        ? `Flight · ${game.flight.phase} · Hold Space for throttle · Down raises the nose; Up lowers it · Day ${game.flight.snapshot().day}`
                        : game.scene === "rival-claim"
                          ? `Glomgold has taken the treasure · Fire to continue`
                          : game.scene === "money-bin"
                            ? `Money bin · ${game.bin.phase} · Fire to dive`
                            : game.scene === "map"
                              ? `World map · Day ${game.campaign.day} · Cash $${game.money} · Banked $${game.campaign.banked} · ${game.campaign.selected === 35 ? "Office" : game.campaign.locations[game.campaign.selected].name} · ${game.campaign.snapshot().travelDays} travel days`
                              : `${game.scene === "office" ? "Office" : game.scene === "difficulty" ? "Choose difficulty" : "Press Space or Enter to start"} · Cash $${game.money.toLocaleString()}${game.rareCoinTaken ? " · Rare coin found" : ""}`;
      $("game").dataset.scene = game.scene;
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
