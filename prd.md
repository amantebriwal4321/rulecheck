---
doc: prd
status: approved
author: Aman Tebriwal
github: amantebriwal4321
---

# RuleCheck PRD

Proof of concept for one job: turn hackathon rules into a checklist Aman can pass or fail against his own profile. Scope: `scope.md > The Unique Kernel`.

## What We're Building

A single web page.

- Input for a rules URL, or a textarea for pasted rules.
- Two samples so the demo works offline and with no key.
- A checklist grouped into eligibility, deliverables, deadline, and existing code.
- A profile: age, country, student or not. Also party (solo or team, and team size) and whether he is reusing code he already wrote, because those rules cannot be scored from age and country alone.
- Pass, fail, unknown, or note on each row.
- Deadline shown in IST and a one-second countdown.
- A visible source: rules engine, or model. If the model fails, the rules engine still fills the page.

## Who

Solo hackathon hunters. Primary user is Aman Tebriwal. He is in India, often enters alone, and is not always a student. He reads English rules pages.

## Look and Feel

Build choice, recorded so the UI does not drift into a generic purple chat app:

- Warm paper background, near-black ink, deep green stamp for the brand and for passes.
- Fail is a dark red with the word Fail, not color alone.
- Serif for the name and the deadline. Sans for controls. Mono for the sentence quoted from the rules.
- Square corners, thin rules, almost no shadow. Dense enough to scan, loose enough to read on a phone.
- Copy is short and specific. No greeting banner.

## The Core Journey

1. Aman opens the page. He sees the form, an empty result panel that says what he will get, and his profile if he saved one.
2. He pastes a URL or text, or he hits a sample.
3. He waits on "Reading the rules".
4. The result panel shows the event name, the IST deadline, the countdown, and the checklist. Each extracted row quotes the sentence it came from.
5. He fills age, country, and student. Eligibility rows update without another request.
6. He changes country or age and a pass becomes a fail, or the reverse.
7. He leaves. The profile is still there next time, in this browser. The rules result is not stored on a server.

## Screens

One screen, two columns from laptop width up.

Left column: rules input, then profile. Right column: result. On a phone the order is input, result, profile, so the checklist is not pushed below the fold by the form.

### Rules input

- Segmented control: URL, Paste text.
- URL field or textarea.
- Primary button: Check the rules.
- Secondary actions: sample "Open sprint", sample "Student sprint".
- Inline error if the URL is blocked, the fetch fails, or the text is too short.
- While a request is in flight, the button is disabled and the result panel shows a reading state.

### Profile

- Age, whole number.
- Country, free text.
- Student: Yes, No, or unset.
- Entering: Solo, or Team with a size.
- Reusing existing project code: Yes or No.
- Saved in localStorage. Clearing the fields is a text button.

### Result

- Event name, or "Rules check" if no title was found.
- Badge: Rules engine, or Model plus the model name.
- Deadline card: IST label, the original phrase, countdown.
- Groups: Eligibility, Deliverables, Deadline, Existing code.
- Row: status word, title, detail, evidence quote.
- Header count: how many pass, fail, and need a look.
- Empty, before any check: three lines describing eligibility, deliverables, and the IST deadline.
- If the model was configured and the call failed: a warning, then the rules engine result.

## Features and Behavior

### Extraction

From the rules text, fill what is actually stated. Leave the rest unknown.

- Age: minimum, maximum, or a note such as age of majority.
- Student: required, not required, or unknown.
- Country: anywhere, an allow list, or a deny list. "Standard exceptions" means the usual Devpost blocked places named in the rules: Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea.
- Team size min and max. Solo allowed: yes, no, or unknown.
- Video: required or not, min and max minutes.
- Repo: required or not.
- License: required or not, and a name when one is required (MIT, Apache, GPL).
- Deployed link: required or not.
- Deadline phrase, converted to a UTC instant and an IST label when a timezone is present.
- Existing code: allowed, not allowed, or unknown.

