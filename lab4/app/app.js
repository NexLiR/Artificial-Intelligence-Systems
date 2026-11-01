import { DEFAULT_CONFIG, playTurn, startGame } from "./api.js";
import { DEFAULT_PREMISE, MAX_HP, OBJECTIVE_STEPS } from "./game.js";

const MODELS = [
  { id: "qwen3-8b@q4_k_m", label: "Q4_K_M" },
  { id: "qwen3-8b@q8_0", label: "Q8_0" },
];
const STATE_KEY = "rpg-state";
const MODEL_KEY = "rpg-model";

const params = new URLSearchParams(location.search);
const CONFIG = {
  ...DEFAULT_CONFIG,
  model: params.get("model") ?? readStorage(MODEL_KEY) ?? DEFAULT_CONFIG.model,
  temperature: params.has("t") ? Number(params.get("t")) : DEFAULT_CONFIG.temperature,
  useJsonSchema: params.get("schema") !== "0",
};
if (!MODELS.some((model) => model.id === CONFIG.model)) MODELS.push({ id: CONFIG.model, label: CONFIG.model });

const $ = (id) => document.getElementById(id);

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

let state = loadState();

function isValidState(value) {
  return (
    value &&
    typeof value.hp === "number" &&
    typeof value.scene === "string" &&
    Array.isArray(value.inventory) &&
    Array.isArray(value.locations) &&
    Array.isArray(value.quest?.objectives) &&
    value.quest.objectives.every(
      (objective) =>
        typeof objective.text === "string" &&
        typeof objective.location === "string" &&
        typeof objective.progress === "number" &&
        typeof objective.done === "boolean",
    )
  );
}

function loadState() {
  try {
    const saved = JSON.parse(readStorage(STATE_KEY) ?? "null");
    if (isValidState(saved)) return saved;
  } catch {}
  return null;
}

function saveState() {
  writeStorage(STATE_KEY, state ? JSON.stringify(state) : null);
}

function shortModelName(id) {
  return MODELS.find((model) => model.id === id)?.label ?? id;
}

function addEntry(kind, text) {
  const entry = document.createElement("div");
  entry.className = `entry ${kind}`;
  entry.textContent = text;
  $("log").append(entry);
  entry.scrollIntoView({ block: "end" });
  return entry;
}

function renderStatus() {
  $("hp-bar").max = MAX_HP;
  $("hp-bar").value = state.hp;
  $("hp").textContent = `${state.hp}/${MAX_HP}`;
  $("map").textContent = state.locations.join(" > ");
  $("location").textContent = state.location;
  $("inventory").textContent = state.inventory.length ? state.inventory.join(", ") : "порожньо";
  $("quest").textContent = [
    state.quest.title,
    ...state.quest.objectives.map(
      (objective) =>
        `[${objective.done ? "x" : " "}] ${objective.text} (${objective.location}, ${objective.progress}/${OBJECTIVE_STEPS})`,
    ),
  ].join("\n");
  const finished = state.status !== "playing";
  $("input").disabled = finished;
  $("send").disabled = finished;
}

function showScreen() {
  $("setup").hidden = state !== null;
  $("game").hidden = state === null;
  if (state) renderStatus();
}

function announceEnd() {
  if (state.status === "won") addEntry("system", "Усі цілі виконано. Перемога! Натисніть «Нова гра», щоб почати знову.");
  if (state.status === "dead") addEntry("system", "HP закінчилися. Гру завершено. Натисніть «Нова гра».");
}

function initModelSelect() {
  for (const model of MODELS) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    $("model").append(option);
  }
  $("model").value = CONFIG.model;
  $("model").addEventListener("change", () => {
    CONFIG.model = $("model").value;
    writeStorage(MODEL_KEY, CONFIG.model);
  });
}

initModelSelect();
$("premise").value = DEFAULT_PREMISE;

$("start").addEventListener("click", async () => {
  const premise = $("premise").value.trim();
  if (!premise) {
    $("setup-error").textContent = "Опишіть сценарій хоча б одним реченням.";
    return;
  }

  $("setup-error").textContent = "";
  $("start").disabled = true;
  $("start").textContent = "Генерую сценарій…";
  try {
    const result = await startGame({ ...CONFIG }, premise);
    state = result.state;
    saveState();
    $("log").replaceChildren();
    addEntry("narration", state.scene);
    const note = result.retried ? " · повторний запит через некоректну відповідь" : "";
    addEntry("meta", `${shortModelName(CONFIG.model)} · сценарій згенеровано за ${result.seconds.toFixed(1)} с${note}`);
    showScreen();
    announceEnd();
    $("input").focus();
  } catch (error) {
    $("setup-error").textContent = `Помилка: ${error.message}`;
  }
  $("start").disabled = false;
  $("start").textContent = "Почати гру";
});

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = $("input").value.trim();
  if (!text) return;

  $("input").value = "";
  $("send").disabled = true;
  $("input").disabled = true;
  addEntry("player", text);
  const pending = addEntry("pending", "Оповідач пише…");
  try {
    const turn = await playTurn({ ...CONFIG }, state, text);
    state = turn.state;
    saveState();

    const meta = [shortModelName(CONFIG.model), `d20: ${turn.roll}`, turn.changes.length ? turn.changes.join(", ") : "без змін"];
    if (turn.rejected.length) meta.push(`відхилено: ${turn.rejected.join("; ")}`);
    if (turn.retried) meta.push("повторний запит через некоректну відповідь");
    meta.push(`${turn.seconds.toFixed(1)} с`);
    addEntry("narration", turn.narration);
    addEntry("meta", meta.join(" · "));
  } catch (error) {
    addEntry("error", `Помилка: ${error.message}`);
    $("input").value = text;
  }
  pending.remove();
  renderStatus();
  announceEnd();
  if (state.status === "playing") $("input").focus();
});

$("restart").addEventListener("click", () => {
  state = null;
  saveState();
  showScreen();
});

if (state) {
  addEntry("narration", state.scene);
  announceEnd();
}
showScreen();
