import { STANDARD_EXCEPTIONS, splitPlaces } from "@/lib/countries";
import { parseDeadline } from "@/lib/deadline";
import { findSentence, sentenceAt, splitSentences } from "@/lib/text";
import type { CountryMode, Extraction, Tri, YesNo } from "@/lib/types";

function nearCode(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 24), index).toLowerCase();
  return /\b(node|npm|python|java|react|version|ecmascript)\b/.test(before);
}

function findMatch(text: string, patterns: RegExp[]): RegExpExecArray | null {
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      if (!nearCode(text, match.index)) return match;
    }
  }
  return null;
}

function parseAge(text: string) {
  const range = findMatch(text, [
    /\bages?\s+(\d{1,2})\s*(?:to|through)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:to|through)\s*(\d{1,2})\s+years?\b/i,
  ]);
  if (range) {
    const minAge = Number(range[1]);
    const maxAge = Number(range[2]);
    if (minAge >= 10 && maxAge <= 120 && minAge <= maxAge) {
      return {
        minAge,
        maxAge,
        ageEvidence: sentenceAt(text, range.index),
        ageNote: null,
      };
    }
  }

  let minAge: number | null = null;
  let maxAge: number | null = null;
  let ageEvidence: string | null = null;
  const minMatch = findMatch(text, [
    /\bages?\s+(\d{1,2})\s*\+/i,
    /\b(\d{1,2})\s*\+\s*(?:only\b|years?\b|and up\b)/i,
    /\b(?:at least|minimum age(?: of)?|aged)\s+(\d{1,2})\b/i,
    /\bmust be\s+(?:at least\s+)?(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:years?\s+)?(?:or older|and older|and up)\b/i,
  ]);
  if (minMatch) {
    const value = Number(minMatch[1]);
    if (value >= 10 && value <= 120) {
      minAge = value;
      ageEvidence = sentenceAt(text, minMatch.index);
    }
  }

  const under = findMatch(text, [/\bunder\s+(\d{1,2})\b/i]);
  if (under) {
    const value = Number(under[1]);
    if (value >= 11 && value <= 120) {
      maxAge = value - 1;
      ageEvidence = ageEvidence ?? sentenceAt(text, under.index);
    }
  }
  const older = findMatch(text, [/\b(?:no older than|maximum age(?: of)?|max age(?: of)?)\s+(\d{1,2})\b/i]);
  if (older) {
    const value = Number(older[1]);
    if (value >= 10 && value <= 120) {
      maxAge = value;
      ageEvidence = ageEvidence ?? sentenceAt(text, older.index);
    }
  }

  let ageNote: string | null = null;
  if (minAge == null && maxAge == null && /age of majority/i.test(text)) {
    const majority = /age of majority/i.exec(text);
    ageNote = "Rules require the age of majority where you live.";
    ageEvidence = majority ? sentenceAt(text, majority.index) : ageEvidence;
  }
  return { minAge, maxAge, ageEvidence, ageNote };
}

function parseStudent(text: string): { student: Extraction["eligibility"]["student"]; studentEvidence: string | null } {
  const required = findSentence(text, [
    /only students/i,
    /students only/i,
    /must be a student/i,
    /must be enrolled/i,
    /exclusively for students/i,
    /college students only/i,
    /university students only/i,
  ]);
  const open = findSentence(text, [
    /student status is not required/i,
    /student status not required/i,
    /not limited to students/i,
    /students and professionals/i,
    /professionals welcome/i,
    /no student requirement/i,
    /do not have to be a student/i,
    /don't have to be a student/i,
  ]);
  if (required) return { student: "required", studentEvidence: required };
  if (open) return { student: "not_required", studentEvidence: open };
  return { student: "unknown", studentEvidence: null };
}

