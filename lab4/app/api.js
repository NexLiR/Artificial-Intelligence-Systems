import {
  buildJudgeMessages,
  buildNarratorMessages,
  buildOpeningMessages,
  buildSetupMessages,
  cleanNarration,
  createStateFromSetup,
  extractRoll,
  JUDGE_MAX_TOKENS,
  JUDGE_SCHEMA,
  OPENING_MAX_TOKENS,
  parseJudgement,
  parseSetup,
  resolveTurn,
  SCENE_LIMIT,
  SETUP_MAX_TOKENS,
  SETUP_SCHEMA,
} from "./game.js";

export const DEFAULT_CONFIG = {
  baseUrl: "http://localhost:1234/v1",
  model: "qwen3-8b@q4_k_m",
  temperature: 0.7,
  judgeTemperature: 0.1,
  maxTokens: 400,
  timeoutMs: 60_000,
  useJsonSchema: true,
};

async function requestCompletion(config, messages, format) {
  const body = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };
  if (format && config.useJsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: format.name, strict: true, schema: format.schema } };
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error(`сервер не відповів за ${config.timeoutMs / 1000} с`);
    throw new Error("не вдалося зʼєднатися з сервером: перевірте, що Local Server у LM Studio запущено, а адреса правильна");
  }
  if (!response.ok) {
    const details = (await response.text()).slice(0, 200);
    throw new Error(`сервер відповів ${response.status} для моделі ${config.model} (чи завантажена вона в LM Studio?): ${details}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function requestWithRetry(config, messages, format, parse, failureMessage) {
  const first = parse(await requestCompletion(config, messages, format));
  if (first) return { value: first, retried: false };
  const second = parse(await requestCompletion(config, messages, format));
  if (!second) throw new Error(failureMessage);
  return { value: second, retried: true };
}

const requestJson = (config, messages, format, parse) =>
  requestWithRetry(config, messages, format, parse, "модель двічі повернула некоректну відповідь (не JSON за схемою)");

const requestText = (config, messages) =>
  requestWithRetry(config, messages, null, cleanNarration, "модель двічі повернула порожній текст");

const secondsSince = (startedAt) => (performance.now() - startedAt) / 1000;

export async function startGame(config, premise) {
  const startedAt = performance.now();
  const setupResult = await requestJson(
    { ...config, maxTokens: SETUP_MAX_TOKENS },
    buildSetupMessages(premise),
    { name: "setup", schema: SETUP_SCHEMA },
    parseSetup,
  );
  const openingResult = await requestText(
    { ...config, maxTokens: OPENING_MAX_TOKENS },
    buildOpeningMessages(premise, setupResult.value),
  );
  const opening = openingResult.value;
  return {
    setup: setupResult.value,
    opening,
    state: createStateFromSetup(setupResult.value, opening.slice(0, SCENE_LIMIT)),
    retried: setupResult.retried || openingResult.retried,
    seconds: secondsSince(startedAt),
  };
}

export async function playTurn(config, state, rawInput) {
  const { roll, action } = extractRoll(rawInput);
  const startedAt = performance.now();

  const judged = await requestJson(
    { ...config, temperature: config.judgeTemperature, maxTokens: JUDGE_MAX_TOKENS },
    buildJudgeMessages(state, action),
    { name: "judge", schema: JUDGE_SCHEMA },
    parseJudgement,
  );
  const result = resolveTurn(state, judged.value, action, roll);
  const narrated = await requestText(config, buildNarratorMessages(state, result, action));
  const narration = narrated.value;

  return {
    roll,
    judgement: judged.value,
    narration,
    facts: result.facts,
    changes: result.changes,
    rejected: result.rejected,
    state: { ...result.state, scene: narration.slice(0, SCENE_LIMIT) },
    retried: judged.retried || narrated.retried,
    seconds: secondsSince(startedAt),
  };
}
