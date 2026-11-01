export const MAX_HP = 20;
export const MAX_INVENTORY = 8;
export const OBJECTIVE_STEPS = 2;
export const MIN_ADVANCE_ROLL = 8;
export const MIN_MOVE_ROLL = 4;
export const MIN_FIND_ROLL = 15;
export const HEAL_AMOUNT = 3;
export const SCENE_LIMIT = 600;
export const SETUP_MAX_TOKENS = 600;
export const JUDGE_MAX_TOKENS = 200;
export const OPENING_MAX_TOKENS = 250;
export const DEFAULT_PREMISE =
  "Я лицар із мечем та зіллям відновлення. У печерах за селом оселилися гобліни. Треба зачистити підземелля: убити ватажка та звільнити полоненого старосту.";

const RECENT_EVENTS_LIMIT = 5;
const ITEM_NAME_LIMIT = 30;
const LOCATION_LIMIT = 60;
const EVENT_LIMIT = 140;
const OBJECTIVE_LIMIT = 120;
const MIN_LOCATIONS = 2;
const MAX_LOCATIONS = 5;
const MAX_OBJECTIVES = 4;
const MAX_START_ITEMS = 4;

const MOVE_VERB_PREFIXES = [
  "йд", "ід", "крад", "заход", "біж", "вируша", "рушаю", "прямую", "спуска", "пробира", "перехо",
  "повертаю", "відступ", "входж", "виходж", "підходж", "прохо",
];
const FORWARD_WORDS = ["далі", "вглиб", "глибше", "вперед"];
const BACK_WORDS = ["назад", "вихід", "виходжу", "повертаюся"];

const TIERS = {
  critical: { text: "КРИТИЧНИЙ ПРОВАЛ: дія не вдалася і має серйозні наслідки для гравця", short: "серйозний провал", damage: 4 },
  failure: { text: "ПРОВАЛ: дія не вдалася", short: "провал", damage: 2 },
  partial: { text: "ЧАСТКОВА УДАЧА: мета досягнута не повністю або з ціною", short: "часткова удача", damage: 1 },
  success: { text: "УСПІХ: дія вдалася", short: "успіх", damage: 0 },
  bonus: { text: "УСПІХ ІЗ БОНУСОМ: дія вдалася блискуче", short: "успіх із бонусом", damage: 0 },
  impossible: {
    text: "ДІЯ НЕМОЖЛИВА: гравець не може так вчинити (немає предмета чи можливості), дія не вдається",
    short: "дія неможлива",
    damage: 0,
  },
};

export const SETUP_SYSTEM_PROMPT = `Ти створюєш початок текстової RPG за описом гравця. Пиши літературною українською.
Правила:
1. locations: від 3 до 4 локацій по порядку від входу вглиб. Перша локація стартова. Назви короткі й різні.
2. objectives: від 2 до 4 цілей. Кожна ціль це одна перевірювана дія («Перемогти ватажка гоблінів») і має поле location з назвою однієї з locations, де ціль можна виконати.
3. inventory: від 1 до 4 простих стартових предметів зі слів гравця.
Відповідай лише JSON за схемою.`;

export const SETUP_SCHEMA = {
  type: "object",
  properties: {
    quest_title: { type: "string" },
    locations: { type: "array", items: { type: "string" } },
    objectives: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, location: { type: "string" } },
        required: ["text", "location"],
      },
    },
    inventory: { type: "array", items: { type: "string" } },
  },
  required: ["quest_title", "locations", "objectives", "inventory"],
};

export const OPENING_SYSTEM_PROMPT = `Ти оповідач текстової RPG. Пиши українською, 2-5 речень, звертайся до гравця на «ти» («ти стоїш», «ти чуєш»). Опиши лише місце, де гравець починає: що він бачить і чує. Не згадуй цілі квесту та їхніх героїв і нічого не вирішуй. Без списків і без JSON.`;

