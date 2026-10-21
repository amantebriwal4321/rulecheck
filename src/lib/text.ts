const SENTENCE_SPLIT = /\n+|(?<=[a-z0-9)])\.\s+(?=[A-Z])/g;

export function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);
}

export function sentenceAt(text: string, index: number): string {
  const parts: { start: number; end: number; value: string }[] = [];
  const re = new RegExp(SENTENCE_SPLIT.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    parts.push({ start: last, end: match.index, value: text.slice(last, match.index) });
    last = match.index + match[0].length;
  }
  parts.push({ start: last, end: text.length, value: text.slice(last) });
  const hit =
    parts.find((part) => index >= part.start && index < Math.max(part.end, part.start + 1)) ??
    parts[parts.length - 1];
  return hit.value.replace(/\s+/g, " ").trim().slice(0, 320);
}

export function findSentence(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match.index != null) {
      return sentenceAt(text, match.index);
    }
  }
  return null;
}
