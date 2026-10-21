export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type LlmEnv = {
  [key: string]: string | undefined;
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};

type ChatResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

export function getLlmConfig(env: LlmEnv = process.env): LlmConfig | null {
  const apiKey = (env.LLM_API_KEY || env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const baseUrl = (env.LLM_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = (env.LLM_MODEL || env.OPENAI_MODEL || "gpt-4o-mini").trim();
  return { apiKey, baseUrl, model };
}

export function parseModelJson(content: string): unknown {
  const fenced = content.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : content.trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Model returned no JSON object");
  }
  return JSON.parse(body.slice(start, end + 1));
}

async function postChat(
  cfg: LlmConfig,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ status: number; body: ChatResponse }> {
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = (await response.json().catch(() => ({}))) as ChatResponse;
  return { status: response.status, body };
}

export async function completeJson(cfg: LlmConfig, system: string, user: string, timeoutMs = 20_000): Promise<unknown> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const base = { model: cfg.model, temperature: 0, messages };
  let result = await postChat(cfg, { ...base, response_format: { type: "json_object" } }, timeoutMs);
  if (result.status === 400) {
    result = await postChat(cfg, base, timeoutMs);
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Model HTTP ${result.status}`);
  }
  const content = result.body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Model returned an empty reply");
  }
  return parseModelJson(content);
}

export const LLM_SYSTEM = `You extract hackathon rules into JSON. Use only the rules text. Use null or "unknown" when the text does not say. Evidence fields must be short quotes from the text. Do not convert timezones. Put the deadline phrase in deadlineRaw.

Return this JSON shape:
{
  "eventName": string | null,
  "minAge": number | null,
  "maxAge": number | null,
  "ageEvidence": string | null,
  "student": "required" | "not_required" | "unknown",
  "studentEvidence": string | null,
  "countryMode": "any" | "allow" | "deny" | "unknown",
  "countries": string[],
  "countryEvidence": string | null,
  "teamMin": number | null,
  "teamMax": number | null,
  "soloAllowed": "yes" | "no" | "unknown",
  "teamEvidence": string | null,
  "video": "required" | "not_required" | "unknown",
  "videoMinMinutes": number | null,
  "videoMaxMinutes": number | null,
  "videoEvidence": string | null,
  "repo": "required" | "not_required" | "unknown",
  "repoEvidence": string | null,
  "license": "required" | "not_required" | "unknown",
  "licenseName": string | null,
  "licenseEvidence": string | null,
  "deploy": "required" | "not_required" | "unknown",
  "deployEvidence": string | null,
  "deadlineRaw": string | null,
  "existingCodeAllowed": "yes" | "no" | "unknown",
  "existingCodeEvidence": string | null
}

countryMode "deny" is a block list. "allow" means only those places. "any" means worldwide and countries should be empty. soloAllowed is "yes" or "no" only when the text says so.`;
