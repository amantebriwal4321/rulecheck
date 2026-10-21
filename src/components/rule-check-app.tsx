"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCountdown } from "@/lib/deadline";
import { OPEN_SPRINT, STUDENT_SPRINT } from "@/lib/samples";
import { scoreRules, tally } from "@/lib/score";
import type { CheckItem, CheckStatus, DeadlineInfo, Extraction, ProfileInput } from "@/lib/types";
import { cn } from "cn";

const STORAGE_KEY = "rulecheck.profile.v1";

type Mode = "url" | "text";
type EngineStatus = { mode: "llm" | "rules"; model: string | null; host: string | null };

type ProfileForm = {
  age: string;
  country: string;
  student: "" | "yes" | "no";
  entry: "" | "solo" | "team";
  teamSize: string;
  reusingCode: "" | "yes" | "no";
};

const EMPTY_PROFILE: ProfileForm = {
  age: "",
  country: "",
  student: "",
  entry: "",
  teamSize: "",
  reusingCode: "",
};

const profileListeners = new Set<() => void>();
let profileSnapshot: ProfileForm = EMPTY_PROFILE;
let profileHydrated = false;

function emitProfile() {
  profileListeners.forEach((listener) => listener());
}

function readStoredProfile(saved: Partial<ProfileForm>): ProfileForm {
  return {
    age: typeof saved.age === "string" ? saved.age : "",
    country: typeof saved.country === "string" ? saved.country : "",
    student: saved.student === "yes" || saved.student === "no" ? saved.student : "",
    entry: saved.entry === "solo" || saved.entry === "team" ? saved.entry : "",
    teamSize: typeof saved.teamSize === "string" ? saved.teamSize : "",
    reusingCode: saved.reusingCode === "yes" || saved.reusingCode === "no" ? saved.reusingCode : "",
  };
}

function hydrateProfile() {
  if (profileHydrated || typeof window === "undefined") return;
  profileHydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    profileSnapshot = readStoredProfile(JSON.parse(raw) as Partial<ProfileForm>);
  } catch {
    profileSnapshot = EMPTY_PROFILE;
  }
}

