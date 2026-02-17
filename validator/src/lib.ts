/**
 * Fractal Code Validator — Library Exports
 *
 * Re-exports all 8 constitutional check functions and types
 * for programmatic use by other packages (e.g., FractalClaw).
 */

// ── Check Functions ─────────────────────────────────────────────────────
export { cellTypeCheck } from "./checks/cell-type-check";
export { contractCheck } from "./checks/contract-check";
export { compositionCheck } from "./checks/composition-check";
export { selfSimilarityCheck } from "./checks/self-similarity-check";
export { contextMapCheck } from "./checks/context-map-check";
export { signatureCheck } from "./checks/signature-check";
export { circuitBreakerCheck } from "./checks/circuit-breaker-check";
export { lineageCheck } from "./checks/lineage-check";

// ── Types ───────────────────────────────────────────────────────────────
export type {
  DiscoveredCell,
  CheckResult,
  Violation,
  CellType,
} from "./types/cell";
