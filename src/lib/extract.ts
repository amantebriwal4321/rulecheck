import { htmlToText } from "@/lib/html";
import { completeJson, getLlmConfig, LLM_SYSTEM, type LlmConfig, type LlmEnv } from "@/lib/llm";
import { blankExtraction, parseRules } from "@/lib/parse-rules";
import { parseDeadline } from "@/lib/deadline";
import { assertPublicHttpUrl } from "@/lib/ssrf";
import type { CountryMode, Extraction, Tri, YesNo } from "@/lib/types";

const TEXT_LIMIT = 60_000;

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}

export type CompleteFn = (rulesText: string) => Promise<unknown>;

function asTri(value: unknown): Tri | null {
  if (value === "required" || value === "not_required" || value === "unknown") return value;
  return null;
}

function asYesNo(value: unknown): YesNo | null {
  if (value === "yes" || value === "no" || value === "unknown") return value;
  return null;
}

function asMode(value: unknown): CountryMode | null {
  if (value === "any" || value === "allow" || value === "deny" || value === "unknown") return value;
  return null;
}

function asNum(value: unknown, max: number): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number) || number <= 0 || number > max) return null;
  return Math.round(number);
}

function asStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 320) : null;
}

function asPlaces(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 20);
}

type LlmFacts = {
  eventName: string | null;
  minAge: number | null;
  maxAge: number | null;
  ageEvidence: string | null;
  student: Tri | "unknown" | null;
  studentEvidence: string | null;
  countryMode: CountryMode | null;
  countries: string[];
  countryEvidence: string | null;
  teamMin: number | null;
  teamMax: number | null;
  soloAllowed: YesNo | null;
  teamEvidence: string | null;
  video: Tri | null;
  videoMinMinutes: number | null;
  videoMaxMinutes: number | null;
  videoEvidence: string | null;
  repo: Tri | null;
  repoEvidence: string | null;
  license: Tri | null;
  licenseName: string | null;
  licenseEvidence: string | null;
  deploy: Tri | null;
  deployEvidence: string | null;
  deadlineRaw: string | null;
  existingCodeAllowed: YesNo | null;
  existingCodeEvidence: string | null;
};

export function normalizeLlm(data: unknown): LlmFacts {
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const student = asTri(row.student);
  return {
    eventName: asStr(row.eventName),
    minAge: asNum(row.minAge, 120),
    maxAge: asNum(row.maxAge, 120),
    ageEvidence: asStr(row.ageEvidence),
    student: student === "required" || student === "not_required" || student === "unknown" ? student : null,
    studentEvidence: asStr(row.studentEvidence),
    countryMode: asMode(row.countryMode),
    countries: asPlaces(row.countries),
    countryEvidence: asStr(row.countryEvidence),
    teamMin: asNum(row.teamMin, 20),
    teamMax: asNum(row.teamMax, 20),
    soloAllowed: asYesNo(row.soloAllowed),
    teamEvidence: asStr(row.teamEvidence),
    video: asTri(row.video),
    videoMinMinutes: asNum(row.videoMinMinutes, 180),
    videoMaxMinutes: asNum(row.videoMaxMinutes, 180),
    videoEvidence: asStr(row.videoEvidence),
    repo: asTri(row.repo),
    repoEvidence: asStr(row.repoEvidence),
    license: asTri(row.license),
    licenseName: asStr(row.licenseName),
    licenseEvidence: asStr(row.licenseEvidence),
    deploy: asTri(row.deploy),
    deployEvidence: asStr(row.deployEvidence),
    deadlineRaw: asStr(row.deadlineRaw),
    existingCodeAllowed: asYesNo(row.existingCodeAllowed),
    existingCodeEvidence: asStr(row.existingCodeEvidence),
  };
}

function preferTri(llm: Tri | null, rules: Tri): Tri {
  if (!llm || llm === "unknown") return rules;
  return llm;
}

function preferYes(llm: YesNo | null, rules: YesNo): YesNo {
  if (!llm || llm === "unknown") return rules;
  return llm;
}

function preferNum(llm: number | null, rules: number | null): number | null {
  return llm ?? rules;
}

function preferStr(llm: string | null, rules: string | null): string | null {
  return llm || rules;
}

