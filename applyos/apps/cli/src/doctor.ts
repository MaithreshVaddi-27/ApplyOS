// Origin: clean-room 2026-11-13, Phase 1 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export interface Check {
  /** Stable identifier, e.g. "bun", "latex", "workspace". */
  id: string;
  label: string;
  status: CheckStatus;
  /** Human-readable detail. Never empty for a non-ok status. */
  detail: string;
  /** A failing required check makes the whole command exit 1. */
  required: boolean;
}

/**
 * A snapshot of everything `doctor` looks at. Injected rather than read
 * directly so the report can be tested without a filesystem, a network, or
 * the presence of any particular tool.
 */
export interface DoctorEnv {
  repoRoot: string | null;
  bunVersion: string | null;
  pinnedBunVersion: string | null;
  pythonVersion: string | null;
  lualatexVersion: string | null;
  moderncvAvailable: boolean;
  popplerAvailable: boolean;
  pypdfAvailable: boolean;
  /** The engine's workspace links resolve (applyos/node_modules exists). */
  engineInstalled: boolean;
  providerClis: { name: string; installed: boolean; hasTypecheck: boolean }[];
  dirs: { input: boolean; output: boolean; workspace: boolean };
  /** The tracked profile file exists. */
  profileFilePresent: boolean;
  /** The profile still holds the shipped placeholders. */
  profileIsPlaceholder: boolean;
  stage: string | null;
  documentType: string | null;
  salaryDataPresent: boolean;
  gitRemote: string | null;
  /**
   * The visibility of the origin remote, when it could be determined.
   * "unknown" means it could not be checked without a network call — the
   * default, because doctor stays offline.
   */
  gitRemoteVisibility: "public" | "private" | "unknown" | null;
}