function parseCountries(text: string): {
  countryMode: CountryMode;
  countries: string[];
  countryEvidence: string | null;
} {
  const sentences = splitSentences(text);
  const deny = new Set<string>();
  let evidence: string | null = null;
  for (const sentence of sentences) {
    if (/standard exceptions|ofac|comprehensively sanctioned/i.test(sentence)) {
      for (const place of STANDARD_EXCEPTIONS) deny.add(place);
      evidence = evidence ?? sentence;
    }
    const exclusion = /(?:excluding|except(?: for)?|not open to(?: residents of)?|closed to|prohibited in)\s+(.+)$/i.exec(
      sentence,
    );
    if (exclusion) {
      for (const place of splitPlaces(exclusion[1])) deny.add(place);
      evidence = sentence;
    }
  }
  if (deny.size > 0) {
    return { countryMode: "deny", countries: [...deny], countryEvidence: evidence };
  }

  for (const sentence of sentences) {
    const only = /(?:open to|limited to|residents of|participants (?:in|from)|only open to)\s+(.+?)\s+only\b/i.exec(
      sentence,
    );
    if (only && !/\d|student|solo|team|video|minute|age/i.test(only[1])) {
      const places = splitPlaces(only[1]);
      if (places.length > 0) {
        return { countryMode: "allow", countries: places, countryEvidence: sentence };
      }
    }
    const bare = /(?:^|\s)([A-Za-z][A-Za-z .']{1,40}?)\s+only\b/.exec(sentence);
    if (bare && !/\d|student|solo|team|video|minute|age/i.test(bare[1])) {
      const places = splitPlaces(bare[1]);
      if (places.length > 0) {
        return { countryMode: "allow", countries: places, countryEvidence: sentence };
      }
    }
  }

  const worldwide = findSentence(text, [
    /\bworldwide\b/i,
    /\ball countries\b/i,
    /\bany country\b/i,
    /\bopen globally\b/i,
  ]);
  if (worldwide) return { countryMode: "any", countries: [], countryEvidence: worldwide };
  return { countryMode: "unknown", countries: [], countryEvidence: null };
}

function parseTeam(text: string) {
  let teamMin: number | null = null;
  let teamMax: number | null = null;
  let soloAllowed: YesNo = "unknown";
  const bits: string[] = [];
  for (const sentence of splitSentences(text)) {
    const lower = sentence.toLowerCase();
    if (!/team|solo|individual/.test(lower)) continue;
    const range = /teams?\s+of\s+(\d+)\s+to\s+(\d+)/i.exec(sentence);
    const upTo = /teams?\s+of\s+up\s+to\s+(\d+)/i.exec(sentence);
    const members = /(\d+)\s+to\s+(\d+)\s+(?:members|people)/i.exec(sentence);
    const maxMembers = /(?:maximum team size(?: of)?|up to)\s+(\d+)\s+(?:members|people)/i.exec(sentence);
    if (range) {
      teamMin = Number(range[1]);
      teamMax = Number(range[2]);
      bits.push(sentence);
    } else if (members && /team/.test(lower)) {
      teamMin = Number(members[1]);
      teamMax = Number(members[2]);
      bits.push(sentence);
    } else if (upTo) {
      teamMax = Number(upTo[1]);
      bits.push(sentence);
    } else if (maxMembers) {
      teamMax = Number(maxMembers[1]);
      bits.push(sentence);
    }

    if (
      /solo (?:entries|hackers|participants|builders)?\s*(?:are|is)?\s*not allowed|no solo\b|teams only|individuals are not allowed/i.test(
        sentence,
      )
    ) {
      soloAllowed = "no";
      bits.push(sentence);
    } else if (/individuals only|solo only|no teams|teams are not allowed/i.test(sentence)) {
      soloAllowed = "yes";
      teamMin = 1;
      teamMax = 1;
      bits.push(sentence);
    } else if (
      /solo (?:entries|hackers|participants|builders)?\s*(?:are|is)?\s*(?:allowed|welcome|accepted|fine|ok)\b|individuals or teams|solo or team|individuals welcome|you can enter solo/i.test(
        sentence,
      )
    ) {
      if (soloAllowed !== "no") soloAllowed = "yes";
      bits.push(sentence);
    }
  }
  if (teamMin != null && teamMin > 1 && soloAllowed === "unknown") soloAllowed = "no";
  if (soloAllowed === "yes" && teamMin == null) teamMin = 1;
  return {
    teamMin,
    teamMax,
    soloAllowed,
    teamEvidence: [...new Set(bits)].join(" ").slice(0, 320) || null,
  };
}

function parseVideo(text: string) {
  let video: Tri = "unknown";
  let videoMinMinutes: number | null = null;
  let videoMaxMinutes: number | null = null;
  let videoEvidence: string | null = null;
  for (const sentence of splitSentences(text)) {
    if (!/video/i.test(sentence)) continue;
    if (/optional|not required/i.test(sentence)) {
      video = "not_required";
      videoEvidence = sentence;
    } else if (video !== "not_required") {
      video = "required";
      videoEvidence = videoEvidence ?? sentence;
    }
    const range = /(\d+)\s+to\s+(\d+)\s+minutes?/i.exec(sentence);
    const less = /less than\s+(?:[a-z]+\s+)?\(?(\d+)\)?\s+minutes?/i.exec(sentence);
    const cap = /(?:max(?:imum)?|up to|no more than|under)\s+(\d+)\s+minutes?/i.exec(sentence);
    const exact = /(\d+)\s+minute\s+(?:demo\s+)?video/i.exec(sentence);
    if (range) {
      videoMinMinutes = Number(range[1]);
      videoMaxMinutes = Number(range[2]);
      videoEvidence = sentence;
    } else if (less) {
      videoMaxMinutes = Number(less[1]);
      videoEvidence = sentence;
    } else if (cap) {
      videoMaxMinutes = Number(cap[1]);
      videoEvidence = sentence;
    } else if (exact) {
      videoMaxMinutes = Number(exact[1]);
      videoEvidence = sentence;
    }
  }
  return { video, videoMinMinutes, videoMaxMinutes, videoEvidence };
}

function parseRepo(text: string): { repo: Tri; repoEvidence: string | null } {
  let repo: Tri = "unknown";
  let repoEvidence: string | null = null;
  for (const sentence of splitSentences(text)) {
    if (!/repo|repository|source code/i.test(sentence)) continue;
    if (/optional|not required/i.test(sentence)) {
      repo = "not_required";
      repoEvidence = sentence;
    } else if (repo !== "not_required" && /public|required|must|include|submit|ship|github|gitlab|bitbucket/i.test(sentence)) {
      repo = "required";
      repoEvidence = repoEvidence ?? sentence;
    }
  }
  return { repo, repoEvidence };
}

function parseLicense(text: string) {
  let license: Tri = "unknown";
  let licenseName: string | null = null;
  let licenseEvidence: string | null = null;
  for (const sentence of splitSentences(text)) {
    if (!/licen[cs]e/i.test(sentence)) continue;
    if (/optional|not required/i.test(sentence)) {
      license = "not_required";
      licenseEvidence = sentence;
    } else if (
      license !== "not_required" &&
      /open source|mit|apache|gpl|bsd|required|include|must|ship/i.test(sentence)
    ) {
      license = "required";
      licenseEvidence = sentence;
      if (/\bMIT\b/.test(sentence)) licenseName = "MIT";
      else if (/\bApache\b/i.test(sentence)) licenseName = "Apache";
      else if (/\bGPL\b/.test(sentence)) licenseName = "GPL";
      else if (/\bBSD\b/.test(sentence)) licenseName = "BSD";
    }
  }
  return { license, licenseName, licenseEvidence };
}

function parseDeploy(text: string): { deploy: Tri; deployEvidence: string | null } {
  let deploy: Tri = "unknown";
  let deployEvidence: string | null = null;
  for (const sentence of splitSentences(text)) {
    if (!/deploy|live url|live link|hosted/i.test(sentence)) continue;
    if (/optional|not required/i.test(sentence)) {
      deploy = "not_required";
      deployEvidence = sentence;
    } else if (deploy !== "not_required" && /required|must|ship|include|submit/i.test(sentence)) {
      deploy = "required";
      deployEvidence = sentence;
    }
  }
  return { deploy, deployEvidence };
}

function parseExisting(text: string): { existingCodeAllowed: YesNo; existingCodeEvidence: string | null } {
  const banned = findSentence(text, [
    /existing code is not allowed/i,
    /existing projects are not allowed/i,
    /no existing code/i,
    /old code is not/i,
    /new projects only/i,
    /pre-existing code is not allowed/i,
    /start from an empty folder/i,
  ]);
  const allowed = findSentence(text, [
    /existing code is allowed/i,
    /existing projects are allowed/i,
    /you may (?:use|submit|bring|reuse) existing/i,
    /pre-existing code is allowed/i,
    /forks are allowed/i,
    /prior work is welcome/i,
  ]);
  if (banned) return { existingCodeAllowed: "no", existingCodeEvidence: banned };
  if (allowed) return { existingCodeAllowed: "yes", existingCodeEvidence: allowed };
  return { existingCodeAllowed: "unknown", existingCodeEvidence: null };
}

function parseEventName(text: string): string | null {
  const first = text
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return null;
  const title = first.replace(/^#+\s*/, "");
  if (title.length > 60 || /[.!]/.test(title)) return null;
  if (/^(deadline|eligibility|rules|deliverables|code)\b/i.test(title)) return null;
  return title;
}

export function blankExtraction(source: Extraction["source"], readerLabel: string): Extraction {
  return {
    source,
    readerLabel,
    eventName: null,
    eligibility: {
      minAge: null,
      maxAge: null,
      ageEvidence: null,
      ageNote: null,
      student: "unknown",
      studentEvidence: null,
      countryMode: "unknown",
      countries: [],
      countryEvidence: null,
      teamMin: null,
      teamMax: null,
      soloAllowed: "unknown",
      teamEvidence: null,
    },
    deliverables: {
      video: "unknown",
      videoMinMinutes: null,
      videoMaxMinutes: null,
      videoEvidence: null,
      repo: "unknown",
      repoEvidence: null,
      license: "unknown",
      licenseName: null,
      licenseEvidence: null,
      deploy: "unknown",
      deployEvidence: null,
    },
    deadline: { raw: null, utc: null, istLabel: null, evidence: null, note: null },
    existingCodeAllowed: "unknown",
    existingCodeEvidence: null,
    warnings: [],
  };
}

export function parseRules(text: string): Extraction {
  const age = parseAge(text);
  const student = parseStudent(text);
  const countries = parseCountries(text);
  const team = parseTeam(text);
  const video = parseVideo(text);
  const repo = parseRepo(text);
  const license = parseLicense(text);
  const deploy = parseDeploy(text);
  const existing = parseExisting(text);
  return {
    source: "rules",
    readerLabel: "Rules engine",
    eventName: parseEventName(text),
    eligibility: {
      ...age,
      ...student,
      ...countries,
      ...team,
    },
    deliverables: {
      ...video,
      ...repo,
      ...license,
      ...deploy,
    },
    deadline: parseDeadline(text),
    ...existing,
    warnings: [],
  };
}
