import { describe, expect, it } from "vitest";
import { parseRules } from "@/lib/parse-rules";
import { scoreRules } from "@/lib/score";
import { OPEN_SPRINT, STUDENT_SPRINT } from "@/lib/samples";
import type { ProfileInput } from "@/lib/types";

const empty: ProfileInput = {
  age: null,
  country: "",
  student: null,
  entry: null,
  teamSize: null,
  reusingCode: null,
};

function status(rulesText: string, profile: ProfileInput, id: string) {
  const item = scoreRules(parseRules(rulesText), profile).find((row) => row.id === id);
  return item?.status;
}

describe("scoreRules", () => {
  it("leaves age unknown until a profile is entered, and passes student when it is not required", () => {
    expect(status(OPEN_SPRINT, empty, "age")).toBe("unknown");
    expect(status(OPEN_SPRINT, empty, "student")).toBe("pass");
    expect(status(OPEN_SPRINT, empty, "country")).toBe("unknown");
    expect(status(OPEN_SPRINT, empty, "existing-code")).toBe("unknown");
    expect(status(OPEN_SPRINT, empty, "deploy")).toBe("info");
    expect(status(OPEN_SPRINT, empty, "video")).toBe("info");
  });

  it("fails age 16 and passes a solo India profile on the open sprint", () => {
    expect(status(OPEN_SPRINT, { ...empty, age: 16 }, "age")).toBe("fail");
    const passing: ProfileInput = {
      age: 21,
      country: "India",
      student: "no",
      entry: "solo",
      teamSize: null,
      reusingCode: "no",
    };
    expect(status(OPEN_SPRINT, passing, "age")).toBe("pass");
    expect(status(OPEN_SPRINT, passing, "student")).toBe("pass");
    expect(status(OPEN_SPRINT, passing, "country")).toBe("pass");
    expect(status(OPEN_SPRINT, passing, "solo")).toBe("pass");
    expect(status(OPEN_SPRINT, passing, "team")).toBe("pass");
    expect(status(OPEN_SPRINT, passing, "existing-code")).toBe("pass");
  });

  it("fails a blocked country and reused code", () => {
    const profile: ProfileInput = {
      age: 21,
      country: "Brazil",
      student: "no",
      entry: "solo",
      teamSize: null,
      reusingCode: "yes",
    };
    expect(status(OPEN_SPRINT, profile, "country")).toBe("fail");
    expect(status(OPEN_SPRINT, profile, "existing-code")).toBe("fail");
    expect(status(OPEN_SPRINT, { ...profile, country: "Quebec" }, "country")).toBe("fail");
    expect(status(OPEN_SPRINT, { ...profile, country: "Canada" }, "country")).toBe("pass");
    expect(status(OPEN_SPRINT, { ...profile, country: "USA" }, "country")).toBe("pass");
  });

  it("fails a non-student from the US entering the student sprint solo", () => {
    const profile: ProfileInput = {
      age: 30,
      country: "United States",
      student: "no",
      entry: "solo",
      teamSize: null,
      reusingCode: "no",
    };
    expect(status(STUDENT_SPRINT, profile, "age")).toBe("fail");
    expect(status(STUDENT_SPRINT, profile, "student")).toBe("fail");
    expect(status(STUDENT_SPRINT, profile, "country")).toBe("fail");
    expect(status(STUDENT_SPRINT, profile, "solo")).toBe("fail");
    expect(status(STUDENT_SPRINT, profile, "team")).toBe("fail");
  });

  it("passes a student team of 3 from India", () => {
    const profile: ProfileInput = {
      age: 20,
      country: "India",
      student: "yes",
      entry: "team",
      teamSize: 3,
      reusingCode: "no",
    };
    for (const id of ["age", "student", "country", "solo", "team", "existing-code"]) {
      expect(status(STUDENT_SPRINT, profile, id)).toBe("pass");
    }
  });
});
