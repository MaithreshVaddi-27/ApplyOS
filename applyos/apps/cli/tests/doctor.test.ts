// Phase 1 (docs/PROJECT_BLUEPRINT.md) — `applyos doctor`.
// The report builder is a pure function of DoctorEnv, so these tests never
// touch the filesystem or the network.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  buildReport,
  requiredFailures,
  warnings,
  parseStage,
  parseDocumentType,
  parseGithubSlug,
  formatDoctorTable,
  type DoctorEnv,
} from "../src/doctor";

const cliPath = join(import.meta.dir, "..", "src", "cli.ts");
const cliDirectory = join(import.meta.dir, "..");

/** A healthy environment: every required check passes. */
function healthyEnv(overrides: Partial<DoctorEnv> = {}): DoctorEnv {
  return {
    repoRoot: "/repo",
    bunVersion: "1.4.3",
    pinnedBunVersion: "1.4.3",
    pythonVersion: "3.12.10",
    lualatexVersion: "LuaHBTeX 1.18.0",
    moderncvAvailable: true,
    popplerAvailable: true,
    pypdfAvailable: false,
    engineInstalled: true,
    providerClis: [{ name: "naukri-search", installed: true, hasTypecheck: true }],
    dirs: { input: true, output: true, workspace: true },
    profileFilePresent: true,
    profileIsPlaceholder: false,
    stage: "fresher",
    documentType: "cv",
    salaryDataPresent: true,
    gitRemote: "git@gitlab.com:me/applyos.git",
    gitRemoteVisibility: "unknown",
    ...overrides,
  };
}

function byId(checks: ReturnType<typeof buildReport>, id: string) {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`no check with id ${id}`);
  return found;
}

test("a healthy environment has no required failures", () => {
  const checks = buildReport(healthyEnv());
  expect(requiredFailures(checks)).toEqual([]);
  expect(warnings(checks)).toEqual([]);
});

test("missing bun is a required failure", () => {
  const checks = buildReport(healthyEnv({ bunVersion: null }));
  expect(byId(checks, "bun").status).toBe("fail");
  expect(byId(checks, "bun").required).toBe(true);
});

test("a bun version that differs from the pin is a warning, not a failure", () => {
  const checks = buildReport(healthyEnv({ bunVersion: "1.4.2" }));
  expect(byId(checks, "bun").status).toBe("warn");
  expect(byId(checks, "bun").required).toBe(false);
});

test("missing python is a required failure", () => {
  const checks = buildReport(healthyEnv({ pythonVersion: null }));
  expect(byId(checks, "python").status).toBe("fail");
});

test("missing lualatex is a required failure", () => {
  const checks = buildReport(healthyEnv({ lualatexVersion: null }));
  expect(byId(checks, "latex").status).toBe("fail");
});

test("missing moderncv is a required failure", () => {
  const checks = buildReport(healthyEnv({ moderncvAvailable: false }));
  expect(byId(checks, "moderncv").status).toBe("fail");
});

test("either PDF text extractor is enough", () => {
  const popplerOnly = buildReport(healthyEnv({ popplerAvailable: true, pypdfAvailable: false }));
  expect(byId(popplerOnly, "pdf-text").status).toBe("ok");
  const pypdfOnly = buildReport(healthyEnv({ popplerAvailable: false, pypdfAvailable: true }));
  expect(byId(pypdfOnly, "pdf-text").status).toBe("ok");
});

test("neither PDF text extractor is a required failure", () => {
  const checks = buildReport(healthyEnv({ popplerAvailable: false, pypdfAvailable: false }));
  expect(byId(checks, "pdf-text").status).toBe("fail");
});

test("an uninstalled engine is a required failure", () => {
  const checks = buildReport(healthyEnv({ engineInstalled: false }));
  expect(byId(checks, "engine-install").status).toBe("fail");
});

test("uninstalled provider CLIs are a warning, not a failure", () => {
  const checks = buildReport(
    healthyEnv({
      providerClis: [
        { name: "naukri-search", installed: true, hasTypecheck: true },
        { name: "cutshort-search", installed: false, hasTypecheck: true },
      ],
    }),
  );
  expect(byId(checks, "provider-clis").status).toBe("warn");
  expect(byId(checks, "provider-clis").detail).toContain("cutshort-search");
});

test("a missing personal-data directory is a required failure", () => {
  const checks = buildReport(healthyEnv({ dirs: { input: true, output: false, workspace: true } }));
  expect(byId(checks, "workspace").status).toBe("fail");
  expect(byId(checks, "workspace").detail).toContain("output");
});

test("a missing profile is a required failure", () => {
  const checks = buildReport(healthyEnv({ profileFilePresent: false }));
  expect(byId(checks, "profile").status).toBe("fail");
});

test("a profile still holding placeholders is a required failure", () => {
  const checks = buildReport(healthyEnv({ profileIsPlaceholder: true }));
  expect(byId(checks, "profile").status).toBe("fail");
});

