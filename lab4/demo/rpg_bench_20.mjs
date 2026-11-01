import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const USAGE =
  "Використання: node rpg_bench_many.mjs --model <id> [--runs 20] [--t 0.7] [--schema 0] [--base http://localhost:1234/v1]";

const get = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const model = get("model");
if (!model) {
  console.error(USAGE);
  process.exit(1);
}
const runs = Number(get("runs", 20));
const passThrough = ["t", "schema", "base"].flatMap((name) => {
  const value = get(name);
  return value === undefined ? [] : [`--${name}`, value];
});

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const slug = model.replace(/[^a-z0-9]+/gi, "_");
const csvPath = here("rpg_quality.csv");
const runsDir = here("runs/");

async function readRows() {
  let text;
  try {
    text = await readFile(csvPath, "utf-8");
  } catch {
    return [];
  }
  const [header, ...lines] = text.trim().split("\n");
  const columns = header.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [columns[index], value])));
}

await mkdir(runsDir, { recursive: true });
const results = [];

for (let run = 1; run <= runs; run += 1) {
  const rowsBefore = (await readRows()).length;
  spawnSync(process.execPath, [here("rpg_bench.mjs"), "--model", model, ...passThrough], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  const rows = await readRows();
  if (rows.length !== rowsBefore + 1) {
    console.log(`Запуск ${run}/${runs}: бенчмарк не записав результат, пропущено`);
    continue;
  }
  const row = rows.at(-1);
  results.push(row);
  await copyFile(here(`rpg_${slug}.md`), `${runsDir}rpg_${slug}_${String(run).padStart(2, "0")}.md`);
  console.log(
    `Запуск ${run}/${runs}: ${row.final_status}, ціль ${row.objective_hits}/${row.objective_expected}, неможливі ${row.traps_caught}/${row.traps_total}, ${row.avg_seconds} с/хід`,
  );
}

if (results.length === 0) {
  console.error("Жодного успішного запуску. Перевірте, що LM Studio запущено й модель завантажено.");
  process.exit(1);
}

const numbers = (key) => results.map((row) => Number(row[key]));
const sum = (values) => values.reduce((total, value) => total + value, 0);
const mean = (values) => sum(values) / values.length;
const fixed = (value) => value.toFixed(2);

const MEASURES = [
  ["Ходів зіграно", "turns_played"],
  ["Ходів з помилкою запиту", "turns_failed"],
  ["Ходів з повторним запитом (зламаний JSON)", "retried"],
  ["Тверджень судді відхилено кодом", "rejected"],
  ["Ходів із китайськими символами", "cjk_turns"],
  ["Прийнято просувань цілей", "objective_steps"],
  ["Цілей виконано (з 3)", "objectives_done"],
  ["Кінцевий HP", "final_hp"],
  ["Середній час ходу, с", "avg_seconds"],
];

const lines = [
  `# RPG бенчмарк, ${results.length} запусків: ${model}`,
  "",
  `Перемог: ${results.filter((row) => row.final_status === "won").length} з ${results.length}. Загиблих: ${results.filter((row) => row.final_status === "dead").length}. Успішних генерацій сценарію: ${results.filter((row) => row.setup_ok === "true").length} з ${results.length}.`,
  "",
  `Неможливі дії розпізнано суддею: ${sum(numbers("traps_caught"))} з ${sum(numbers("traps_total"))}. Правильну ціль названо: ${sum(numbers("objective_hits"))} з ${sum(numbers("objective_expected"))}. Звичайних дій хибно визнано неможливими: ${sum(numbers("false_impossible"))}.`,
  "",
  "| Показник | Середнє | Мін | Макс |",
  "| --- | --- | --- | --- |",
  ...MEASURES.map(([label, key]) => {
    const values = numbers(key);
    return `| ${label} | ${fixed(mean(values))} | ${Math.min(...values)} | ${Math.max(...values)} |`;
  }),
];

await writeFile(here(`rpg_summary_${slug}.md`), `${lines.join("\n")}\n`);
console.log(`\n${lines.join("\n")}\n\nЗбережено: rpg_summary_${slug}.md, транскрипти в runs/`);