/** Everything the report needs, as a single injectable value. */
export function buildReport(env: DoctorEnv): Check[] {
  const checks: Check[] = [];

  // --- Runtime -------------------------------------------------------
  if (!env.bunVersion) {
    checks.push({ id: "bun", label: "bun", status: "fail", detail: "not found — install Bun (see SETUP.md)", required: true });
  } else if (env.pinnedBunVersion && env.bunVersion !== env.pinnedBunVersion) {
    checks.push({
      id: "bun", label: "bun", status: "warn",
      detail: `version ${env.bunVersion} differs from the pinned ${env.pinnedBunVersion} (applyos/.bun-version)`,
      required: false,
    });
  } else {
    checks.push({ id: "bun", label: "bun", status: "ok", detail: `version ${env.bunVersion}`, required: true });
  }

  if (!env.pythonVersion) {
    checks.push({ id: "python", label: "python", status: "fail", detail: "not found — Python 3.10+ is required for tools/ and tests/", required: true });
  } else {
    checks.push({ id: "python", label: "python", status: "ok", detail: `version ${env.pythonVersion}`, required: true });
  }

  // --- Document toolchain --------------------------------------------
  if (!env.lualatexVersion) {
    checks.push({
      id: "latex", label: "lualatex", status: "fail",
      detail: "not found — /apply Step 5 cannot compile documents (see SETUP.md#latex)",
      required: true,
    });
  } else {
    checks.push({ id: "latex", label: "lualatex", status: "ok", detail: env.lualatexVersion, required: true });
  }

  if (!env.moderncvAvailable) {
    checks.push({
      id: "moderncv", label: "moderncv.cls", status: "fail",
      detail: "not found — install texlive-latex-extra (moderncv) and texlive-fonts-extra (fontawesome5)",
      required: true,
    });
  } else {
    checks.push({ id: "moderncv", label: "moderncv.cls", status: "ok", detail: "available", required: true });
  }

  // The PDF text layer needs EITHER extractor. Neither alone is a failure.
  if (env.popplerAvailable && env.pypdfAvailable) {
    checks.push({ id: "pdf-text", label: "PDF text layer", status: "ok", detail: "poppler and pypdf both available", required: false });
  } else if (env.popplerAvailable) {
    checks.push({ id: "pdf-text", label: "PDF text layer", status: "ok", detail: "poppler (pdftotext) available", required: false });
  } else if (env.pypdfAvailable) {
    checks.push({ id: "pdf-text", label: "PDF text layer", status: "ok", detail: "pypdf available", required: false });
  } else {
    checks.push({
      id: "pdf-text", label: "PDF text layer", status: "fail",
      detail: "neither poppler (pdftotext) nor pypdf found — verify_pdf.py cannot extract the text layer",
      required: true,
    });
  }

  // --- Installation ---------------------------------------------------
  checks.push(
    env.engineInstalled
      ? { id: "engine-install", label: "engine install", status: "ok", detail: "applyos/ workspace links resolve", required: true }
      : {
          id: "engine-install", label: "engine install", status: "fail",
          detail: "applyos/node_modules is missing — run `bun install --frozen-lockfile` inside applyos/",
          required: true,
        },
  );

  const notInstalled = env.providerClis.filter((c) => !c.installed).map((c) => c.name);
  checks.push(
    notInstalled.length === 0
      ? { id: "provider-clis", label: "provider CLIs", status: "ok", detail: `${env.providerClis.length} installed`, required: false }
      : {
          id: "provider-clis", label: "provider CLIs", status: "warn",
          detail: `${notInstalled.length} not installed: ${notInstalled.join(", ")} — /scrape will skip them`,
          required: false,
        },
  );

  // --- Workspace ------------------------------------------------------
  const missingDirs = Object.entries(env.dirs).filter(([, present]) => !present).map(([name]) => name);
  checks.push(
    missingDirs.length === 0
      ? { id: "workspace", label: "workspace dirs", status: "ok", detail: "input/, output/, workspace/ present", required: true }
      : {
          id: "workspace", label: "workspace dirs", status: "fail",
          detail: `missing: ${missingDirs.join(", ")} — they are gitignored and must exist locally`,
          required: true,
        },
  );

  // --- Profile --------------------------------------------------------
  if (!env.profileFilePresent) {
    checks.push({
      id: "profile", label: "profile", status: "fail",
      detail: "01-candidate-profile.md is missing — run /setup",
      required: true,
    });
  } else if (env.profileIsPlaceholder) {
    checks.push({
      id: "profile", label: "profile", status: "fail",
      detail: "01-candidate-profile.md still holds the shipped placeholders — run /setup",
      required: true,
    });
  } else {
    const bits: string[] = [];
    if (env.stage) bits.push(`stage: ${env.stage}`);
    if (env.documentType) bits.push(`document type: ${env.documentType}`);
    checks.push({
      id: "profile", label: "profile", status: "ok",
      detail: bits.length ? bits.join(", ") : "01-candidate-profile.md populated",
      required: true,
    });
  }

  checks.push(
    env.salaryDataPresent
      ? { id: "salary-data", label: "salary data", status: "ok", detail: "salary_data.json present", required: false }
      : {
          id: "salary-data", label: "salary data", status: "warn",
          detail: "salary_data.json missing — copy salary_data.example.json (salary_lookup.py needs it)",
          required: false,
        },
  );

  // --- Privacy --------------------------------------------------------
  // A public remote is only fatal once a profile exists to publish. The
  // profile is written into TRACKED files, so this is the highest-consequence
  // misconfiguration in the repository (see docs/security/threat-model.md).
  //
  // doctor stays offline, so it usually CANNOT see the visibility. "unknown"
  // is therefore a warning, never a failure — failing every GitHub remote
  // would cry wolf on exactly the private-repo setup we recommend.
  if (!env.gitRemote) {
    checks.push({ id: "git-remote", label: "git remote", status: "skip", detail: "no origin remote configured", required: false });
  } else if (env.gitRemoteVisibility === "public") {
    checks.push(
      env.profileFilePresent && !env.profileIsPlaceholder
        ? {
            id: "git-remote", label: "git remote", status: "fail",
            detail: `origin (${env.gitRemote}) is PUBLIC and a profile exists — /setup writes your profile into tracked files. Make the repository private.`,
            required: true,
          }
        : {
            id: "git-remote", label: "git remote", status: "warn",
            detail: `origin (${env.gitRemote}) is PUBLIC — run your own search from a private repository`,
            required: false,
          },
    );
  } else if (env.gitRemoteVisibility === "private") {
    checks.push({ id: "git-remote", label: "git remote", status: "ok", detail: `origin is private (${env.gitRemote})`, required: false });
  } else if (env.gitRemote.includes("github.com")) {
    checks.push({
      id: "git-remote", label: "git remote", status: "warn",
      detail: `origin points at a GitHub repository (${env.gitRemote}) — verify it is PRIVATE: /setup writes your profile into tracked files, and forks of public repos cannot be made private. Re-run with --check-remote to verify automatically.`,
      required: false,
    });
  } else {
    checks.push({ id: "git-remote", label: "git remote", status: "ok", detail: `origin: ${env.gitRemote}`, required: false });
  }

  return checks;
}

