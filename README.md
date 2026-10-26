# RuleCheck

Hackathon rules, reduced to a checklist. Paste a rules URL or the rules text. RuleCheck pulls eligibility, the ship list, and the deadline in IST, then scores your profile.

Live: https://rulecheck-aman.vercel.app

Built by [Aman Tebriwal](https://github.com/amantebriwal4321) for Devpost's Build With AI: Basics (https://learn-ai-basics.devpost.com). New project. MIT license.

## Run it

Node 22 and npm.

```
npm install
npm test
npm run dev
```

Open http://127.0.0.1:4317 . Hit **Try open sprint**. No API key required.

`npm run build` then `npm start` serves the production build on the same port.

## What you get

- Eligibility: age, student status, country, team size, solo
- Deliverables: video length, repo, license, deployed link
- Deadline converted to IST, plus a countdown
- Whether existing code is allowed
- Pass or fail once you enter age, country, and student status (plus solo or team, and whether you are reusing code)

The profile stays in this browser. There is no account.

## Model or rules engine

With no key, the rules engine does the reading. Set these if you want a model in front of it. Any OpenAI-compatible `/chat/completions` endpoint works (OpenAI, Groq, OpenRouter, Together, Ollama).

```
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

`OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` are aliases. See `.env.example`.

If the model call fails, the rules engine result still shows. Deadline math always runs in this repo, not in the model.

## Deploy on Vercel

1. Push the repo to GitHub and make it public.
2. Import the project on Vercel. Framework preset: Next.js. Leave the build command and output as the defaults.
3. Optional env vars: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`.
4. Deploy. No login, no database.

An empty key is a valid production config. The rules engine answers on its own.

Ollama on your laptop will not be reachable from a Vercel deployment. Use a hosted base URL there.

## Planning docs

Written in the Devpost Learn order, before the app:

- `scope.md` and `devpost/scope.md`
- `prd.md` and `devpost/prd.md`
- `spec.md` and `devpost/spec.md`

`VIDEO_SCRIPT.md` is the 1 to 3 minute demo.

## Tests

`npm test` covers deadline conversion (including 26 Oct 2026, 5:00 PM EDT to 27 Oct 2026, 2:30 AM IST), both samples, profile pass and fail, the no-key path, model merge and fallback, HTML stripping, and blocked private URLs.

## Before you submit

Deadline for Build With AI: Basics: 26 Oct 2026, 5:00 PM EDT, which is 27 Oct 2026, 2:30 AM IST.

- Record the video from `VIDEO_SCRIPT.md`. Public on YouTube or Vimeo. No copyrighted music. Under 3 minutes. Show the app working.
- Public GitHub repo with this MIT `LICENSE` visible in the About section.
- Devpost text, in your own words: what it does, who it is for, what you learned.
- Register on https://learn-ai-basics.devpost.com before the deadline.

Draft you can rewrite: RuleCheck is for solo hackathon hunters who burn time on rules pages. Paste a URL or the rules, get a checklist, and see pass or fail against your age, country, and student status, with the deadline in IST. I learned to pin the reading in a rules engine so the demo still works when the model key is missing.

## Disclosure

No pre-existing project code. The app uses normal open source libraries (Next.js, React, Tailwind, shadcn/ui, Vitest) installed during this build. Sample rules in the UI are original short text for the demo.