Evidence is the sentence that supported the field.

### Profile scoring

Eligibility rows:

- Age fails when the number is outside the stated range. Unknown when the rules or the age are missing.
- Student fails when students are required and the answer is no. Passes when students are required and the answer is yes. Passes when the rules say student status is not required.
- Country fails on a deny list hit, or on an allow list miss. Quebec in the deny list fails "Quebec", and does not fail "Canada".
- Solo fails when solo is disallowed, or when the minimum team size is above 1. Team fails when the size is outside the range.
- Missing profile fields stay unknown, with a line that says what to add.

Deliverable rows are notes: Required, Not required, or Not stated. They do not pretend to know if Aman has recorded the video.

Existing code fails when the rules ban it and he says he is reusing code. It passes when the rules allow it, or when they ban it and he is starting clean.

Deadline is a note plus the countdown. If the timezone is missing, show the raw phrase and skip the countdown. Do not invent a zone.

### Reader selection

- Env `LLM_API_KEY` (or `OPENAI_API_KEY`) turns on the model path.
- `LLM_BASE_URL` (or `OPENAI_BASE_URL`) is any OpenAI-compatible base, default `https://api.openai.com/v1`.
- `LLM_MODEL` (or `OPENAI_MODEL`) default `gpt-4o-mini`.
- No key: rules engine only. The app still completes the core loop.
- Model output is merged with the rules engine. The model wins when it states a value. The rules engine fills gaps. Clock math stays in our deadline code, not in the model.

### URL fetch

Server fetch of http and https only. Block localhost, link-local, and private addresses, including after DNS lookup and after redirects. Strip HTML to text. If the fetch fails, say so and point him at paste.

## Product Decisions

- Profile lives in the browser. A server account would not make the demo more true. Scope: `scope.md > Explicitly Cut`.
- Pass or fail is for eligibility and for the existing-code question. Deliverables stay notes. Aman asked for pass or fail on eligibility, and a checklist overall.
- Party and "reusing code" sit on the profile next to age, country, and student. Without them, solo and existing-code rows cannot be scored.
- IST means Asia/Kolkata, UTC+5:30. A source timezone written as IST is read as India Standard Time, and the row says so.
- Samples are original short rules, written for the demo. The repo does not vendor a copied rules page.
- No login, no database, no analytics.

## States and Boundaries

- Empty result: explain the three outputs, do not show fake passes.
- Loading: reading state, inputs locked.
- Short text (under 40 characters): ask for more.
- Bad URL, blocked host, non-text body, timeout: error on the form, previous result kept.
- Rules with no deadline: the deadline card says none was found.
- Rules with a date and no timezone: show the phrase, no countdown.
- Model timeout or bad JSON: warning plus rules engine result.
- Huge text: use the first 60,000 characters and warn.

## Deferred From the POC

- Saved history of checks.
- Export a calendar event.
- File upload.

## Possible Later Enhancements

A browser extension that runs RuleCheck on the rules tab. A compare view for two hackathons. None of that is in this build.

## Non-Goals

- Accounts, payments, teams, comments.
- Legal advice. The checklist quotes the rules and compares a profile. It is not a lawyer.
- Judging whether a project idea is good.
- Scraping Devpost on a timer.

## Open Questions

None that block the build. Video hosting (YouTube or Vimeo) is a submission task for Aman, outside the app.

## Acceptance

- `npm test` passes.
- `npm run build` passes.
- `npm run dev` serves the page with no API key.
- Sample "Open sprint" shows Tue, 27 Oct 2026, 2:30 AM IST.
- Age 16 fails that sample. Age 21, India, not a student, solo, not reusing code: eligibility passes.
- Sample "Student sprint" fails a US non-student entering solo.
- Setting `LLM_API_KEY` is optional. Unset, the badge says the rules engine did the reading.
- A request to `http://127.0.0.1` is rejected.
