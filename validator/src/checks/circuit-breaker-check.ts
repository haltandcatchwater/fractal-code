import type { CheckResult, DiscoveredCell, Violation } from "../types/cell";

/**
 * Circuit Breaker Validation.
 *
 * Verifies that every Transformer and Reactor implements the mandatory
 * complexity budget (TTL). Cells lacking this safety valve fail validation.
 */
export function circuitBreakerCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  function check(cell: DiscoveredCell): void {
    const ctx = { cell: cell.identity.name, file: cell.filePath, principle: "II" };
    const needsCircuitBreaker =
      cell.identity.cellType === "transformer" || cell.identity.cellType === "reactor";

    if (needsCircuitBreaker) {
      // Health must report budgetRemaining
      if (!cell.hasHealthMethod) {
        violations.push({
          ...ctx,
          message: `${cell.identity.cellType} lacks health() method — cannot report circuit breaker status`,
        });
      } else if (cell.healthReport && cell.healthReport.budgetRemaining === undefined) {
        violations.push({
          ...ctx,
          message: `${cell.identity.cellType} health() does not report budgetRemaining — circuit breaker not implemented`,
        });
      }

      // Budget must be a non-negative number
      if (cell.healthReport && cell.healthReport.budgetRemaining !== undefined) {
        if (typeof cell.healthReport.budgetRemaining !== "number" || cell.healthReport.budgetRemaining < 0) {
          violations.push({
            ...ctx,
            message: `budgetRemaining must be a non-negative number, got: ${cell.healthReport.budgetRemaining}`,
          });
        }
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
    checkName: "Circuit Breaker Check",
    passed: violations.length === 0,
    violations,
  };
}
