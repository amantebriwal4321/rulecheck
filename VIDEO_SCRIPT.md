# RuleCheck demo script

Aim for about 2 minutes. Screen recording, no music. Speak the lines. Do the clicks on the beats so the recording shows the app working.

Record on http://127.0.0.1:4317 after `npm run dev`, with no API key set, so the badge says Rules engine. That is the point.

## 0:00 to 0:20

On screen: the empty RuleCheck page. Point at the headline.

Say: I enter a lot of hackathons, and I lose time on the rules. I need age, country, team size, the ship list, and the real deadline in India. RuleCheck turns that page into a checklist.

## 0:20 to 0:45

Click "Try open sprint". Wait until the checklist appears. Point at the reader line "Rules engine" and the deadline card.

Say: This sample has no model key. The built-in reader still gets it. Ages 18 plus, solo allowed, a 1 to 3 minute video, a public repo, an open source license, deploy optional, and existing code is out. The deadline was 26 October 2026, 5:00 PM Eastern. Here it is in IST: 27 October, 2:30 AM, with a countdown.

## 0:45 to 1:15

In the profile, set age to 16. Point at the age row flipping to Fail.

Say: Sixteen fails the age row immediately. I do not send the profile anywhere. It stays in the browser.

Change age to 21. Country: India. Student: No. Entering: Solo. Reusing code: No.

Say: Twenty one, India, not a student, solo, starting clean. Those eligibility rows pass. I can decide to enter before I write a line of code.

## 1:15 to 1:45

Click "Try student sprint". Leave age 21, India, not a student, solo.

Say: Same person, stricter rules. Students only, teams of 2 to 4, solo is out. Student and solo fail. India still passes, because this one is India only.

Change country to United States.

Say: United States is outside that list, so the country row fails. I would skip this one.

## 1:45 to 2:05

Scroll the deliverables: 2 minute video, repo, MIT license, deployed link required. Point at the IST deadline, 15 November 2026, 11:59 PM.

Say: The ship list records what the rules ask for. It does not pretend I already recorded the video. If I add an API key later, an OpenAI-compatible model fills the gaps and the rules engine still covers anything the model misses. No login. It deploys on Vercel as a normal Next app.

## 2:05 to 2:15

Back on the open sprint deadline.

Say: RuleCheck is the preflight. Paste the rules, check yourself, see the deadline in IST. Then start building, or walk away.
