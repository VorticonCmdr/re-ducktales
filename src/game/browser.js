import {
  heldControlEvent,
  ordinaryMakeEvent,
  ordinaryScanCodeForKey,
  mapKeyEvent,
  expeditionKeyEvent,
} from "./keyboard-adapter.js";
import { parseLocations, parseLoot } from "./campaign.js";
import { Game } from "./application.js";
import { Scheduler } from "./scheduler.js";
import { Renderer } from "./renderer.js";
import { verifiedResources, REQUIRED_FILES } from "./resources.js";
import { parseCaveMaps } from "./cave-scene.js";
import { investmentResources } from "./investments.js";
import { GameTandyAudio } from "./tandy-audio.js";
import { GameSpeakerAudio } from "./speaker-audio.js";
const $ = (id) => document.getElementById(id);
let game,
  renderer,
  resources,
  scheduler,
  pausedAt = null;
let gameAudio,
  deviceGeneration = 0,
  pendingAudioInput = null;
function ensureGameAudio() {
  if (gameAudio?.disposed) gameAudio = null;
  if (!gameAudio && resources) {
    const generation = ++deviceGeneration;
    const isTandy = $("audio-device").value === "tandy";
    const Device = isTandy ? GameTandyAudio : GameSpeakerAudio;
    gameAudio = new Device(
      resources.archives.get("IT.DRV")[isTandy ? 4 : 5].data,
      {
        status: (token, busy) =>
          dispatch({ type: "audio-status", token, busy }),
        stats: (values) => {
          if (generation !== deviceGeneration) return;
          $("sound").dataset.device = $("audio-device").value;
          for (const [key, value] of Object.entries(values))
            if (value !== undefined) $("sound").dataset[key] = String(value);
        },
        fail: fatal,
        observe: (event) =>
          $("sound").dispatchEvent(
            new CustomEvent("gameaudio", { detail: event, bubbles: true }),
          ),
      },
    );
  }
  return gameAudio;
}
function unlockGameAudio() {
  try {
    ensureGameAudio()?.unlock();
  } catch (error) {
    fatal(error);
  }
}
const held = new Set();
const reportedSecurityCodes = new WeakSet();
function flightControls() {
  dispatch(
    heldControlEvent(held, game?.scene === "office" && !!game.officeMenu),
  );
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
  gameAudio?.close();
}
function dispatch(event) {
  if (!game) return;
  try {
    scheduler.enqueue(event, performance.now());
  } catch (e) {
    fatal(e);
  }
}
function expeditionButton(key) {
  dispatch(expeditionKeyEvent(key, true));
  dispatch(expeditionKeyEvent(key, false));
}
function present(state) {
  renderer.render(state);
  $("game").dataset.mapInput =
    state.scene === "map" ? JSON.stringify(state.campaign.mapInputState()) : "";
  $("game").dispatchEvent(
    new CustomEvent("gamepresent", { detail: state.snapshot() }),
  );
}
async function load(read) {
  try {
    $("status").textContent = "Checking original files…";
    resources = await verifiedResources(read);
    gameAudio?.close();
    gameAudio = null;
    pendingAudioInput = null;
    game = new Game({
      biosSeed: 0,
      expeditionInput: "keyboard",
      destinationInput: "keyboard",
      openingResources: {
        image: resources.executable,
        entries: resources.archives.get("MAIN.ARC"),
      },
      bankResources: {
        image: resources.executable,
        entries: resources.archives.get("MAC.ARC"),
      },
      audioEnabled: $("audio").checked,
      originalSecurity: $("original-security").checked,
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
$("fire").onclick = () => {
  if (game?.usesExpeditionKeyboard) expeditionButton("Space");
  else dispatch({ type: "fire", direction: held.has("ArrowUp") ? "up" : null });
};
$("map").onclick = () => dispatch({ type: "map" });
$("investments").onclick = () => dispatch({ type: "investments" });
$("left").onclick = () => {
  if (game?.usesExpeditionKeyboard) expeditionButton("ArrowLeft");
  else
    dispatch(
      game?.scene === "map" && !game.campaign.info
        ? { type: "step", direction: "left" }
        : { type: "left" },
    );
};
$("right").onclick = () => {
  if (game?.usesExpeditionKeyboard) expeditionButton("ArrowRight");
  else
    dispatch(
      game?.scene === "map" && !game.campaign.info
        ? { type: "step", direction: "right" }
        : { type: "right" },
    );
};
$("back").onclick = () => {
  dispatch({ type: "back" });
  $("game").focus();
};
$("pause").onclick = () => dispatch({ type: "pause" });
$("original-security").onchange = () =>
  dispatch({
    type: "original-security",
    enabled: $("original-security").checked,
  });
$("quit").onclick = () => dispatch({ type: "quit" });
$("quit-yes").onclick = () => dispatch({ type: "quit-yes" });
$("quit-no").onclick = () => dispatch({ type: "quit-no" });
$("up").onclick = () => {
  if (game?.usesExpeditionKeyboard) expeditionButton("ArrowUp");
  else
    dispatch(
      game?.scene === "map"
        ? { type: "step", direction: "up" }
        : { type: "up" },
    );
};
$("down").onclick = () => {
  if (game?.usesExpeditionKeyboard) expeditionButton("ArrowDown");
  else
    dispatch(
      game?.scene === "map"
        ? { type: "step", direction: "down" }
        : { type: "down" },
    );
};
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
    ].includes(event.code) &&
    !(
      ordinaryScanCodeForKey(event.code) !== undefined &&
      (game?.scene === "office" ||
        game?.scene === "map" ||
        game?.usesExpeditionKeyboard)
    )
  )
    return;
  if (event.target instanceof HTMLInputElement) return;
  if (event.target instanceof HTMLSelectElement) return;
  if ($("audio").checked || event.code === "KeyS") unlockGameAudio();
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
  if (game?.usesExpeditionKeyboard) {
    dispatch(expeditionKeyEvent(event.code, true));
    return;
  }
  if (game?.scene === "map") {
    dispatch(mapKeyEvent(event.code, true));
    return;
  }
  if (event.repeat) return;
  dispatch(
    ordinaryMakeEvent(
      event.code,
      held,
      game?.scene === "office" && !!game.officeMenu,
    ),
  );
});
window.addEventListener("keyup", (event) => {
  held.delete(event.code);
  flightControls();
  if (
    game?.usesExpeditionKeyboard &&
    ordinaryScanCodeForKey(event.code) !== undefined
  ) {
    dispatch(expeditionKeyEvent(event.code, false));
    return;
  }
  if (game?.scene === "map" && ordinaryScanCodeForKey(event.code) !== undefined)
    dispatch(mapKeyEvent(event.code, false));
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
  if (game?.scene === "map") dispatch({ type: "flush-map-keys" });
  if (game?.usesExpeditionKeyboard) dispatch({ type: "flush-expedition-keys" });
});
document.addEventListener("visibilitychange", () => {
  held.clear();
  flightControls();
  if (game?.scene === "map") dispatch({ type: "flush-map-keys" });
  if (game?.usesExpeditionKeyboard) dispatch({ type: "flush-expedition-keys" });
  const now = performance.now();
  if (document.hidden) {
    pausedAt = now;
    gameAudio?.setSuspended(true);
  } else if (pausedAt !== null) {
    scheduler?.pauseDuration(now - pausedAt);
    pausedAt = null;
    gameAudio?.setSuspended(false);
  }
});
function stopSound() {
  if (gameAudio && !gameAudio.disposed) gameAudio.request(0);
}
function effects() {
  // A browser hint only: never add a diagnostic event to deterministic replays.
  if (game.security?.setup && !reportedSecurityCodes.has(game.security)) {
    console.log(
      `Security System: correct code is ${game.security.setup.target}`,
    );
    reportedSecurityCodes.add(game.security);
  }
  for (const event of game.drainEffects()) {
    if (event.type === "flushControls") held.clear();
    if (event.type === "stopAudio") stopSound();
    if (event.type === "sound" && game.audioEnabled) {
      ensureGameAudio().request(
        event.argument ?? event.id,
        event.token ?? null,
      );
    }
  }
}
$("audio").onchange = () => {
  if ($("audio").checked) unlockGameAudio();
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
  const previous = gameAudio;
  gameAudio = null;
  previous?.stopAndClose().catch(fatal);
  $("sound").dataset.device = $("audio-device").value;
};
window.addEventListener("pagehide", () => gameAudio?.close());
function frame() {
  const now = performance.now();
  try {
    if (game && !game.diagnostic && !document.hidden) {
      scheduler.advanceTo(now);
      effects();
      renderer.render(game);
      const overlay = game.systemOverlay;
      const destination =
        game.scene === "map" ? game.campaign.destinationWaits : null;
      const destinationInteractive =
        destination?.interactive ?? destination?.ready;
      const mapTitle = !destination
        ? "World map"
        : destination.confirming
          ? "Preparing departure…"
          : destinationInteractive
            ? "Choose how to travel"
            : ["wipe", "reveal", "entry-flip"].includes(destination.phase)
              ? "Opening destination…"
              : "Changing travel choice…";
      for (const id of ["fire", "up", "down", "left", "right"])
        $(id).disabled =
          !!overlay ||
          game.security?.outcome?.code === 0 ||
          game.scene === "departure" ||
          !!(
            game.scene === "map" &&
            game.campaign.destinationWaits &&
            !destinationInteractive
          );
      $("money-bin").disabled = !!overlay || game.scene !== "office";
      $("map").disabled = !!overlay || game.scene !== "office";
      $("investments").disabled = !!overlay || game.scene !== "office";
      $("back").disabled =
        !!overlay ||
        !!(
          game.scene === "map" && game.campaign.destinationWaits?.confirming
        ) ||
        [
          "departure",
          "ending",
          "bank",
          "office-departure",
          "security",
        ].includes(game.scene);
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
        : game.scene === "office-departure"
          ? game.officeDeparture.action === "map"
            ? "Entering the control center…"
            : game.officeDeparture.action === "investments"
              ? "Opening investments…"
              : "Entering the money bin…"
          : game.scene === "security"
            ? game.security.outcome?.code === 0
              ? "Security check failed · Restart to play again"
              : "Security system · Arrows choose · Fire confirms"
            : game.scene === "bank"
              ? `Macaroon bank · Banked $${game.bank.banked} · Glomgold $${game.bank.rivalBanked} · ${game.bank.ready ? "Fire to continue" : "Counting deposits"}`
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
                            ? `Departure confirmed · ${game.campaign.locations[game.departure.target].name} · ${game.departure.days} travel day(s) · Preparing flight…`
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
                                      : [
                                            "rival-claim",
                                            "rival-report",
                                          ].includes(game.scene)
                                        ? `Glomgold has taken the treasure · Fire to continue`
                                        : game.scene === "money-bin"
                                          ? `Money bin · ${game.bin.phase} · Fire to dive`
                                          : game.scene === "map"
                                            ? `${mapTitle} · Day ${game.campaign.day} · Cash $${game.money} · Banked $${game.campaign.banked} · ${game.campaign.selected === 35 ? "Office" : game.campaign.locations[game.campaign.selected].name} · ${game.campaign.snapshot().travelDays} travel days`
                                            : `${game.scene === "office" ? "Office" : game.scene === "difficulty" ? "Choose difficulty" : game.opening ? "Opening · Space or Enter to skip" : "Press Space or Enter to start"} · Cash $${game.money.toLocaleString()}${game.rareCoinTaken ? " · Rare coin found" : ""}`;
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
