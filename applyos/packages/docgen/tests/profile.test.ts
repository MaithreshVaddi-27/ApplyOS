// Phase 6.2 — the shared profile schema, checked field by field.
import { expect, test } from "bun:test";
import {
  defaultProfile,
  loadProfileFile,
  PROFILE_SCHEMA_VERSION,
  ProfileError,
  validateProfile,
} from "../src/profile";

const valid = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  name: "Test Candidate",
  email: "t@example.com",
  skills: ["python", "react"],
  experience: [{ role: "Engineer", company: "Acme", period: "2025", bullets: [{ text: "Built APIs", source: "01-candidate-profile.md#achievements" }] }],
  education: [{ degree: "B.Tech", school: "U" }],
  documentType: "cv",
  salary: { stipendFloor: 20000, ctcFloor: 6 },
};

test("a valid profile round-trips with no warnings", () => {
  const r = validateProfile(valid, false);
  expect(r.profile).toEqual(valid);
  expect(r.warnings).toEqual([]);
});

test("malformed values name the exact field", () => {
  const cases: Array<[unknown, string]> = [
    [null, "must be an object"],
    [{ ...valid, name: "" }, "name must be a non-empty string"],
    [{ ...valid, email: 42 }, "email must be a non-empty string"],
    [{ ...valid, skills: ["python", 7] }, "skills[1] must be a string"],
    [{ ...valid, skills: "python" }, "skills must be an array of strings"],
    [{ ...valid, experience: [{ role: "R", company: "C", period: 2025, bullets: [] }] }, "experience[0].period must be a string"],
    [{ ...valid, experience: [{ ...valid.experience[0], bullets: [{ text: 5 }] }] }, "experience[0].bullets[0].text must be a string"],
    [{ ...valid, education: [{ degree: "B.Tech", school: 7 }] }, "education[0].school must be a string"],
    [{ ...valid, links: ["x", 3] }, "links[1] must be a string"],
    [{ ...valid, salary: { ctcFloor: "6" } }, "salary.ctcFloor must be a number"],
    [{ ...valid, stage: " senior " }, "stage must be one of"],
    [{ ...valid, schemaVersion: 99 }, "schemaVersion 99 is unsupported"],
  ];
  for (const [input, expected] of cases) {
    try {
      validateProfile(input, false);
      throw new Error(`expected failure for ${expected}`);
    } catch (e) {
      expect(e).toBeInstanceOf(ProfileError);
      expect((e as Error).message).toContain(expected);
      expect((e as Error).message.startsWith("profile invalid: ")).toBe(true);
    }
  }
});

test("a bullet without a source warns but does not fail", () => {
  const noSource = { ...valid, experience: [{ ...valid.experience[0], bullets: [{ text: "Built APIs" }] }] };
  const r = validateProfile(noSource, false);
  expect(r.warnings).toHaveLength(1);
  expect(r.warnings[0]).toContain("experience[0].bullets[0] has no source");
});

test("a source that does not exist is rejected", () => {
  const withSource = { ...valid, source: { profile: "no-such-profile.md" } };
  try {
    validateProfile(withSource, true);
    throw new Error("expected failure");
  } catch (e) {
    expect((e as Error).message).toContain('source.profile "no-such-profile.md" does not exist');
  }
});

test("missing and unreadable files keep the engine's error prefixes", () => {
  try {
    loadProfileFile("no-such-profile.json");
    throw new Error("expected failure");
  } catch (e) {
    expect((e as Error).message).toBe("profile not found: no-such-profile.json");
  }
  expect(defaultProfile().skills).toEqual([]);
});
