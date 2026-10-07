// Origin: clean-room 2026-10-07. Eightfold + Oracle ORC ship UNSEEDED:
// no publicly resolvable tenant was available, so these connectors fail
// loudly per run (per-source isolation) instead of guessing. Author: OpenCode agent.

export function eightfoldUnseeded(): never {
  throw new Error(
    "eightfold: no seeded tenant — add a publicly resolvable <tenant>.eightfold.ai to registry.yaml first",
  );
}

export function oracleOrcUnseeded(): never {
  throw new Error(
    "oracle-orc: no seeded tenant — add a working recruitingCEJobRequisitions endpoint to registry.yaml first",
  );
}



