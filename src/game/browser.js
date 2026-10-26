import { parseLocations } from "./campaign.js";
import { Game } from "./application.js";
import { Scheduler } from "./scheduler.js";
import { Renderer } from "./renderer.js";
import { verifiedResources, REQUIRED_FILES } from "./resources.js";
import { renderSound, wavFile } from "../audio.js";
const $ = (id) => document.getElementById(id);
let game,
  renderer,
  resources,
  playing,
  scheduler,
  pausedAt = null;
const held = new Set();
function fatal(error) {
  if (game) game.fail(error);
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
      locations: parseLocations(resources.archives.get("LOC.ARC")),
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
  dispatch({ type: "direction", direction: null });
});
document.addEventListener("visibilitychange", () => {
  held.clear();
  const now = performance.now();
  if (document.hidden) {
    pausedAt = now;
    playing?.pause();
  } else if (pausedAt !== null) {
    scheduler?.pauseDuration(now - pausedAt);
    pausedAt = null;
  }
});
const sounds = new Map();
function effects() {
  for (const event of game.drainEffects()) {
    if (event.type === "stopAudio") playing?.pause();
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
      playing?.pause();
      playing = $("sound");
      playing.src = sounds.get(event.id);
      playing.volume = 0.35;
      playing
        .play()
        .catch((e) => fatal(new Error(`Audio playback: ${e.message}`)));
    }
  }
}
$("audio").onchange = () => {
  if (!$("audio").checked) playing?.pause();
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
        game.scene === "departure"
          ? `Departure confirmed · ${game.campaign.locations[game.departure.target].name} · ${game.departure.days} travel day(s) · ${game.departure.activity} expedition · Flight gameplay is not available yet. Restart to play again.`
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