export const JUDGE_SYSTEM_PROMPT = `Ти суддя текстової RPG. За станом гри й дією гравця заповни JSON. Оповідь не пиши.
Поля:
- feasible: false, якщо дія неможлива: гравець користується предметом, якого немає в його інвентарі, застосовує магію, телепортацію чи надздібності, або вбиває багатьох ворогів одним ударом. Інакше true.
- risky: true, якщо дія небезпечна (бій, пастка, підкрадання повз ворога, злам, стрибок). Інакше false.
- advances_objective: номер цілі зі списку objectives, до якої дія безпосередньо наближає гравця, або -1.
- item_used: назва предмета, який дія знищує: з'їдено, випито, кинуто, зламано. Предмет, яким просто користуються (б'ються ножем, світять смолоскипом), не витрачається, тоді порожній рядок. Назва має бути з інвентаря; якщо потрібного предмета в інвентарі немає, став feasible false.
- item_found: назва простого предмета, який гравець міг би знайти, якщо дія це обшук, або порожній рядок.
- heals: true, якщо дія лікує (їжа, перев'язка, відпочинок). Інакше false.
Відповідай лише JSON за схемою.`;

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    feasible: { type: "boolean" },
    risky: { type: "boolean" },
    advances_objective: { type: "integer" },
    item_used: { type: "string" },
    item_found: { type: "string" },
    heals: { type: "boolean" },
  },
  required: ["feasible", "risky", "advances_objective", "item_used", "item_found", "heals"],
};

export const NARRATOR_SYSTEM_PROMPT = `Ти оповідач текстової RPG. Пиши українською, 3-6 речень, звертайся до гравця на «ти» («ти відчуваєш», «ти стоїш»). Без списків і без JSON.
Правила:
1. Опиши лише те, що сказано в РЕЗУЛЬТАТІ. Не вигадуй інших наслідків: нових предметів, нових поранень, смертей, звільнень, перемог.
2. Вердикт обовʼязковий. Провал означає, що дія не вдалася. ДІЯ НЕМОЖЛИВА означає, що ти пояснюєш, чому гравець не може так вчинити.
3. Продовжуй ПОПЕРЕДНЮ СЦЕНУ й не суперечь їй та ОСТАННІМ ПОДІЯМ.
4. Герої та предмети цілей присутні лише в локації цієї цілі.`;

export function createStateFromSetup(setup, openingScene) {
  return {
    turn: 0,
    status: "playing",
    location: setup.locations[0],
    locations: [...setup.locations],
    hp: MAX_HP,
    inventory: [...setup.inventory],
    quest: {
      title: setup.questTitle,
      objectives: setup.objectives.map(({ text, location }) => ({ text, location, progress: 0, done: false })),
      done: false,
    },
    scene: openingScene,
    recentEvents: [],
  };
}

export function rollD20() {
  return 1 + Math.floor(Math.random() * 20);
}

export function extractRoll(input) {
  const match = input.match(/^\[(\d{1,2})\]\s*([\s\S]*)$/);
  if (match) {
    const roll = Number(match[1]);
    if (roll >= 1 && roll <= 20) return { roll, action: match[2].trim() };
  }
  return { roll: rollD20(), action: input.trim() };
}

function describeObjective(objective, index) {
  const status = objective.done ? "виконано" : `прогрес ${objective.progress}/${OBJECTIVE_STEPS}`;
  return `${index}: ${objective.text} (локація: ${objective.location}) [${status}]`;
}

export function buildSetupMessages(premise) {
  return [
    { role: "system", content: SETUP_SYSTEM_PROMPT },
    { role: "user", content: `ОПИС ГРАВЦЯ:\n${premise.trim()}\n\n/no_think` },
  ];
}

export function buildOpeningMessages(premise, setup) {
  const content = [
    `ОПИС ГРАВЦЯ:\n${premise.trim()}`,
    `СТАРТОВА ЛОКАЦІЯ: ${setup.locations[0]}`,
    `ІНВЕНТАР: ${setup.inventory.join(", ") || "порожньо"}`,
    "/no_think",
  ].join("\n\n");
  return [
    { role: "system", content: OPENING_SYSTEM_PROMPT },
    { role: "user", content },
  ];
}

export function buildJudgeMessages(state, action) {
  const snapshot = {
    location: state.location,
    locations: state.locations,
    inventory: state.inventory,
    objectives: state.quest.objectives.map(describeObjective),
  };
  return [
    { role: "system", content: JUDGE_SYSTEM_PROMPT },
    { role: "user", content: `СТАН ГРИ:\n${JSON.stringify(snapshot)}\n\nДІЯ ГРАВЦЯ: ${action}\n\n/no_think` },
  ];
}

