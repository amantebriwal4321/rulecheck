export type Tri = "required" | "not_required" | "unknown";
export type YesNo = "yes" | "no" | "unknown";
export type CountryMode = "any" | "allow" | "deny" | "unknown";
export type CheckStatus = "pass" | "fail" | "unknown" | "info";
export type CheckGroup = "eligibility" | "deliverables" | "code";

export type DeadlineInfo = {
  raw: string | null;
  utc: string | null;
  istLabel: string | null;
  evidence: string | null;
  note: string | null;
};

export type Extraction = {
  source: "llm" | "rules";
  readerLabel: string;
  eventName: string | null;
  eligibility: {
    minAge: number | null;
    maxAge: number | null;
    ageEvidence: string | null;
    ageNote: string | null;
    student: "required" | "not_required" | "unknown";
    studentEvidence: string | null;
    countryMode: CountryMode;
    countries: string[];
    countryEvidence: string | null;
    teamMin: number | null;
    teamMax: number | null;
    soloAllowed: YesNo;
    teamEvidence: string | null;
  };
  deliverables: {
    video: Tri;
    videoMinMinutes: number | null;
    videoMaxMinutes: number | null;
    videoEvidence: string | null;
    repo: Tri;
    repoEvidence: string | null;
    license: Tri;
    licenseName: string | null;
    licenseEvidence: string | null;
    deploy: Tri;
    deployEvidence: string | null;
  };
  deadline: DeadlineInfo;
  existingCodeAllowed: YesNo;
  existingCodeEvidence: string | null;
  warnings: string[];
};

export type ProfileInput = {
  age: number | null;
  country: string;
  student: "yes" | "no" | null;
  entry: "solo" | "team" | null;
  teamSize: number | null;
  reusingCode: "yes" | "no" | null;
};

export type CheckItem = {
  id: string;
  group: CheckGroup;
  status: CheckStatus;
  badge: string;
  title: string;
  detail: string;
  evidence: string | null;
};

export type CheckTally = {
  pass: number;
  fail: number;
  unknown: number;
  info: number;
};