export function mergeExtractions(facts: LlmFacts, rules: Extraction, readerLabel: string): Extraction {
  const mode = !facts.countryMode || facts.countryMode === "unknown" ? rules.eligibility.countryMode : facts.countryMode;
  const countries =
    facts.countries.length > 0 ? facts.countries : mode === rules.eligibility.countryMode ? rules.eligibility.countries : [];
  const deadline =
    rules.deadline.utc != null
      ? rules.deadline
      : facts.deadlineRaw
        ? parseDeadline(`Deadline: ${facts.deadlineRaw}`)
        : rules.deadline;
  const merged = blankExtraction("llm", readerLabel);
  merged.eventName = preferStr(facts.eventName, rules.eventName);
  merged.eligibility = {
    minAge: preferNum(facts.minAge, rules.eligibility.minAge),
    maxAge: preferNum(facts.maxAge, rules.eligibility.maxAge),
    ageEvidence: preferStr(facts.ageEvidence, rules.eligibility.ageEvidence),
    ageNote: rules.eligibility.ageNote,
    student:
      facts.student === "required" || facts.student === "not_required"
        ? facts.student
        : rules.eligibility.student,
    studentEvidence: preferStr(facts.studentEvidence, rules.eligibility.studentEvidence),
    countryMode: mode,
    countries,
    countryEvidence: preferStr(facts.countryEvidence, rules.eligibility.countryEvidence),
    teamMin: preferNum(facts.teamMin, rules.eligibility.teamMin),
    teamMax: preferNum(facts.teamMax, rules.eligibility.teamMax),
    soloAllowed: preferYes(facts.soloAllowed, rules.eligibility.soloAllowed),
    teamEvidence: preferStr(facts.teamEvidence, rules.eligibility.teamEvidence),
  };
  merged.deliverables = {
    video: preferTri(facts.video, rules.deliverables.video),
    videoMinMinutes: preferNum(facts.videoMinMinutes, rules.deliverables.videoMinMinutes),
    videoMaxMinutes: preferNum(facts.videoMaxMinutes, rules.deliverables.videoMaxMinutes),
    videoEvidence: preferStr(facts.videoEvidence, rules.deliverables.videoEvidence),
    repo: preferTri(facts.repo, rules.deliverables.repo),
    repoEvidence: preferStr(facts.repoEvidence, rules.deliverables.repoEvidence),
    license: preferTri(facts.license, rules.deliverables.license),
    licenseName: preferStr(facts.licenseName, rules.deliverables.licenseName),
    licenseEvidence: preferStr(facts.licenseEvidence, rules.deliverables.licenseEvidence),
    deploy: preferTri(facts.deploy, rules.deliverables.deploy),
    deployEvidence: preferStr(facts.deployEvidence, rules.deliverables.deployEvidence),
  };
  merged.deadline = deadline.utc || deadline.raw ? deadline : rules.deadline;
  merged.existingCodeAllowed = preferYes(facts.existingCodeAllowed, rules.existingCodeAllowed);
  merged.existingCodeEvidence = preferStr(facts.existingCodeEvidence, rules.existingCodeEvidence);
  merged.warnings = [...rules.warnings];
  return merged;
}

async function readLimited(response: Response, max: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > max) {
      throw new ExtractError("That page is too large. Paste the rules section instead.");
    }
    return buffer;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new ExtractError("That page is too large. Paste the rules section instead.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function fetchRulesText(rawUrl: string): Promise<string> {
  let current: URL;
  try {
    current = await assertPublicHttpUrl(rawUrl);
  } catch (error) {
    throw new ExtractError(error instanceof Error ? error.message : "That URL is blocked.");
  }
  for (let hop = 0; hop < 4; hop += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        headers: {
          "user-agent": "RuleCheck/0.1 (hackathon rules reader)",
          accept: "text/html, text/plain;q=0.9",
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new ExtractError("The URL did not respond. Paste the rules text instead.");
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ExtractError("The URL redirected without a destination.");
      try {
        current = await assertPublicHttpUrl(new URL(location, current).toString());
      } catch (error) {
        throw new ExtractError(error instanceof Error ? error.message : "That redirect is blocked.");
      }
      continue;
    }
    if (!response.ok) {
      throw new ExtractError(`Could not read that URL (${response.status}). Paste the rules text instead.`);
    }
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml|application\/json/i.test(type)) {
      throw new ExtractError("That URL is not an HTML or text page. Paste the rules instead.");
    }
    const raw = new TextDecoder().decode(await readLimited(response, 1_500_000));
    const text = /text\/html|application\/xhtml/i.test(type) || /<html|<p|<div/i.test(raw) ? htmlToText(raw) : raw;
    if (text.trim().length < 40) {
      throw new ExtractError("That page had almost no text. Paste the rules instead.");
    }
    return text;
  }
  throw new ExtractError("Too many redirects. Paste the rules text instead.");
}

export async function extractFromText(
  text: string,
  options?: { complete?: CompleteFn | null; env?: LlmEnv },
): Promise<Extraction> {
  const trimmed = text.trim();
  if (trimmed.length < 40) {
    throw new ExtractError("Paste a bit more of the rules. A sentence or two is too short.");
  }
  let body = trimmed;
  const warnings: string[] = [];
  if (body.length > TEXT_LIMIT) {
    body = body.slice(0, TEXT_LIMIT);
    warnings.push("Rules text was truncated to 60,000 characters.");
  }
  const rules = parseRules(body);
  rules.warnings = warnings;

  const env = options?.env ?? process.env;
  const configured = getLlmConfig(env);
  const complete =
    options?.complete === null
      ? null
      : options?.complete
        ? options.complete
        : configured
          ? (rulesText: string) => completeJson(configured as LlmConfig, LLM_SYSTEM, rulesText.slice(0, 24_000))
          : null;
  if (!complete) return rules;

  try {
    const facts = normalizeLlm(await complete(body.slice(0, 24_000)));
    const merged = mergeExtractions(facts, rules, configured?.model ?? "Model");
    merged.warnings = [...warnings, ...merged.warnings];
    return merged;
  } catch (error) {
    const message = error instanceof Error ? error.message : "model error";
    rules.warnings = [
      ...warnings,
      `Model call failed (${message}). Showing the rules engine reading.`,
    ];
    return rules;
  }
}

export async function extractFromInput(input: { text?: string; url?: string }): Promise<Extraction> {
  const text = input.text?.trim() ?? "";
  if (text.length > 0) return extractFromText(text);
  const url = input.url?.trim() ?? "";
  if (!url) throw new ExtractError("Paste rules or give a URL.");
  if (url.length > 2000) throw new ExtractError("That URL is too long.");
  const page = await fetchRulesText(url);
  return extractFromText(page);
}