export function buildNarratorMessages(previousState, result, action) {
  const after = result.state;
  const objectivesHere = after.quest.objectives
    .filter((objective) => objective.location === after.location && !objective.done)
    .map((objective) => `${objective.text} (етап ${objective.progress}/${OBJECTIVE_STEPS})`);
  const events = previousState.recentEvents.length
    ? previousState.recentEvents.map((event) => `- ${event}`).join("\n")
    : "- (поки нічого)";
  const content = [
    `ПОПЕРЕДНЯ СЦЕНА:\n${previousState.scene}`,
    `ОСТАННІ ПОДІЇ:\n${events}`,
    `ЛОКАЦІЯ ПІСЛЯ ДІЇ: ${after.location}`,
    `ЦІЛІ В ЦІЙ ЛОКАЦІЇ: ${objectivesHere.join("; ") || "немає"}`,
    `ІНВЕНТАР ГРАВЦЯ: ${after.inventory.join(", ") || "порожньо"}`,
    `ДІЯ ГРАВЦЯ: ${action}`,
    `РЕЗУЛЬТАТ (визначено грою, не змінюй):\n${result.facts.map((fact) => `- ${fact}`).join("\n")}`,
    "/no_think",
  ].join("\n\n");
  return [
    { role: "system", content: NARRATOR_SYSTEM_PROMPT },
    { role: "user", content },
  ];
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clean(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function readStrings(raw) {
  return Array.isArray(raw) ? raw.filter((item) => typeof item === "string" && item.trim()) : [];
}

const wordsOf = (text) => text.toLowerCase().match(/[\p{L}'’ʼ]+/gu) ?? [];

function sameStem(a, b) {
  if (a.length < 3 || b.length < 3) return false;
  const length = Math.min(a.length, b.length) >= 5 ? 4 : 3;
  return a.slice(0, length) === b.slice(0, length);
}

function findByName(names, wanted) {
  const query = wanted.trim().toLowerCase();
  if (!query) return undefined;
  return names.find((name) => {
    const known = name.toLowerCase();
    return known === query || known.includes(query) || query.includes(known);
  });
}

function findItemIndex(inventory, name) {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return -1;
  return inventory.findIndex((item) => {
    const owned = item.toLowerCase();
    return owned.includes(wanted) || wanted.includes(owned);
  });
}

export function parseSetup(text) {
  const data = extractJsonObject(text);
  if (!data) return null;

  const locations = [...new Set(readStrings(data.locations).map((name) => name.trim().slice(0, LOCATION_LIMIT)))].slice(
    0,
    MAX_LOCATIONS,
  );
  const objectives = (Array.isArray(data.objectives) ? data.objectives : [])
    .map((objective) => ({
      text: clean(objective?.text, OBJECTIVE_LIMIT),
      location: findByName(locations, clean(objective?.location, LOCATION_LIMIT)),
    }))
    .filter((objective) => objective.text && objective.location)
    .slice(0, MAX_OBJECTIVES);
  const inventory = [...new Set(readStrings(data.inventory).map((item) => item.trim().slice(0, ITEM_NAME_LIMIT)))].slice(
    0,
    MAX_START_ITEMS,
  );
  const questTitle = clean(data.quest_title, LOCATION_LIMIT);

  if (locations.length < MIN_LOCATIONS || objectives.length === 0 || !questTitle) return null;
  return { questTitle, locations, objectives, inventory };
}

export function parseJudgement(text) {
  const data = extractJsonObject(text);
  if (!data || typeof data.feasible !== "boolean") return null;
  return {
    feasible: data.feasible,
    risky: data.risky === true,
    advancesObjective: Number.isInteger(data.advances_objective) ? data.advances_objective : -1,
    itemUsed: clean(data.item_used, ITEM_NAME_LIMIT),
    itemFound: clean(data.item_found, ITEM_NAME_LIMIT),
    heals: data.heals === true,
  };
}

export function cleanNarration(text) {
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (result && !/[.!?…»"”)]$/.test(result)) {
    const lastEnd = Math.max(...[".", "!", "?", "…"].map((mark) => result.lastIndexOf(mark)));
    if (lastEnd > 0) result = result.slice(0, lastEnd + 1);
  }
  return result;
}

export function findDestination(state, action) {
  const words = wordsOf(action);
  if (!words.some((word) => MOVE_VERB_PREFIXES.some((prefix) => word.startsWith(prefix)))) return null;

  let best = null;
  for (const name of state.locations) {
    if (name === state.location) continue;
    const nameWords = wordsOf(name).filter((word) => word.length >= 4);
    let lastMatch = -1;
    words.forEach((word, index) => {
      if (nameWords.some((nameWord) => sameStem(nameWord, word))) lastMatch = index;
    });
    if (lastMatch !== -1 && (!best || lastMatch > best.lastMatch)) best = { name, lastMatch };
  }
  if (best) return best.name;

  const current = state.locations.indexOf(state.location);
  if (words.some((word) => FORWARD_WORDS.includes(word))) return state.locations[current + 1] ?? null;
  if (words.some((word) => BACK_WORDS.includes(word))) return state.locations[current - 1] ?? null;
  return null;
}

function tierFor(roll) {
  if (roll === 1) return TIERS.critical;
  if (roll <= 7) return TIERS.failure;
  if (roll <= 14) return TIERS.partial;
  if (roll <= 19) return TIERS.success;
  return TIERS.bonus;
}

export function resolveTurn(state, judgement, action, roll) {
  const next = structuredClone(state);
  const changes = [];
  const rejected = [];
  const missingItem = judgement.feasible && judgement.itemUsed && findItemIndex(next.inventory, judgement.itemUsed) === -1;
  if (missingItem) rejected.push(`немає в інвентарі: «${judgement.itemUsed}»`);
  const feasible = judgement.feasible && !missingItem;
  const tier = feasible ? tierFor(roll) : TIERS.impossible;
  const facts = [`Вердикт: ${tier.text}`];

  if (feasible && judgement.risky && tier.damage > 0) {
    next.hp = Math.max(0, next.hp - tier.damage);
    changes.push(`HP -${tier.damage}`);
    facts.push(`Гравець отримує шкоду: ${tier.damage} HP`);
  }

  if (feasible && judgement.heals && roll >= MIN_ADVANCE_ROLL && next.hp > 0) {
    const gained = Math.min(HEAL_AMOUNT, MAX_HP - next.hp);
    if (gained > 0) {
      next.hp += gained;
      changes.push(`HP +${gained}`);
      facts.push("Гравець відновлює частину здоровʼя");
    }
  }

  if (feasible && judgement.itemUsed) {
    const index = findItemIndex(next.inventory, judgement.itemUsed);
    changes.push(`- ${next.inventory[index]}`);
    facts.push(`Предмет «${next.inventory[index]}» витрачено або втрачено`);
    next.inventory.splice(index, 1);
  }

  const destination = feasible ? findDestination(next, action) : null;
  if (destination) {
    if (roll >= MIN_MOVE_ROLL) {
      facts.push(`Гравець переходить у локацію «${destination}»`);
      changes.push(`локація: ${destination}`);
      next.location = destination;
    } else {
      facts.push(`Гравець хоче перейти в «${destination}», але перехід не вдається, він лишається в «${next.location}»`);
    }
  }

  if (feasible && judgement.advancesObjective !== -1) {
    const index = judgement.advancesObjective;
    const objective = next.quest.objectives[index];
    if (!objective) {
      rejected.push(`немає цілі з номером ${index}`);
    } else if (objective.done) {
      rejected.push(`ціль ${index} уже виконана`);
    } else if (roll < MIN_ADVANCE_ROLL) {
      rejected.push(`ціль ${index} не просунуто: кидок ${roll} нижче ${MIN_ADVANCE_ROLL}`);
    } else if (objective.location !== next.location) {
      rejected.push(`ціль ${index} у локації «${objective.location}», а гравець у «${next.location}»`);
    } else {
      objective.progress += 1;
      if (objective.progress >= OBJECTIVE_STEPS) {
        objective.done = true;
        changes.push(`ціль виконано: ${objective.text}`);
        facts.push(`Ціль «${objective.text}» виконана: опиши її завершення`);
      } else {
        changes.push(`ціль ${index}: ${objective.progress}/${OBJECTIVE_STEPS}`);
        facts.push(
          `Ціль «${objective.text}» просунуто (${objective.progress}/${OBJECTIVE_STEPS}): це лише проміжний етап, не описуй остаточну перемогу`,
        );
      }
    }
  }
  next.quest.done = next.quest.objectives.every((objective) => objective.done);

  if (feasible && judgement.itemFound && roll >= MIN_FIND_ROLL) {
    const name = judgement.itemFound;
    if (next.inventory.length >= MAX_INVENTORY) {
      rejected.push(`інвентар повний, не додано: «${name}»`);
    } else if (findItemIndex(next.inventory, name) !== -1) {
      rejected.push(`такий предмет уже є: «${name}»`);
    } else {
      next.inventory.push(name);
      changes.push(`+ ${name}`);
      facts.push(`Гравець знаходить предмет «${name}»`);
    }
  }

  if (next.hp <= 0) {
    next.status = "dead";
    facts.push("Гравець гине від отриманих ран");
  } else if (next.quest.done) {
    next.status = "won";
    facts.push("Усі цілі квесту виконано, гра завершена перемогою");
  }

  const summary = changes.length ? ` (${changes.join(", ")})` : "";
  const event = `«${action.slice(0, 60)}»: ${tier.short}${summary}`.slice(0, EVENT_LIMIT);
  next.recentEvents = [...next.recentEvents, event].slice(-RECENT_EVENTS_LIMIT);
  next.turn += 1;

  return { state: next, changes, rejected, facts, event };
}
