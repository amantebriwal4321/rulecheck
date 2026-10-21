import { describe, expect, it } from "vitest";
import { parseRules } from "@/lib/parse-rules";
import { OPEN_SPRINT, STUDENT_SPRINT } from "@/lib/samples";

describe("parseRules", () => {
  it("reads the open sprint sample", () => {
    const rules = parseRules(OPEN_SPRINT);
    expect(rules.eventName).toBe("Open sprint");
    expect(rules.eligibility.minAge).toBe(18);
    expect(rules.eligibility.maxAge).toBeNull();
    expect(rules.eligibility.student).toBe("not_required");
    expect(rules.eligibility.countryMode).toBe("deny");
    expect(rules.eligibility.countries).toEqual([
      "Brazil",
      "Quebec",
      "Russia",
      "Crimea",
      "Cuba",
      "Iran",
      "North Korea",
    ]);
    expect(rules.eligibility.soloAllowed).toBe("yes");
    expect(rules.eligibility.teamMax).toBe(4);
    expect(rules.deliverables.video).toBe("required");
    expect(rules.deliverables.videoMinMinutes).toBe(1);
    expect(rules.deliverables.videoMaxMinutes).toBe(3);
    expect(rules.deliverables.repo).toBe("required");
    expect(rules.deliverables.license).toBe("required");
    expect(rules.deliverables.licenseName).toBe("MIT");
    expect(rules.deliverables.deploy).toBe("not_required");
    expect(rules.existingCodeAllowed).toBe("no");
    expect(rules.deadline.utc).toBe("2026-10-26T21:00:00.000Z");
    expect(rules.eligibility.ageEvidence).toMatch(/18\+/);
  });

  it("reads the student sprint sample", () => {
    const rules = parseRules(STUDENT_SPRINT);
    expect(rules.eventName).toBe("Student sprint");
    expect(rules.eligibility.minAge).toBe(18);
    expect(rules.eligibility.maxAge).toBe(25);
    expect(rules.eligibility.student).toBe("required");
    expect(rules.eligibility.countryMode).toBe("allow");
    expect(rules.eligibility.countries).toEqual(["India"]);
    expect(rules.eligibility.soloAllowed).toBe("no");
    expect(rules.eligibility.teamMin).toBe(2);
    expect(rules.eligibility.teamMax).toBe(4);
    expect(rules.deliverables.videoMaxMinutes).toBe(2);
    expect(rules.deliverables.repo).toBe("required");
    expect(rules.deliverables.licenseName).toBe("MIT");
    expect(rules.deliverables.deploy).toBe("required");
    expect(rules.existingCodeAllowed).toBe("no");
    expect(rules.deadline.istLabel).toMatch(/11:59\s*PM/);
  });

  it("does not treat Node 18+ as a minimum age", () => {
    const rules = parseRules(
      "Use Node 18+ for the project. Participants must be 21 or older. Solo entries are allowed. A public repository is required for the submission package.",
    );
    expect(rules.eligibility.minAge).toBe(21);
  });

  it("allows existing code when the rules say so", () => {
    const rules = parseRules(
      "Hackathon rules. You may reuse existing projects. Teams of up to 3 are welcome. A demo video is optional. The license is optional too.",
    );
    expect(rules.existingCodeAllowed).toBe("yes");
    expect(rules.deliverables.video).toBe("not_required");
    expect(rules.deliverables.license).toBe("not_required");
  });
});
