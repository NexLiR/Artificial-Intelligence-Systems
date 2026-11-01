import { appendFile, access, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG, playTurn, startGame } from "../app/api.js";
import { createStateFromSetup, DEFAULT_PREMISE, MAX_HP } from "../app/game.js";

const USAGE = "Використання: node rpg_bench.mjs --model <id> [--t 0.7] [--schema 0] [--base http://localhost:1234/v1]";

const DUNGEON_SETUP = {
  questTitle: "Зачистка печер",
  locations: ["Вхід до печер", "Тунель", "Камера полоненого", "Зала ватажка"],
  objectives: [
    { text: "Перемогти ватажка гоблінів", location: "Зала ватажка" },
    { text: "Звільнити полоненого старосту", location: "Камера полоненого" },
    { text: "Знайти скриню з печаткою села", location: "Зала ватажка" },
  ],
  inventory: ["ніж", "хліб", "смолоскип"],
};
const OPENING_SCENE =
  "Ти стоїш перед темним входом у печери за селом. З глибини тягне димом і чути гортанні голоси. Біля входу в тіні горить багаття.";

/**
 * Фіксовані кидки та дії, щоб обидві квантизації проходили однакові умови.
 * expect перевіряє суддю: feasible false для дій із предметом, якого немає, objective для номера цілі, яку дія просуває.
 */
const TURNS = [
  { roll: 12, action: "Заходжу у вхід до печер зі смолоскипом і прислухаюся" },
  { roll: 16, action: "Підкрадаюся до вартового гобліна біля входу й оглушаю його" },
  { roll: 4, action: "Намагаюся обшукати вартового, але він приходить до тями" },
  { roll: 10, action: "Дістаю арбалет і стріляю в гобліна", expect: { feasible: false } },
  { roll: 14, action: "Б'юся ножем із гобліном, що прокинувся" },
  { roll: 18, action: "Обшукую тіло гобліна" },
  { roll: 8, action: "Їм хліб, щоб відновити сили" },
  { roll: 13, action: "Іду вглиб печери до тунелю" },
  { roll: 2, action: "Наступаю на підозрілу плиту в підлозі" },
  { roll: 15, action: "Перев'язую рану" },
  { roll: 13, action: "Іду тунелем до камери полоненого" },
  { roll: 17, action: "Розмовляю з полоненим старостою через ґрати", expect: { objective: 1 } },
  { roll: 7, action: "Відчиняю камеру золотим ключем зі своєї кишені", expect: { feasible: false } },
  { roll: 19, action: "Вибиваю двері камери плечем і звільняю старосту", expect: { objective: 1 } },
  { roll: 11, action: "Прошу старосту розповісти, де ховається ватажок" },
  { roll: 9, action: "Крадуся до зали ватажка" },
  { roll: 1, action: "Кидаюся на ватажка в лоб", expect: { objective: 0 } },
  { roll: 14, action: "Відступаю за колону і кидаю в ватажка ніж", expect: { objective: 0 } },
  { roll: 20, action: "Добиваю ватажка", expect: { objective: 0 } },
  { roll: 16, action: "Обшукую залу в пошуках скрині з печаткою", expect: { objective: 2 } },
  { roll: 15, action: "Відчиняю скриню і беру печатку", expect: { objective: 2 } },
];

const get = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const model = get("model");
if (!model) {
  console.error(USAGE);
  process.exit(1);
}

const config = {
  ...DEFAULT_CONFIG,
  model,
  baseUrl: get("base", DEFAULT_CONFIG.baseUrl),
  temperature: Number(get("t", DEFAULT_CONFIG.temperature)),
  useJsonSchema: get("schema", "1") !== "0",
};

const hasCjk = (text) => /[㐀-鿿]/.test(text);
const lines = [];
const log = (text = "") => {
  console.log(text);
  lines.push(text);
};

log(`# RPG бенчмарк: ${config.model}`);
log();
log(`temperature ${config.temperature}, json_schema ${config.useJsonSchema ? "увімкнено" : "вимкнено"}`);
log();

log("## Генерація сценарію за описом гравця");
log(`Опис: ${DEFAULT_PREMISE}`);
let setupOk = false;
try {
  const { setup, opening, retried, seconds } = await startGame(config, DEFAULT_PREMISE);
  setupOk = true;
  log(`Квест: ${setup.questTitle}`);
  log(`Локації: ${setup.locations.join(" > ")}`);
  log(`Цілі: ${setup.objectives.map((objective) => `${objective.text} (${objective.location})`).join("; ")}`);
  log(`Предмети: ${setup.inventory.join(", ") || "немає"}`);
  log(`Сцена: ${opening}`);
  log(`${seconds.toFixed(1)} с${retried ? ", повторний запит" : ""}${hasCjk(opening + JSON.stringify(setup)) ? ", є китайські символи" : ""}`);
} catch (error) {
  log(`ПОМИЛКА: ${error.message}`);
}
log();

log(`## Прохід підземелля (фіксований сценарій, ${TURNS.length} ходів)`);
let state = createStateFromSetup(DUNGEON_SETUP, OPENING_SCENE);
const stats = {
  played: 0,
  failed: 0,
  retried: 0,
  rejected: 0,
  cjk: 0,
  trapsTotal: 0,
  trapsCaught: 0,
  falseImpossible: 0,
  objectiveExpected: 0,
  objectiveHits: 0,
  objectiveSteps: 0,
  seconds: [],
};