function subscribeProfile(listener: () => void) {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

function getProfileSnapshot() {
  hydrateProfile();
  return profileSnapshot;
}

function getServerProfileSnapshot() {
  return EMPTY_PROFILE;
}

function updateProfile(next: ProfileForm) {
  profileSnapshot = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitProfile();
}

const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: "bg-pass text-white",
  fail: "bg-fail text-white",
  unknown: "bg-warn text-white",
  info: "bg-ink text-[#f4f0e6]",
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function toProfile(form: ProfileForm): ProfileInput {
  const age = /^\d{1,3}$/.test(form.age.trim()) ? Number(form.age) : null;
  const teamSize = /^\d{1,2}$/.test(form.teamSize.trim()) ? Number(form.teamSize) : null;
  return {
    age: age != null && age >= 1 && age <= 120 ? age : null,
    country: form.country.trim(),
    student: form.student || null,
    entry: form.entry || null,
    teamSize: teamSize != null && teamSize >= 1 && teamSize <= 20 ? teamSize : null,
    reusingCode: form.reusingCode || null,
  };
}

function Choice({
  name,
  value,
  current,
  label,
  onChange,
}: {
  name: string;
  value: string;
  current: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const selected = current === value;
  return (
    <label
      className={cn(
        "flex min-h-10 cursor-pointer items-center justify-center border px-3 text-sm focus-within:ring-2 focus-within:ring-stamp",
        selected ? "border-stamp bg-stamp text-[#f4f0e6]" : "border-border bg-card text-foreground",
      )}
    >
      <input
        className="sr-only"
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      {label}
    </label>
  );
}

function DeadlineCard({ deadline }: { deadline: DeadlineInfo }) {
  const now = useNow();
  return (
    <Card className="rounded-sm bg-card shadow-none ring-stamp/20">
      <CardHeader>
        <p className="font-mono text-[11px] tracking-[0.16em] text-stamp uppercase">Deadline in IST</p>
        <CardTitle className="font-serif text-3xl leading-tight text-ink md:text-4xl">
          <span data-testid="deadline-ist">{deadline.istLabel ?? "No pinned deadline"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {deadline.utc ? (
          <p className="font-mono text-lg text-stamp" data-testid="countdown">
            {formatCountdown(deadline.utc, now)}
          </p>
        ) : (
          <p className="font-mono text-sm text-warn">Countdown off</p>
        )}
        {deadline.raw ? <p className="font-mono text-xs text-muted-foreground">From: {deadline.raw}</p> : null}
        {deadline.note ? <p className="text-sm text-muted-foreground">{deadline.note}</p> : null}
        {deadline.evidence ? (
          <blockquote className="border-l-2 border-stamp/40 pl-3 font-mono text-xs text-muted-foreground">
            {deadline.evidence}
          </blockquote>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CheckRow({ item }: { item: CheckItem }) {
  return (
    <li
      className="border-b border-border py-3 last:border-b-0"
      data-testid={`check-${item.id}`}
      data-status={item.status}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-6 shrink-0 items-center px-2 font-mono text-[10px] tracking-wide uppercase",
            STATUS_CLASS[item.status],
          )}
        >
          {item.badge}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-sm text-muted-foreground">{item.detail}</p>
          {item.evidence ? (
            <blockquote className="mt-2 border-l-2 border-stamp/30 pl-3 font-mono text-xs text-muted-foreground">
              {item.evidence}
            </blockquote>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function RuleCheckApp() {
  const [mode, setMode] = useState<Mode>("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const profile = useSyncExternalStore(subscribeProfile, getProfileSnapshot, getServerProfileSnapshot);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then((data: EngineStatus) => setEngine(data))
      .catch(() => setEngine(null));
  }, []);

  function setProfile(updater: (current: ProfileForm) => ProfileForm) {
    updateProfile(updater(getProfileSnapshot()));
  }

  const scored = useMemo(
    () => (extraction ? scoreRules(extraction, toProfile(profile)) : []),
    [extraction, profile],
  );
  const counts = tally(scored);
  const ageInvalid = profile.age.trim() !== "" && !/^\d{1,3}$/.test(profile.age.trim());

  async function runCheck(body: { url?: string; text?: string }) {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; extraction: Extraction }
        | { ok: false; error?: string }
        | null;
      if (!response.ok || !data || !("ok" in data) || !data.ok) {
        setError(data && "error" in data && data.error ? data.error : "Could not read those rules.");
        return;
      }
      setExtraction(data.extraction);
    } catch {
      setError("The request failed. If you have the rules open, paste the text.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "url") {
      if (!url.trim()) {
        setError("Add a rules URL, or switch to paste.");
        return;
      }
      void runCheck({ url: url.trim() });
      return;
    }
    if (text.trim().length < 40) {
      setError("Paste a bit more of the rules. A sentence or two is too short.");
      return;
    }
    void runCheck({ text });
  }

  function loadSample(sample: string) {
    setMode("text");
    setText(sample);
    setError(null);
    void runCheck({ text: sample });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-stamp uppercase">Hackathon preflight</p>
          <h1 className="font-serif text-5xl tracking-tight text-ink md:text-6xl">RuleCheck</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
            Paste a hackathon rules URL or the rules themselves. See who can enter, what you must ship, and the
            deadline in IST.
          </p>
        </div>
        <Badge variant="outline" className="h-7 rounded-sm px-3 font-mono text-[11px] tracking-wide uppercase">
          {engine?.mode === "llm" ? `Model ready · ${engine.model}` : "Rules engine"}
        </Badge>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <form onSubmit={onSubmit} className="order-1 space-y-4 lg:col-start-1 lg:row-start-1">
          <Card className="rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2" role="group" aria-label="Rules input">
                <Button
                  type="button"
                  variant={mode === "url" ? "default" : "outline"}
                  className="h-10 rounded-none"
                  aria-pressed={mode === "url"}
                  onClick={() => setMode("url")}
                >
                  URL
                </Button>
                <Button
                  type="button"
                  variant={mode === "text" ? "default" : "outline"}
                  className="h-10 rounded-none"
                  aria-pressed={mode === "text"}
                  onClick={() => setMode("text")}
                >
                  Paste text
                </Button>
              </div>
              {mode === "url" ? (
                <div className="space-y-2">
                  <Label htmlFor="rules-url">Rules URL</Label>
                  <Input
                    id="rules-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/rules"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    className="h-10 rounded-sm"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="rules-text">Rules text</Label>
                  <Textarea
                    id="rules-text"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={8}
                    placeholder="Paste the eligibility, deliverables, and deadline."
                    className="min-h-40 rounded-sm"
                  />
                </div>
              )}
              <Button type="submit" className="h-11 w-full rounded-sm" disabled={loading}>
                {loading ? "Reading the rules" : "Check the rules"}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-sm" onClick={() => loadSample(OPEN_SPRINT)}>
                  Try open sprint
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-sm"
                  onClick={() => loadSample(STUDENT_SPRINT)}
                >
                  Try student sprint
                </Button>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-fail">
                  {error}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </form>

        <section
          aria-live="polite"
          className="order-2 space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2"
        >
          {extraction ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] tracking-[0.16em] text-stamp uppercase">
                    {extraction.readerLabel}
                  </p>
                  <h2 className="font-serif text-3xl text-ink">{extraction.eventName ?? "Rules check"}</h2>
                </div>
                <p className="font-mono text-xs text-muted-foreground" data-testid="tally">
                  {counts.pass} pass · {counts.fail} fail · {counts.unknown} to fill
                </p>
              </div>
              {extraction.warnings.length > 0 ? (
                <div className="border border-warn/40 bg-[#f4ead4] px-3 py-2 text-sm text-warn">
                  {extraction.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
              <DeadlineCard deadline={extraction.deadline} />
              <Checklist items={scored} />
            </>
          ) : (
            <Card className="rounded-sm shadow-none">
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Nothing checked yet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Run a sample or paste rules. The checklist lands here.</p>
                <ul className="space-y-2">
                  <li>Eligibility rows pass or fail once your age, country, and student status are filled.</li>
                  <li>Deliverables cover the video, the repo, the license, and a deployed link.</li>
                  <li>The deadline is shown in IST, with a live countdown when the rules name a timezone.</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </section>

        <Card className="order-3 rounded-sm shadow-none lg:col-start-1 lg:row-start-2">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Your profile</CardTitle>
            <p className="text-sm text-muted-foreground">
              Saved in this browser. Used only to score the checklist.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  inputMode="numeric"
                  value={profile.age}
                  onChange={(event) => setProfile((current) => ({ ...current, age: event.target.value }))}
                  className="h-10 rounded-sm"
                  aria-invalid={ageInvalid}
                />
                {ageInvalid ? <p className="text-xs text-fail">Enter an age as a whole number.</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={profile.country}
                  placeholder="India"
                  onChange={(event) => setProfile((current) => ({ ...current, country: event.target.value }))}
                  className="h-10 rounded-sm"
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Student</legend>
              <div className="grid grid-cols-2">
                <Choice
                  name="student"
                  value="yes"
                  current={profile.student}
                  label="Yes"
                  onChange={(value) => setProfile((current) => ({ ...current, student: value as "yes" }))}
                />
                <Choice
                  name="student"
                  value="no"
                  current={profile.student}
                  label="No"
                  onChange={(value) => setProfile((current) => ({ ...current, student: value as "no" }))}
                />
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Entering</legend>
              <div className="grid grid-cols-2">
                <Choice
                  name="entry"
                  value="solo"
                  current={profile.entry}
                  label="Solo"
                  onChange={(value) => setProfile((current) => ({ ...current, entry: value as "solo" }))}
                />
                <Choice
                  name="entry"
                  value="team"
                  current={profile.entry}
                  label="Team"
                  onChange={(value) => setProfile((current) => ({ ...current, entry: value as "team" }))}
                />
              </div>
            </fieldset>
            {profile.entry === "team" ? (
              <div className="space-y-2">
                <Label htmlFor="team-size">Team size</Label>
                <Input
                  id="team-size"
                  inputMode="numeric"
                  value={profile.teamSize}
                  onChange={(event) => setProfile((current) => ({ ...current, teamSize: event.target.value }))}
                  className="h-10 rounded-sm"
                />
              </div>
            ) : null}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Reusing code you already wrote</legend>
              <div className="grid grid-cols-2">
                <Choice
                  name="reusing"
                  value="yes"
                  current={profile.reusingCode}
                  label="Yes"
                  onChange={(value) =>
                    setProfile((current) => ({ ...current, reusingCode: value as "yes" }))
                  }
                />
                <Choice
                  name="reusing"
                  value="no"
                  current={profile.reusingCode}
                  label="No"
                  onChange={(value) => setProfile((current) => ({ ...current, reusingCode: value as "no" }))}
                />
              </div>
            </fieldset>
            <Button
              type="button"
              variant="ghost"
              className="rounded-sm px-0"
              onClick={() => setProfile(() => EMPTY_PROFILE)}
            >
              Clear profile
            </Button>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        RuleCheck by Aman Tebriwal. MIT license. The checklist quotes rules and compares your profile. It is a
        preflight, not legal advice.
      </footer>
    </div>
  );
}

function Checklist({ items }: { items: CheckItem[] }) {
  const groups: { id: CheckItem["group"]; label: string }[] = [
    { id: "eligibility", label: "Eligibility" },
    { id: "deliverables", label: "Deliverables" },
    { id: "code", label: "Existing code" },
  ];
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const rows = items.filter((item) => item.group === group.id);
        if (rows.length === 0) return null;
        return (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h3 id={`group-${group.id}`} className="font-mono text-[11px] tracking-[0.16em] text-stamp uppercase">
              {group.label}
            </h3>
            <ul className="mt-1">
              {rows.map((item) => (
                <CheckRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