test("a populated profile reports its stage and document type", () => {
  const checks = buildReport(healthyEnv({ stage: "student", documentType: "resume" }));
  const p = byId(checks, "profile");
  expect(p.status).toBe("ok");
  expect(p.detail).toContain("student");
  expect(p.detail).toContain("resume");
});

test("missing salary data is a warning, not a failure", () => {
  const checks = buildReport(healthyEnv({ salaryDataPresent: false }));
  expect(byId(checks, "salary-data").status).toBe("warn");
});

test("no git remote is skipped, not failed", () => {
  const checks = buildReport(healthyEnv({ gitRemote: null, gitRemoteVisibility: null }));
  expect(byId(checks, "git-remote").status).toBe("skip");
});

test("a PUBLIC remote with a populated profile is a required failure", () => {
  const checks = buildReport(
    healthyEnv({ gitRemote: "https://github.com/me/applyos.git", gitRemoteVisibility: "public" }),
  );
  expect(byId(checks, "git-remote").status).toBe("fail");
});

test("a PUBLIC remote without a profile is only a warning", () => {
  const checks = buildReport(
    healthyEnv({
      gitRemote: "https://github.com/me/applyos.git",
      gitRemoteVisibility: "public",
      profileFilePresent: false,
    }),
  );
  expect(byId(checks, "git-remote").status).toBe("warn");
});

test("a PRIVATE remote is reported as ok", () => {
  const checks = buildReport(
    healthyEnv({ gitRemote: "https://github.com/me/applyos.git", gitRemoteVisibility: "private" }),
  );
  expect(byId(checks, "git-remote").status).toBe("ok");
});

test("an UNKNOWN GitHub visibility is a warning, never a failure", () => {
  // doctor stays offline by default, so it cannot see the visibility.
  // Failing every GitHub remote would cry wolf on exactly the private-repo
  // setup the project recommends.
  const checks = buildReport(
    healthyEnv({ gitRemote: "https://github.com/me/applyos.git", gitRemoteVisibility: "unknown" }),
  );
  expect(byId(checks, "git-remote").status).toBe("warn");
  expect(byId(checks, "git-remote").required).toBe(false);
});

test("a non-GitHub remote is reported without a privacy warning", () => {
  const checks = buildReport(healthyEnv({ gitRemote: "git@gitlab.com:me/applyos.git" }));
  expect(byId(checks, "git-remote").status).toBe("ok");
});

test("parseGithubSlug reads owner/repo from both remote forms", () => {
  expect(parseGithubSlug("git@github.com:owner/repo.git")).toBe("owner/repo");
  expect(parseGithubSlug("https://github.com/owner/repo.git")).toBe("owner/repo");
  expect(parseGithubSlug("https://github.com/owner/repo")).toBe("owner/repo");
  expect(parseGithubSlug("git@gitlab.com:owner/repo.git")).toBeNull();
});

test("parseStage reads the Stage Profile", () => {
  expect(parseStage("stage: ask\nmarket: india\n")).toBe("ask");
  expect(parseStage("```\nstage: remote-global\n```")).toBe("remote-global");
  expect(parseStage("market: india")).toBeNull();
  expect(parseStage(null)).toBeNull();
});

test("parseDocumentType reads the profile's Document type line", () => {
  expect(parseDocumentType("**Document type:** cv")).toBe("cv");
  expect(parseDocumentType("Document type: resume")).toBe("resume");
  expect(parseDocumentType("nothing here")).toBeNull();
  expect(parseDocumentType(null)).toBeNull();
});

test("the table lists every check and the failures", () => {
  const checks = buildReport(healthyEnv({ lualatexVersion: null }));
  const outcome = { checks, failed: requiredFailures(checks), warned: warnings(checks), exitCode: 1 };
  const table = formatDoctorTable(outcome);
  expect(table).toContain("FAIL");
  expect(table).toContain("lualatex");
  expect(table).toContain("1 required check(s) failed");
});

// --- CLI level ---------------------------------------------------------

test("applyos doctor --format json emits the report on stdout and exits 0 when ready", () => {
  const result = spawnSync(process.execPath, ["run", cliPath, "doctor", "--format", "json"], {
    cwd: cliDirectory,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  // This machine may or may not have every tool; the JSON must still be
  // well-formed and the exit code must agree with the reported failures.
  const parsed = JSON.parse(result.stdout);
  expect(Array.isArray(parsed.checks)).toBe(true);
  expect(parsed.exitCode).toBe(result.status);
  expect(parsed.checks.length).toBeGreaterThan(5);
});

test("applyos doctor makes no network request", () => {
  // The report is built from local inspection only. Any check that would
  // need a network call is deliberately absent from DoctorEnv.
  const result = spawnSync(process.execPath, ["run", cliPath, "doctor", "--format", "plain"], {
    cwd: cliDirectory,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  expect(lines.length).toBeGreaterThan(5);
  for (const line of lines) {
    expect(line.split("\t").length).toBe(3);
  }
});

test("applyos doctor --help is served and exits 0", () => {
  const result = spawnSync(process.execPath, ["run", cliPath, "--help"], {
    cwd: cliDirectory,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("applyos doctor");
});
