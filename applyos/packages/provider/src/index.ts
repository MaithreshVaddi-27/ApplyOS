// Origin: clean-room 2026-11-13, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The ApplyOS provider SDK: one implementation per job board, behind one typed
// interface.
//
// Two surfaces consume it:
//
//   the provider CLI  (.agents/skills/<board>-search/cli) - the contract of
//                      ADR-0006: `search` / `detail`, a {meta, results}
//                      envelope, stderr JSON errors with exit 1, zero runtime
//                      dependencies
//   the engine        (applyos) - JobPosting rows for the unified fan-in
//
// A board is implemented once. Each surface maps the SDK's neutral row into
// its own output shape, because the two shapes are documented to differ.

export * from "./types.js";
export * from "./errors.js";
export * from "./fetch.js";
export * from "./text.js";
export * from "./remoteok.js";
export * from "./remotive.js";
export * from "./freehire.js";
export * from "./unstop.js";

// `contract.js` is deliberately NOT re-exported here. It imports
// `bun:test`, which does not exist outside a test runner, so a production
// import of this barrel would fail at load time. A provider's test file
// imports it directly:
//
//   import { contractSuite } from "../src/contract.js";