/** The checks that failed and are required. */
export function requiredFailures(checks: Check[]): Check[] {
  return checks.filter((c) => c.status === "fail" && c.required);
}

/** The checks that failed but are advisory only. */
export function warnings(checks: Check[]): Check[] {
  return checks.filter((c) => c.status === "warn");
}

function run(cmd: string, args: string[]): { ok: boolean; out: string } {
  try {
    const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 15_000, windowsHide: true });
    const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    return { ok: r.status === 0, out: text.trim() };
  } catch {
    return { ok: false, out: "" };
  }
}

function firstLine(s: string): string {
  return s.split(/\r?\n/)[0]?.trim() ?? "";
}

/** Locate the repository root from the CLI's own location. */
export function findRepoRoot(): string | null {
  // applyos/apps/cli/src -> applyos/apps/cli -> applyos/apps -> applyos -> <repo>
  const candidate = join(import.meta.dir, "..", "..", "..", "..");
  return existsSync(join(candidate, "AGENTS.md")) ? candidate : null;
}

function readIfExists(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

/** Pull `stage: <value>` out of the Stage Profile block. */
export function parseStage(searchQueries: string | null): string | null {
  if (!searchQueries) return null;
  const m = searchQueries.match(/^\s*stage:\s*([a-z-]+)\s*$/im);
  return m ? m[1] : null;
}

/** Pull `Document type: <value>` out of the candidate profile. */
export function parseDocumentType(profile: string | null): string | null {
  if (!profile) return null;
  const m = profile.match(/^\s*\**\s*Document\s+type\s*\**\s*:\s*\**\s*([A-Za-z]+)/im);
  return m ? m[1].toLowerCase() : null;
}

/** `owner/repo` from a GitHub remote URL, or null when it is not one. */
export function parseGithubSlug(remote: string): string | null {
  const m = remote.match(/github\.com[:/]+([^/]+)\/([^/.]+)(?:\.git)?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * The origin remote's visibility, using the GitHub CLI. Returns "unknown"
 * when the check is not possible — doctor must never fail because an
 * optional tool is absent.
 */
export function remoteVisibility(remote: string | null): DoctorEnv["gitRemoteVisibility"] {
  if (!remote) return null;
  const slug = parseGithubSlug(remote);
  if (!slug) return "unknown";
  const r = spawnSync("gh", ["repo", "view", slug, "--json", "visibility,isFork"], {
    encoding: "utf8",
    timeout: 15_000,
    windowsHide: true,
  });
  if (r.status !== 0) return "unknown";
  try {
    const data = JSON.parse(r.stdout ?? "{}");
    // A fork of a public repository is always public, whatever `visibility`
    // says — `gh` reports the fork's own visibility, which can mislead.
    if (data.isFork) return "public";
    return data.visibility === "PRIVATE" ? "private" : "public";
  } catch {
    return "unknown";
  }
}

/** Collect the real environment. Never throws — a missing tool is a finding, not an error. */
export function collectEnv(options: { checkRemote?: boolean } = {}): DoctorEnv {
  const repoRoot = findRepoRoot();
  const bunVersion = run("bun", ["--version"]).out.replace(/^bun\s+/i, "") || null;
  const pinnedBunVersion = repoRoot ? readIfExists(join(repoRoot, "applyos", ".bun-version"))?.trim() ?? null : null;

  const pythonCmd = run("python3", ["--version"]).ok ? "python3" : run("python", ["--version"]).ok ? "python" : "";
  const pythonVersion = pythonCmd ? (run(pythonCmd, ["--version"]).out.match(/Python\s+([\d.]+)/)?.[1] ?? null) : null;

  const lualatexOut = run("lualatex", ["--version"]);
  const lualatexVersion = lualatexOut.ok ? firstLine(lualatexOut.out) : null;
  const moderncvAvailable = run("kpsewhich", ["moderncv.cls"]).ok;

  const popplerAvailable = run("pdftotext", ["-v"]).ok;
  const pypdfAvailable = pythonCmd ? run(pythonCmd, ["-c", "import pypdf"]).ok : false;

  const engineInstalled = repoRoot ? existsSync(join(repoRoot, "applyos", "node_modules")) : false;

  const providerClis: DoctorEnv["providerClis"] = [];
  if (repoRoot) {
    const skillsDir = join(repoRoot, ".agents", "skills");
    if (existsSync(skillsDir)) {
      for (const name of readdirSync(skillsDir).sort()) {
        const cliDir = join(skillsDir, name, "cli");
        const pkgPath = join(cliDir, "package.json");
        if (!existsSync(pkgPath)) continue;
        const pkg = readIfExists(pkgPath);
        let hasTypecheck = false;
        try {
          hasTypecheck = Boolean(JSON.parse(pkg ?? "{}")?.scripts?.typecheck);
        } catch {
          hasTypecheck = false;
        }
        providerClis.push({
          name,
          installed: existsSync(join(cliDir, "node_modules")),
          hasTypecheck,
        });
      }
    }
  }

  const dirs = repoRoot
    ? {
        input: existsSync(join(repoRoot, "input")),
        output: existsSync(join(repoRoot, "output")),
        workspace: existsSync(join(repoRoot, "workspace")),
      }
    : { input: false, output: false, workspace: false };

  const profilePath = repoRoot
    ? join(repoRoot, ".claude", "skills", "job-application-assistant", "01-candidate-profile.md")
    : "";
  const profile = profilePath ? readIfExists(profilePath) : null;
  const profileFilePresent = profile !== null;
  const profileIsPlaceholder = profile === null ? false : /\[YOUR_NAME\]|\[YOUR_EMAIL\]/.test(profile);

  const stage = repoRoot ? parseStage(readIfExists(join(repoRoot, ".claude", "skills", "job-scraper", "search-queries.md"))) : null;
  const documentType = parseDocumentType(profile);
  const salaryDataPresent = repoRoot ? existsSync(join(repoRoot, "salary_data.json")) : false;

  let gitRemote: string | null = null;
  if (repoRoot) {
    try {
      if (statSync(repoRoot).isDirectory()) {
        const r = spawnSync("git", ["-C", repoRoot, "remote", "get-url", "origin"], { encoding: "utf8", timeout: 10_000, windowsHide: true });
        if (r.status === 0) gitRemote = (r.stdout ?? "").trim() || null;
      }
    } catch {
      gitRemote = null;
    }
  }

  return {
    repoRoot,
    bunVersion,
    pinnedBunVersion,
    pythonVersion,
    lualatexVersion,
    moderncvAvailable,
    popplerAvailable,
    pypdfAvailable,
    engineInstalled,
    providerClis,
    dirs,
    profileFilePresent,
    profileIsPlaceholder,
    stage,
    documentType,
    salaryDataPresent,
    gitRemote,
    gitRemoteVisibility: options.checkRemote ? remoteVisibility(gitRemote) : "unknown",
  };
}

export interface DoctorOutcome {
  checks: Check[];
  failed: Check[];
  warned: Check[];
  exitCode: number;
}

/** Run every check and decide the exit code. */
export function runDoctor(options: { checkRemote?: boolean } = {}): DoctorOutcome {
  const checks = buildReport(collectEnv(options));
  const failed = requiredFailures(checks);
  const warned = warnings(checks);
  return { checks, failed, warned, exitCode: failed.length > 0 ? 1 : 0 };
}

/** The table rendering used by `applyos doctor` (the default format). */
export function formatDoctorTable(outcome: DoctorOutcome): string {
  const glyph: Record<CheckStatus, string> = { ok: "ok  ", warn: "WARN", fail: "FAIL", skip: "skip" };
  const lines: string[] = [];
  for (const c of outcome.checks) {
    lines.push(`${glyph[c.status]}  ${c.label.padEnd(16)} ${c.detail}`);
  }
  lines.push("");
  if (outcome.failed.length) {
    lines.push(`${outcome.failed.length} required check(s) failed:`);
    for (const c of outcome.failed) lines.push(`  - ${c.label}: ${c.detail}`);
  }
  if (outcome.warned.length) {
    lines.push(`${outcome.warned.length} warning(s).`);
  }
  if (!outcome.failed.length) {
    lines.push("All required checks passed.");
  }
  return lines.join("\n");
}
