import { describe, expect, it } from "vitest";
import { extractFromText } from "@/lib/extract";
import { getLlmConfig, parseModelJson } from "@/lib/llm";
import { OPEN_SPRINT } from "@/lib/samples";
import { blockedUrlReason, isBlockedIp } from "@/lib/ssrf";
import { htmlToText } from "@/lib/html";

describe("extractFromText", () => {
  it("uses the rules engine when no model is configured", async () => {
    const result = await extractFromText(OPEN_SPRINT, { complete: null, env: {} });
    expect(result.source).toBe("rules");
    expect(result.readerLabel).toBe("Rules engine");
    expect(result.eligibility.minAge).toBe(18);
    expect(result.deadline.utc).toBe("2026-10-26T21:00:00.000Z");
  });

  it("rejects a short paste", async () => {
    await expect(extractFromText("too short", { complete: null, env: {} })).rejects.toThrow(/too short/i);
  });

  it("lets model values win and keeps rules values when the model is silent", async () => {
    const result = await extractFromText(OPEN_SPRINT, {
      env: {},
      complete: async () => ({
        minAge: 21,
        student: "unknown",
        countryMode: "unknown",
        countries: [],
        soloAllowed: "unknown",
        video: "unknown",
        repo: "unknown",
        license: "unknown",
        deploy: "unknown",
        existingCodeAllowed: "unknown",
      }),
    });
    expect(result.source).toBe("llm");
    expect(result.eligibility.minAge).toBe(21);
    expect(result.eligibility.student).toBe("not_required");
    expect(result.eligibility.countryMode).toBe("deny");
    expect(result.deliverables.deploy).toBe("not_required");
    expect(result.deadline.utc).toBe("2026-10-26T21:00:00.000Z");
  });

  it("falls back when the model call throws", async () => {
    const result = await extractFromText(OPEN_SPRINT, {
      env: {},
      complete: async () => {
        throw new Error("Model HTTP 401");
      },
    });
    expect(result.source).toBe("rules");
    expect(result.eligibility.minAge).toBe(18);
    expect(result.warnings.join(" ")).toMatch(/rules engine/i);
  });
});

describe("llm config", () => {
  it("reads provider env vars and stays empty without a key", () => {
    expect(getLlmConfig({})).toBeNull();
    expect(
      getLlmConfig({
        LLM_API_KEY: "sk-test",
        LLM_BASE_URL: "https://example.com/v1/",
        LLM_MODEL: "demo",
      }),
    ).toEqual({
      apiKey: "sk-test",
      baseUrl: "https://example.com/v1",
      model: "demo",
    });
    expect(getLlmConfig({ OPENAI_API_KEY: "openai-key" })?.model).toBe("gpt-4o-mini");
  });

  it("parses fenced JSON", () => {
    expect(parseModelJson('```json\n{"minAge": 18}\n```')).toEqual({ minAge: 18 });
  });
});

describe("ssrf guards", () => {
  it("blocks private hosts and odd protocols", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.1.1.1")).toBe(true);
    expect(isBlockedIp("192.168.0.8")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("::1")).toBe(true);
    expect(blockedUrlReason("file:///etc/passwd")).toMatch(/http/i);
    expect(blockedUrlReason("http://127.0.0.1/rules")).toMatch(/private/i);
    expect(blockedUrlReason("http://localhost/rules")).toMatch(/blocked/i);
    expect(blockedUrlReason("https://user:pass@example.com/rules")).toMatch(/password/i);
    expect(blockedUrlReason("https://example.com/rules")).toBeNull();
  });
});

describe("htmlToText", () => {
  it("drops scripts and keeps visible copy", () => {
    const text = htmlToText(
      "<html><style>p{color:red}</style><script>alert(1)</script><h1>Open sprint</h1><p>Ages 18+ only.</p></html>",
    );
    expect(text).toContain("Open sprint");
    expect(text).toContain("Ages 18+ only.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color");
  });
});
