// Phase 7.5 — one archive slug rule for all four commands.
import { expect, test } from "bun:test";
import { join } from "node:path";
import { ARCHIVE_RULE, ARCHIVE_ROOT, archiveDir, archiveSlug } from "../src/archive";

test("the slug rule matches input/README.md's examples", () => {
  expect(archiveSlug("Acme", "ML Engineer")).toBe("acme_ml_engineer");
  expect(archiveSlug("BigCorp", "Software Engineer")).toBe("bigcorp_software_engineer");
  expect(archiveSlug("ConsultCo", "AI Consultant")).toBe("consultco_ai_consultant");
});

test("punctuation cannot split a folder or escape the archive root", () => {
  expect(archiveSlug("Example Product Company Pvt Ltd", "SDE / Backend")).toBe("example_product_company_pvt_ltd_sde_backend");
  expect(archiveDir("Acme", "../evil")).toBe(join(ARCHIVE_ROOT, "acme_evil"));
  expect(() => archiveDir("---", "///")).toThrow(/at least one letter or digit/);
});

test("the archived version is the submitted version", () => {
  expect(ARCHIVE_RULE).toContain("never overwritten");
  expect(ARCHIVE_ROOT).toBe("output/applications");
});
