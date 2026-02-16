import type { CheckResult, DiscoveredCell, Violation } from "../types/cell";

/**
 * Intent Ledger (Lineage) Schema Validation.
 *
 * Verifies that every cell's Lineage conforms to the Intent Ledger schema
 * with all four required fields: source, trigger, justification, signature.
 * Vague or missing fields fail validation.
 */
export function lineageCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  function check(cell: DiscoveredCell): void {
    const ctx = { cell: cell.identity.name, file: cell.filePath, principle: "II" };

    if (!cell.lineage) {
      violations.push({ ...ctx, message: "Missing lineage (Intent Ledger) entirely" });
    } else {
      // source — Agent ID
      if (!cell.lineage.source || cell.lineage.source.trim().length === 0) {
        violations.push({
          ...ctx,
          message: "lineage.source is required — must be an Agent ID (e.g., 'Claude-Opus-4.6', 'Human-Angelo')",
        });
      }

      // trigger — Prompt ID, Issue #, or Decision Record
      if (!cell.lineage.trigger || cell.lineage.trigger.trim().length === 0) {
        violations.push({
          ...ctx,
          message: "lineage.trigger is required — must be a Prompt ID, Issue #, or Decision Record",
        });
      }

      // justification — one sentence of structural necessity
      if (!cell.lineage.justification || cell.lineage.justification.trim().length === 0) {
        violations.push({
          ...ctx,
          message: "lineage.justification is required — one sentence explaining structural necessity",
        });
      }

      // signature — Merkle hash of parent context
      if (!cell.lineage.signature || cell.lineage.signature.trim().length === 0) {
        violations.push({
          ...ctx,
          message: "lineage.signature is required — Merkle hash of parent context at creation",
        });
      }
    }

    // Recurse into children
    for (const child of cell.children) {
      check(child);
    }
  }

  for (const cell of cells) {
    check(cell);
  }

  return {
    checkName: "Intent Ledger Check",
    passed: violations.length === 0,
    violations,
  };
}
