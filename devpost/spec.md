---
doc: spec
status: approved
author: Aman Tebriwal
github: amantebriwal4321
---

# RuleCheck technical spec

How the proof of concept is built. Product behavior is in `prd.md`. The kernel is in `scope.md > The Unique Kernel`.

## How This Works, In Plain Language

The page has two jobs. It reads rules, then it scores a profile against that reading.

The browser sends a URL or pasted text to `POST /api/check`. The server turns a URL into text, or uses the paste. If `LLM_API_KEY` or `OPENAI_API_KEY` is set, it asks an OpenAI-compatible chat endpoint for JSON. The rules engine always runs too. Model fields win when they are filled in. Empty model fields keep the engine's answer. Clock math stays in our code.

The browser scores the profile locally, so changing age or country does not call the server again. The profile is stored in `localStorage`. Nothing is written to a database.

This shape beats a chat box. The checklist is the same every time for the same text, and it still runs when no key is present.

## The Core Journey Through the System

PRD ref: `prd.md > The Core Journey`.

1. Aman pastes text or a URL and hits Check the rules.
2. The browser `POST`s JSON to `/api/check`.
3. A URL is checked for public http(s), fetched, and stripped to text. A paste skips the fetch.
4. `parseRules` fills the extraction. If a key is set, `completeJson` posts to `{base}/chat/completions` and `mergeExtractions` combines the two readings. Deadline instants always come from `parseDeadline`.
5. The response is an `Extraction`. The page runs `scoreRules(extraction, profile)` and paints pass, fail, check, or note.
6. The deadline card formats the UTC instant in `Asia/Kolkata` and ticks `formatCountdown` every second.

## Stack

- Next.js 16, React 19, TypeScript. App Router. https://nextjs.org/docs
- Tailwind CSS 4 and shadcn/ui primitives (Button, Input, Textarea, Label, Card, Badge). https://ui.shadcn.com
- Vitest for the rules engine, deadline math, scoring, and the model merge. https://vitest.dev
- Node.js runtime for the route handlers. The default runtime is Node, which is what `dns` and the model fetch need. Cache Components is on, so the routes do not set `runtime`.

No database. No auth library. The model client is a `fetch` to `/chat/completions`, so Groq, OpenRouter, Together, Ollama, and OpenAI all fit the same three env vars.

## Where It Runs and How Someone Tries It

Browser UI, Node server for the two routes. Node 22 is what this repo was built with. Node 20 may work. No API key is required.

```
npm install
npm test
npm run dev
```

Open http://127.0.0.1:4317 . Hit "Try open sprint". The deadline should read Tue, 27 Oct 2026, 2:30 AM IST.

Submission needs a 1 to 3 minute video and a public GitHub repo. Deployment is optional and does not replace either. Vercel steps are in the README. `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` are optional project env vars.

## Look and Feel

PRD ref: `prd.md > Look and Feel`.

Paper `#e7e1d4`, ink `#1c1915`, stamp green `#0e4d45`. Pass `#0e6b45`, fail `#9f2d2d`, warning `#8a5a12`. Newsreader for the title and the deadline. IBM Plex Sans for controls. IBM Plex Mono for quotes and the countdown. Square corners. A faint ruled line on the page background. Status is a word (Pass, Fail, Check, Required, Optional, Note), not color alone.

## Components

### Rules form

URL or paste, submit, two samples. PRD ref: `prd.md > Rules input`.

### Profile card

Age, country, student, solo or team, team size, reusing code. Writes `localStorage` key `rulecheck.profile.v1`. PRD ref: `prd.md > Profile`.

### Checklist

`scoreRules` output grouped into eligibility, deliverables, and existing code. Each row has a badge, a title, a detail line, and the evidence sentence. PRD ref: `prd.md > Result`.

### Deadline card

IST label, original phrase, note, countdown. PRD ref: `prd.md > Result`.

### `POST /api/check`

Body `{ "text"?: string, "url"?: string }`. Text wins when both are present and text is non-empty. Returns `{ ok: true, extraction }` or `{ ok: false, error }` with status 400 or 413.

### `GET /api/status`

`{ mode: "llm" | "rules", model, host }`. Host is the base URL host only. The key is never returned. `connection()` keeps this off the static prerender so a key added at deploy time is visible.

## Data Model

No server store. The extraction shape lives in `src/lib/types.ts`.

