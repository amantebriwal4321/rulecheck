import { connection } from "next/server";
import { ExtractError, extractFromInput } from "@/lib/extract";

export async function POST(request: Request) {
  await connection();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Send JSON with a url or text." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return Response.json({ ok: false, error: "Send JSON with a url or text." }, { status: 400 });
  }
  const body = payload as { url?: unknown; text?: unknown };
  const text = typeof body.text === "string" ? body.text : "";
  const url = typeof body.url === "string" ? body.url : "";
  if (text.length > 80_000) {
    return Response.json(
      { ok: false, error: "That paste is too long. Keep it under 80,000 characters." },
      { status: 413 },
    );
  }
  try {
    const extraction = await extractFromInput({ text, url });
    return Response.json({ ok: true, extraction });
  } catch (error) {
    if (error instanceof ExtractError) {
      return Response.json({ ok: false, error: error.message }, { status: 400 });
    }
    return Response.json(
      { ok: false, error: "Something went wrong while reading the rules." },
      { status: 500 },
    );
  }
}
