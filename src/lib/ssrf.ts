import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
]);

export function isBlockedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  const v4 = mapped ? mapped[1] : normalized;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  return false;
}

export function blockedUrlReason(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That URL is not valid.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Only http and https URLs work.";
  }
  if (url.username || url.password) {
    return "URLs with a username or password are blocked.";
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return "That URL is missing a host.";
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal")
  ) {
    return "That host is blocked. Paste the rules text instead.";
  }
  if (isIP(host) && isBlockedIp(host)) {
    return "That address is on a private network. Paste the rules text instead.";
  }
  return null;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const reason = blockedUrlReason(raw);
  if (reason) throw new Error(reason);
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return url;
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new Error("Could not resolve that host. Paste the rules text instead.");
  }
  if (records.length === 0 || records.some((record) => isBlockedIp(record.address))) {
    throw new Error("That host points at a private network. Paste the rules text instead.");
  }
  return url;
}