- Eligibility: `minAge`, `maxAge`, `student` (`required | not_required | unknown`), `countryMode` (`any | allow | deny | unknown`), `countries[]`, `teamMin`, `teamMax`, `soloAllowed` (`yes | no | unknown`).
- Deliverables: video, repo, license, deploy, each `required | not_required | unknown`, plus minute bounds and `licenseName`.
- Deadline: `raw`, `utc` ISO or null, `istLabel`, `evidence`, `note`.
- `existingCodeAllowed`: `yes | no | unknown`.
- `source`: `llm` or `rules`. `readerLabel` is "Rules engine" or the model name.
- `warnings`: strings for truncation and model failure.

Profile fields that are blank stay null and score as unknown, except a rule that does not constrain the person (student not required, existing code allowed, worldwide).

Leaving the page drops the extraction. The profile remains in the browser.

## File Structure

```
src/
├── app/
│   ├── api/check/route.ts    # POST extract
│   ├── api/status/route.ts   # GET engine status
│   ├── layout.tsx
│   ├── page.tsx
│   ├── icon.svg
│   └── globals.css
├── components/
│   ├── rule-check-app.tsx    # page UI
│   └── ui/                   # shadcn primitives
├── lib/
│   ├── deadline.ts           # timezone math and countdown
│   ├── parse-rules.ts        # rules engine
│   ├── score.ts              # profile pass or fail
│   ├── extract.ts            # fetch, merge, orchestrate
│   ├── llm.ts                # OpenAI-compatible client
│   ├── ssrf.ts               # public URL guard
│   ├── countries.ts
│   ├── html.ts
│   ├── samples.ts
│   ├── text.ts
│   └── types.ts
devpost/                      # same planning docs as the repo root
scope.md
prd.md
spec.md
VIDEO_SCRIPT.md
README.md
LICENSE
```

## External Services and Dependencies

Model call, only when a key is set:

- `POST {LLM_BASE_URL}/chat/completions`
- Headers: `Authorization: Bearer {LLM_API_KEY}`, `Content-Type: application/json`
- Body: `{ model, temperature: 0, messages, response_format: { type: "json_object" } }`
- On HTTP 400, retry once without `response_format` (some compatible servers reject it)
- Timeout 20 seconds
- Docs: https://platform.openai.com/docs/api-reference/chat

Default base `https://api.openai.com/v1`, default model `gpt-4o-mini`. Cost and rate limits are whatever the chosen provider bills. With no key, this call is skipped.

URL fetch is a normal `GET` with a 12 second timeout, manual redirects (max 4), and a 1.5 MB cap. Private, loopback, and link-local addresses are rejected before the request and again after DNS.

## Important Failure Modes

- **No API key, or the model errors** → the rules engine result, with a warning when the call actually failed. The badge says Rules engine.
- **URL blocked, dead, or not text** → form error, previous checklist kept. Paste still works.
- **Date with no timezone** → the phrase is shown, countdown stays off. The app does not guess a zone.
- **Short paste** → error asking for more text.

## What Was Simplified and Why

- **Regex plus a small merger** instead of a model-only reader. The demo has to work in a review with no key, and the IST math needs to be testable.
- **Profile in localStorage** instead of accounts. Accounts would not make the pass or fail more true. PRD ref: `prd.md > Product Decisions`.
- **Original sample rules** instead of shipping a copied rules page.
- **Sentence evidence** instead of a highlighted source PDF. The quote is enough to see why a row exists.

## Decisions and Open Issues

- IST means `Asia/Kolkata` (UTC+5:30). A source zone written as IST is India Standard Time, and the note says so. Irish Summer Time is not what this tool is for.
- US zones written as ET, CT, MT, or PT use US daylight rules for that calendar date. Named offsets (EDT, EST, PDT) are fixed.
- When several dates appear, the one nearest the words deadline, due, or closes wins. A later workshop date does not steal the countdown.
- "Standard exceptions" or an OFAC mention fills the Devpost block list: Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea.
- Quebec on a block list fails the place Quebec. It does not fail Canada.
- Team minimum above 1 implies solo is not allowed when the text never says solo.
- Model JSON is untrusted. Numbers outside a sane range are dropped. Deadline instants are recomputed by `parseDeadline`.
- SSRF checks DNS and then fetches. A rebinding host could still move. Good enough for a proof of concept, not a general crawler.
- One real ambiguity during the build: whether deliverables should pass or fail. They stay notes (Required, Optional, Not stated). Pass or fail is for eligibility and for the existing-code question, which matches `prd.md > Profile scoring`.

No open product questions remain from `prd.md > Open Questions`.
