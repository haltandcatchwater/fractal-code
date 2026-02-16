import { VALID_CELL_TYPES, type CheckResult, type DiscoveredCell, type Violation } from "../types/cell";

/**
 * Principle I: Every component must be one of the four defined cell types.
 *
 * Validates that each discovered cell declares a valid cellType and that
 * source files follow the naming convention <name>.<cell-type>.ts.
 */
export function cellTypeCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  for (const cell of cells) {
    // Check cellType field
    if (!VALID_CELL_TYPES.includes(cell.identity.cellType)) {
      violations.push({
        cell: cell.identity.name,
        file: cell.filePath,
        message: `Invalid cellType "${cell.identity.cellType}". Must be one of: ${VALID_CELL_TYPES.join(", ")}`,
        principle: "I",
      });
    }

    // Check file naming convention: <name>.<cell-type>.ts
    const fileName = cell.filePath.split("/").pop() ?? cell.filePath.split("\\").pop() ?? "";
    if (fileName && !fileName.startsWith("app.") && !fileName.startsWith("index.")) {
      const parts = fileName.replace(/\.ts$/, "").split(".");
      if (parts.length >= 2) {
        const declaredType = parts[parts.length - 1];
        if (VALID_CELL_TYPES.includes(declaredType as any) && declaredType !== cell.identity.cellType) {
          violations.push({
            cell: cell.identity.name,
            file: cell.filePath,
            message: `File name suggests type "${declaredType}" but cell declares type "${cell.identity.cellType}"`,
            principle: "I",
          });
        }
      }
    }

    // Recurse into children
    if (cell.children.length > 0) {
      const childResult = cellTypeCheck(cell.children);
      violations.push(...childResult.violations);
    }
  }

  return {
    checkName: "Cell Type Check",
    passed: violations.length === 0,
    violations,
  };
}
