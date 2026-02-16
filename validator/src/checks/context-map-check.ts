import type { CheckResult, DiscoveredCell, Violation } from "../types/cell";

/**
 * Principles V & IX: The context map is a first-class element, and the
 * structure must be holographic.
 *
 * Validates that every cell contributes to the context map and that the
 * map contains sufficient information to reconstruct the system topology.
 */
export function contextMapCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  for (const cell of cells) {
    const ctx = { cell: cell.identity.name, file: cell.filePath };

    // Must have toMap() method
    if (!cell.hasToMapMethod) {
      violations.push({
        ...ctx,
        message: "Cell lacks toMap() method — context map is a first-class element (Principle V)",
        principle: "V",
      });
      continue;
    }

    const map = cell.contextMap;

    // Context map must include identity
    if (!map.identity || !map.identity.name) {
      violations.push({
        ...ctx,
        message: "Context map missing identity — holographic principle requires self-contained identity (Principle IX)",
        principle: "IX",
      });
    }

    // Context map must include signature
    if (!map.signature) {
      violations.push({
        ...ctx,
        message: "Context map missing signature reference",
        principle: "V",
      });
    }

    // If cell has children, context map must list them
    if (cell.children.length > 0) {
      if (!map.children || map.children.length === 0) {
        violations.push({
          ...ctx,
          message: "Composed cell's context map does not list children — holographic principle violated",
          principle: "IX",
        });
      }

      // Context map should list channels
      const channelChildren = cell.children.filter((c) => c.identity.cellType === "channel");
      if (channelChildren.length > 0 && (!map.channels || map.channels.length === 0)) {
        violations.push({
          ...ctx,
          message: "Composed cell has Channel children but context map does not list channels",
          principle: "V",
        });
      }
    }

    // Recurse
    if (cell.children.length > 0) {
      const childResult = contextMapCheck(cell.children);
      violations.push(...childResult.violations);
    }
  }

  return {
    checkName: "Context Map Check",
    passed: violations.length === 0,
    violations,
  };
}
