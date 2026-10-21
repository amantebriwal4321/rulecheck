const ALIASES: Record<string, string> = {
  us: "united states",
  usa: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  "united kingdom": "united kingdom",
  britain: "united kingdom",
  "great britain": "united kingdom",
  uae: "united arab emirates",
  "united arab emirates": "united arab emirates",
  dprk: "north korea",
  "north korea": "north korea",
  "south korea": "south korea",
  "republic of korea": "south korea",
  "russian federation": "russia",
  russia: "russia",
  iran: "iran",
  "islamic republic of iran": "iran",
  brazil: "brazil",
  quebec: "quebec",
  crimea: "crimea",
  cuba: "cuba",
  india: "india",
  canada: "canada",
};

const DISPLAY: Record<string, string> = {
  "united states": "United States",
  "united kingdom": "United Kingdom",
  "united arab emirates": "United Arab Emirates",
  "north korea": "North Korea",
  "south korea": "South Korea",
  russia: "Russia",
  iran: "Iran",
  brazil: "Brazil",
  quebec: "Quebec",
  crimea: "Crimea",
  cuba: "Cuba",
  india: "India",
  canada: "Canada",
};

export const STANDARD_EXCEPTIONS = [
  "Brazil",
  "Quebec",
  "Russia",
  "Crimea",
  "Cuba",
  "Iran",
  "North Korea",
];

export function canonicalPlace(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
  return ALIASES[cleaned] ?? cleaned;
}

export function displayPlace(input: string): string {
  const key = canonicalPlace(input);
  if (!key) return "";
  if (DISPLAY[key]) return DISPLAY[key];
  return key.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function samePlace(a: string, b: string): boolean {
  const left = canonicalPlace(a);
  const right = canonicalPlace(b);
  return left.length > 0 && left === right;
}

export function splitPlaces(raw: string): string[] {
  const cleaned = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(and|or|residents|territories|countries)\b/gi, ",")
    .replace(/[/|]/g, ",");
  const seen = new Set<string>();
  const places: string[] = [];
  for (const part of cleaned.split(",")) {
    const token = part.trim().replace(/^the\s+/i, "");
    if (token.length < 2 || token.length > 40) continue;
    if (/\d/.test(token)) continue;
    if (/^(only|including|other|standard|exceptions|excluding|except)$/i.test(token)) continue;
    const display = displayPlace(token);
    const key = canonicalPlace(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    places.push(display);
  }
  return places;
}
