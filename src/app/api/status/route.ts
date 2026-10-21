import { connection } from "next/server";
import { getLlmConfig } from "@/lib/llm";

export async function GET() {
  await connection();
  const config = getLlmConfig();
  let host: string | null = null;
  if (config) {
    try {
      host = new URL(config.baseUrl).host;
    } catch {
      host = null;
    }
  }
  return Response.json({
    mode: config ? "llm" : "rules",
    model: config?.model ?? null,
    host,
  });
}
