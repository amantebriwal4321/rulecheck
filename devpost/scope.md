---
doc: scope
status: approved
author: Aman Tebriwal
github: amantebriwal4321
---

# RuleCheck

A solo hackathon preflight. Paste a rules URL or the rules text. Get a checklist: who can enter, what you must ship, and the deadline in IST with a countdown.

## The Unique Kernel

The useful part is the personal pass or fail. Age, country, and student status get checked against the rules, and the deadline is converted to IST instead of left in ET or UTC. A summary of the page is not the product. The decision is.

## Who It's For

Aman, and other solo hackathon hunters who enter a few events a month. Today they skim a long rules page hunting for age, country, team size, video length, license, and the real deadline in India time. They miss one line and waste a weekend, or they miss the cutoff by half a day because 5:00 PM ET is 2:30 AM IST the next calendar day.

## The Core Loop

Open RuleCheck. Paste a Devpost rules URL or the rules text. Read the checklist. Type age, country, and whether you are a student. Rows flip to pass or fail. Look at the IST countdown. Enter, or skip.

## Inspiration and Identity

A preflight checklist, not a chat window. Paper, ink, and a stamp. Sharp corners, a serif title, mono for evidence quotes. The page should feel like a clerk who already highlighted the rules.

References: pilot checklists, a customs stamp, Devpost rules pages such as https://learn-ai-basics.devpost.com/rules.

## Why This Matters to the Learner

Aman keeps a list of hackathons and keeps losing time on the rules. The Build With AI: Basics deadline is the example that stings: 26 Oct 2026, 5:00 PM EDT is 27 Oct 2026, 2:30 AM IST. He wants that conversion, and the eligibility call, on one screen before he writes any code for the event itself.

## What "Working" Looks Like

With no API key, load the built-in sample. The checklist shows ages 18+, solo allowed, a 1 to 3 minute video, a public repo, an open source license, deploy optional, existing code not allowed, and the deadline as Tue, 27 Oct 2026, 2:30 AM IST plus a live countdown. Set age to 16 and the age row fails. Set age to 21, country India, not a student, entering solo, and the eligibility rows pass. Switch to the student sprint sample and watch country, student, and solo fail. That screen is the demo.

## The POC Boundary

One page. URL or pasted text. Extract eligibility (age, student, country, team size, solo), deliverables (video length, repo, license, deployed link), the deadline in IST with a countdown, and whether existing code is allowed. Profile pass or fail for eligibility. An OpenAI-compatible LLM when env vars are set. A rules engine when they are not. No login. Deploys on Vercel.

## Later

Saved checks, a browser extension, a calendar file for the deadline, side by side compare of two events.

## Explicitly Cut

Accounts and a database. The profile stays in the browser. PDF upload. A crawler that watches every Devpost page. Auto-submitting the hackathon entry. Team chat. Multi-language rules. Those do not prove the checklist.
