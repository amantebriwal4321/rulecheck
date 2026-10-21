import { displayPlace, samePlace } from "@/lib/countries";
import type { CheckItem, CheckTally, Extraction, ProfileInput, Tri } from "@/lib/types";

function ageTitle(minAge: number | null, maxAge: number | null): string {
  if (minAge != null && maxAge != null) return `Age ${minAge} to ${maxAge}`;
  if (minAge != null) return `Age ${minAge}+`;
  if (maxAge != null) return `Age ${maxAge} or under`;
  return "Age";
}

function teamTitle(min: number | null, max: number | null): string {
  if (min != null && max != null && min > 1) return `Team size ${min} to ${max}`;
  if (min != null && max != null) return `Team size ${min} to ${max}`;
  if (max != null) return `Team size up to ${max}`;
  if (min != null) return `Team size at least ${min}`;
  return "Team size";
}

function videoLength(extraction: Extraction): string | null {
  const { videoMinMinutes, videoMaxMinutes } = extraction.deliverables;
  if (videoMinMinutes != null && videoMaxMinutes != null) {
    return `${videoMinMinutes} to ${videoMaxMinutes} minutes.`;
  }
  if (videoMaxMinutes != null) return `Up to ${videoMaxMinutes} minutes.`;
  if (videoMinMinutes != null) return `At least ${videoMinMinutes} minutes.`;
  return null;
}

function requirementCopy(tri: Tri): { status: CheckItem["status"]; badge: string; lead: string } {
  if (tri === "required") return { status: "info", badge: "Required", lead: "The rules ask for this." };
  if (tri === "not_required") return { status: "info", badge: "Optional", lead: "The rules do not require this." };
  return { status: "unknown", badge: "Check", lead: "The rules do not state this." };
}

function partySize(profile: ProfileInput): number | null {
  if (profile.entry === "solo") return 1;
  if (profile.entry === "team") {
    if (profile.teamSize == null || !Number.isInteger(profile.teamSize) || profile.teamSize < 1 || profile.teamSize > 20) {
      return null;
    }
    return profile.teamSize;
  }
  return null;
}