for (const [index, { roll, action, expect = {} }] of TURNS.entries()) {
  log();
  log(`### Хід ${index + 1} · d20 ${roll} · ${action}`);
  try {
    const turn = await playTurn(config, state, `[${roll}] ${action}`);
    const judged = turn.judgement;

    if (expect.feasible === false) {
      stats.trapsTotal += 1;
      if (!judged.feasible) stats.trapsCaught += 1;
    } else if (!judged.feasible) {
      stats.falseImpossible += 1;
    }
    if (expect.objective !== undefined) {
      stats.objectiveExpected += 1;
      if (judged.advancesObjective === expect.objective) stats.objectiveHits += 1;
    }
    if (hasCjk(turn.narration)) stats.cjk += 1;
    if (turn.retried) stats.retried += 1;

    state = turn.state;
    stats.played += 1;
    stats.rejected += turn.rejected.length;
    stats.objectiveSteps += turn.changes.filter((change) => change.startsWith("ціль")).length;
    stats.seconds.push(turn.seconds);

    log(
      `Суддя: feasible=${judged.feasible}, risky=${judged.risky}, ціль=${judged.advancesObjective}, використано="${judged.itemUsed}", знайдено="${judged.itemFound}", лікує=${judged.heals}`,
    );
    log(`Оповідач: ${turn.narration}`);
    log(`Зміни: ${turn.changes.join(", ") || "немає"}`);
    if (turn.rejected.length) log(`Відхилено кодом: ${turn.rejected.join("; ")}`);
    if (hasCjk(turn.narration)) log("Прапорець: китайські символи");
    log(
      `${turn.seconds.toFixed(1)} с${turn.retried ? ", повторний запит" : ""} · локація ${state.location}, HP ${state.hp}/${MAX_HP}, інвентар: ${state.inventory.join(", ") || "порожньо"}`,
    );
  } catch (error) {
    stats.failed += 1;
    log(`ПОМИЛКА ходу: ${error.message}`);
  }
  if (state.status !== "playing") {
    log();
    log(`Гру завершено на ході ${index + 1}: ${state.status === "won" ? "перемога" : "персонаж загинув"}`);
    break;
  }
}

const totalSeconds = stats.seconds.reduce((sum, value) => sum + value, 0);
const averageSeconds = stats.seconds.length ? totalSeconds / stats.seconds.length : 0;
const objectivesDone = state.quest.objectives.filter((objective) => objective.done).length;

log();
log("## Підсумок");
log("| Показник | Значення |");
log("| --- | --- |");
log(`| Генерація сценарію | ${setupOk ? "успішно" : "помилка"} |`);
log(`| Ходів зіграно / з помилкою | ${stats.played} / ${stats.failed} |`);
log(`| Ходів з повторним запитом (зламаний JSON) | ${stats.retried} |`);
log(`| Суддя: неможливі дії розпізнано | ${stats.trapsCaught} з ${stats.trapsTotal} |`);
log(`| Суддя: звичайні дії хибно визнано неможливими | ${stats.falseImpossible} |`);
log(`| Суддя: правильна ціль названо | ${stats.objectiveHits} з ${stats.objectiveExpected} |`);
log(`| Тверджень судді відхилено кодом | ${stats.rejected} |`);
log(`| Ходів із китайськими символами | ${stats.cjk} |`);
log(`| Середній час ходу, с | ${averageSeconds.toFixed(1)} |`);
log(`| Прийнято просувань цілей | ${stats.objectiveSteps} |`);
log(`| Цілей виконано | ${objectivesDone} з ${state.quest.objectives.length} |`);
log(`| Кінцевий стан | ${state.status}, HP ${state.hp}/${MAX_HP} |`);

const slug = config.model.replace(/[^a-z0-9]+/gi, "_");
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
await writeFile(here(`rpg_${slug}.md`), `${lines.join("\n")}\n`);

const csvPath = here("rpg_quality.csv");
const header =
  "model,temperature,json_schema,setup_ok,turns_played,turns_failed,retried,traps_caught,traps_total,false_impossible,objective_hits,objective_expected,rejected,cjk_turns,avg_seconds,objective_steps,objectives_done,final_status,final_hp\n";
const row = [
  config.model,
  config.temperature,
  config.useJsonSchema,
  setupOk,
  stats.played,
  stats.failed,
  stats.retried,
  stats.trapsCaught,
  stats.trapsTotal,
  stats.falseImpossible,
  stats.objectiveHits,
  stats.objectiveExpected,
  stats.rejected,
  stats.cjk,
  averageSeconds.toFixed(1),
  stats.objectiveSteps,
  objectivesDone,
  state.status,
  state.hp,
].join(",");
const exists = await access(csvPath).then(
  () => true,
  () => false,
);
if (!exists) await appendFile(csvPath, header);
await appendFile(csvPath, `${row}\n`);
console.log(`\nЗбережено: rpg_${slug}.md, rpg_quality.csv`);
