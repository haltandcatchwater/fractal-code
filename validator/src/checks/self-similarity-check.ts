import type { CheckResult, DiscoveredCell, Violation } from "../types/cell";

/**
 * Principle IV: The structure must be self-similar at every scale.
 *
 * Validates that composed cells present the same contract interface as
 * leaf cells — scale is invisible from the outside.
 */
export function selfSimilarityCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  for (const cell of cells) {
    const ctx = { cell: cell.identity.name, file: cell.filePath, principle: "IV" };

    // A composed cell must have the same contract completeness as a leaf cell
    if (cell.children.length > 0) {
      // The parent must still have its own identity (not just delegate to children)
      if (!cell.identity.name || cell.identity.name.trim().length === 0) {
        violations.push({ ...ctx, message: "Composed cell lacks its own identity.name" });
      }

      // The parent must declare its own input/output (the composed interface)
      if (!cell.input || !cell.input.description) {
        violations.push({ ...ctx, message: "Composed cell lacks its own input declaration — scale must be invisible from outside" });
      }
      if (!cell.output || !cell.output.description) {
        violations.push({ ...ctx, message: "Composed cell lacks its own output declaration — scale must be invisible from outside" });
      }

      // The parent's signature must incorporate children (not just be a leaf signature)
      if (!cell.signature.children || cell.signature.children.length === 0) {
        violations.push({
          ...ctx,
          message: "Composed cell's signature does not include child signatures — violates self-similarity",
        });
      }

      // Each child must also be fully contract-compliant (self-similar at their scale)
      for (const child of cell.children) {
        if (!child.identity.name) {
          violations.push({
            cell: "unknown",
            file: cell.filePath,
            message: `Child cell within "${cell.identity.name}" lacks identity`,
            principle: "IV",
          });
        }
        if (!child.lineage || !child.lineage.justification) {
          violations.push({
            cell: child.identity.name ?? "unknown",
            file: cell.filePath,
            message: `Child cell "${child.identity.name}" within "${cell.identity.name}" lacks lineage — self-similarity requires every cell at every scale to have lineage`,
            principle: "IV",
          });
        }
      }

      // Recurse
      const childResult = selfSimilarityCheck(cell.children);
      violations.push(...childResult.violations);
    }
  }

  return {
    checkName: "Self-Similarity Check",
    passed: violations.length === 0,
    violations,
  };
}