export function scoreRules(extraction: Extraction, profile: ProfileInput): CheckItem[] {
  const { eligibility, deliverables } = extraction;
  const items: CheckItem[] = [];

  const ageLabel = ageTitle(eligibility.minAge, eligibility.maxAge);
  if (eligibility.minAge == null && eligibility.maxAge == null) {
    items.push({
      id: "age",
      group: "eligibility",
      status: eligibility.ageNote ? "unknown" : "info",
      badge: eligibility.ageNote ? "Check" : "Note",
      title: "Age",
      detail: eligibility.ageNote ?? "The rules do not state an age limit.",
      evidence: eligibility.ageEvidence,
    });
  } else if (profile.age == null) {
    items.push({
      id: "age",
      group: "eligibility",
      status: "unknown",
      badge: "Check",
      title: ageLabel,
      detail: "Add your age to score this.",
      evidence: eligibility.ageEvidence,
    });
  } else if (
    (eligibility.minAge != null && profile.age < eligibility.minAge) ||
    (eligibility.maxAge != null && profile.age > eligibility.maxAge)
  ) {
    items.push({
      id: "age",
      group: "eligibility",
      status: "fail",
      badge: "Fail",
      title: ageLabel,
      detail: `You are ${profile.age}.`,
      evidence: eligibility.ageEvidence,
    });
  } else {
    items.push({
      id: "age",
      group: "eligibility",
      status: "pass",
      badge: "Pass",
      title: ageLabel,
      detail: `You are ${profile.age}.`,
      evidence: eligibility.ageEvidence,
    });
  }

  if (eligibility.student === "unknown") {
    items.push({
      id: "student",
      group: "eligibility",
      status: "unknown",
      badge: "Check",
      title: "Student status",
      detail: "The rules do not say whether you must be a student.",
      evidence: eligibility.studentEvidence,
    });
  } else if (eligibility.student === "not_required") {
    items.push({
      id: "student",
      group: "eligibility",
      status: "pass",
      badge: "Pass",
      title: "Student status not required",
      detail: "Anyone clears this row.",
      evidence: eligibility.studentEvidence,
    });
  } else if (profile.student == null) {
    items.push({
      id: "student",
      group: "eligibility",
      status: "unknown",
      badge: "Check",
      title: "Students only",
      detail: "Say whether you are a student.",
      evidence: eligibility.studentEvidence,
    });
  } else if (profile.student === "yes") {
    items.push({
      id: "student",
      group: "eligibility",
      status: "pass",
      badge: "Pass",
      title: "Students only",
      detail: "You are a student.",
      evidence: eligibility.studentEvidence,
    });
  } else {
    items.push({
      id: "student",
      group: "eligibility",
      status: "fail",
      badge: "Fail",
      title: "Students only",
      detail: "You are not a student.",
      evidence: eligibility.studentEvidence,
    });
  }

  if (eligibility.countryMode === "unknown") {
    items.push({
      id: "country",
      group: "eligibility",
      status: "info",
      badge: "Note",
      title: "Country",
      detail: "The rules do not name a country limit.",
      evidence: eligibility.countryEvidence,
    });
  } else if (eligibility.countryMode === "any") {
    items.push({
      id: "country",
      group: "eligibility",
      status: "pass",
      badge: "Pass",
      title: "Open worldwide",
      detail: "No country block list was found.",
      evidence: eligibility.countryEvidence,
    });
  } else if (!profile.country.trim()) {
    items.push({
      id: "country",
      group: "eligibility",
      status: "unknown",
      badge: "Check",
      title: eligibility.countryMode === "deny" ? "Country block list" : "Country allow list",
      detail: "Add your country to score this.",
      evidence: eligibility.countryEvidence,
    });
  } else {
    const entered = displayPlace(profile.country);
    const hit = eligibility.countries.some((place) => samePlace(place, profile.country));
    const list = eligibility.countries.join(", ");
    if (eligibility.countryMode === "deny") {
      items.push({
        id: "country",
        group: "eligibility",
        status: hit ? "fail" : "pass",
        badge: hit ? "Fail" : "Pass",
        title: "Country block list",
        detail: hit
          ? `${entered} is blocked. List: ${list}.`
          : `${entered} is not on the block list. List: ${list}.`,
        evidence: eligibility.countryEvidence,
      });
    } else {
      items.push({
        id: "country",
        group: "eligibility",
        status: hit ? "pass" : "fail",
        badge: hit ? "Pass" : "Fail",
        title: "Country allow list",
        detail: hit ? `${entered} is on the allow list.` : `${entered} is outside the allow list: ${list}.`,
        evidence: eligibility.countryEvidence,
      });
    }
  }

  if (eligibility.soloAllowed === "unknown") {
    items.push({
      id: "solo",
      group: "eligibility",
      status: "unknown",
      badge: "Check",
      title: "Solo entry",
      detail: "The rules do not say whether solo entries are allowed.",
      evidence: eligibility.teamEvidence,
    });
  } else if (profile.entry == null) {
    items.push({
      id: "solo",
      group: "eligibility",
      status: "unknown",
      badge: "Check",
      title: "Solo entry",
      detail:
        eligibility.soloAllowed === "yes"
          ? "Solo entries are allowed. Say how you are entering."
          : "Solo entries are not allowed. Say how you are entering.",
      evidence: eligibility.teamEvidence,
    });
  } else if (eligibility.soloAllowed === "yes") {
    items.push({
      id: "solo",
      group: "eligibility",
      status: "pass",
      badge: "Pass",
      title: "Solo entry allowed",
      detail: profile.entry === "solo" ? "You are entering solo." : "You are entering as a team. Solo would also be allowed.",
      evidence: eligibility.teamEvidence,
    });
  } else if (profile.entry === "solo") {
    items.push({
      id: "solo",
      group: "eligibility",
      status: "fail",
      badge: "Fail",
      title: "Solo entry not allowed",
      detail: "You are entering solo.",
      evidence: eligibility.teamEvidence,
    });
  } else {
    items.push({
      id: "solo",
      group: "eligibility",
      status: "pass",
      badge: "Pass",
      title: "Solo entry not allowed",
      detail: "You are entering as a team.",
      evidence: eligibility.teamEvidence,
    });
  }

  if (eligibility.teamMin == null && eligibility.teamMax == null) {
    items.push({
      id: "team",
      group: "eligibility",
      status: "info",
      badge: "Note",
      title: "Team size",
      detail: "The rules do not state a team size.",
      evidence: eligibility.teamEvidence,
    });
  } else {
    const size = partySize(profile);
    const title = teamTitle(eligibility.teamMin, eligibility.teamMax);
    if (profile.entry == null || (profile.entry === "team" && size == null)) {
      items.push({
        id: "team",
        group: "eligibility",
        status: "unknown",
        badge: "Check",
        title,
        detail: profile.entry === "team" ? "Add your team size." : "Say whether you are solo or on a team.",
        evidence: eligibility.teamEvidence,
      });
    } else if (
      (eligibility.teamMin != null && size != null && size < eligibility.teamMin) ||
      (eligibility.teamMax != null && size != null && size > eligibility.teamMax)
    ) {
      items.push({
        id: "team",
        group: "eligibility",
        status: "fail",
        badge: "Fail",
        title,
        detail: profile.entry === "solo" ? "Solo counts as a team of 1." : `Your team has ${size} people.`,
        evidence: eligibility.teamEvidence,
      });
    } else {
      items.push({
        id: "team",
        group: "eligibility",
        status: "pass",
        badge: "Pass",
        title,
        detail: profile.entry === "solo" ? "Solo counts as a team of 1." : `Your team has ${size} people.`,
        evidence: eligibility.teamEvidence,
      });
    }
  }

  const video = requirementCopy(deliverables.video);
  const length = videoLength(extraction);
  items.push({
    id: "video",
    group: "deliverables",
    status: video.status,
    badge: video.badge,
    title: "Demo video",
    detail: [length, video.lead].filter(Boolean).join(" "),
    evidence: deliverables.videoEvidence,
  });

  const repo = requirementCopy(deliverables.repo);
  items.push({
    id: "repo",
    group: "deliverables",
    status: repo.status,
    badge: repo.badge,
    title: "Public repository",
    detail: repo.lead,
    evidence: deliverables.repoEvidence,
  });

  const license = requirementCopy(deliverables.license);
  items.push({
    id: "license",
    group: "deliverables",
    status: license.status,
    badge: license.badge,
    title: "License",
    detail: deliverables.licenseName
      ? `${deliverables.licenseName} is named. ${license.lead}`
      : license.lead,
    evidence: deliverables.licenseEvidence,
  });

  const deploy = requirementCopy(deliverables.deploy);
  items.push({
    id: "deploy",
    group: "deliverables",
    status: deploy.status,
    badge: deploy.badge,
    title: "Deployed link",
    detail: deploy.lead,
    evidence: deliverables.deployEvidence,
  });

  if (extraction.existingCodeAllowed === "unknown") {
    items.push({
      id: "existing-code",
      group: "code",
      status: "unknown",
      badge: "Check",
      title: "Existing code",
      detail: "The rules do not say whether existing code is allowed.",
      evidence: extraction.existingCodeEvidence,
    });
  } else if (extraction.existingCodeAllowed === "yes") {
    items.push({
      id: "existing-code",
      group: "code",
      status: "pass",
      badge: "Pass",
      title: "Existing code allowed",
      detail:
        profile.reusingCode === "yes"
          ? "You can reuse code you already wrote."
          : "Existing code is allowed.",
      evidence: extraction.existingCodeEvidence,
    });
  } else if (profile.reusingCode == null) {
    items.push({
      id: "existing-code",
      group: "code",
      status: "unknown",
      badge: "Check",
      title: "Existing code not allowed",
      detail: "Say if you are reusing code you already wrote.",
      evidence: extraction.existingCodeEvidence,
    });
  } else if (profile.reusingCode === "yes") {
    items.push({
      id: "existing-code",
      group: "code",
      status: "fail",
      badge: "Fail",
      title: "Existing code not allowed",
      detail: "You said you are reusing code.",
      evidence: extraction.existingCodeEvidence,
    });
  } else {
    items.push({
      id: "existing-code",
      group: "code",
      status: "pass",
      badge: "Pass",
      title: "Existing code not allowed",
      detail: "You are starting clean.",
      evidence: extraction.existingCodeEvidence,
    });
  }

  return items;
}

export function tally(items: CheckItem[]): CheckTally {
  return items.reduce<CheckTally>(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pass: 0, fail: 0, unknown: 0, info: 0 },
  );
}
