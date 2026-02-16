import type { CheckResult, DiscoveredCell, Violation } from "../types/cell";

/**
 * Principle III: All inter-cell communication must pass through Channels.
 *
 * Validates composition rules:
 * - Every sub-cell is registered in the parent's children
 * - If a parent has multiple non-channel children, at least one Channel must exist
 * - No side channels (validated structurally)
 */
export function compositionCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  for (const cell of cells) {
    if (cell.children.length === 0) continue;

    const ctx = { cell: cell.identity.name, file: cell.filePath, principle: "III" };

    // Count non-channel children
    const nonChannelChildren = cell.children.filter((c) => c.identity.cellType !== "channel");
    const channelChildren = cell.children.filter((c) => c.identity.cellType === "channel");

    // If there are 2+ non-channel siblings, there must be at least one Channel to mediate
    if (nonChannelChildren.length >= 2 && channelChildren.length === 0) {
      violations.push({
        ...ctx,
        message: `Cell has ${nonChannelChildren.length} non-channel children but no Channel to mediate communication. ` +
          `All sibling communication must pass through Channels.`,
      });
    }

    // Verify context map consistency: parent's children list should match actual children
    const contextMapChildren = cell.contextMap.children ?? [];
    const actualChildNames = cell.children.map((c) => c.identity.name);
    for (const childName of actualChildNames) {
      if (!contextMapChildren.includes(childName)) {
        violations.push({
          ...ctx,
          message: `Child "${childName}" exists but is not listed in parent's context map`,
        });
      }
    }

    // Verify channels in context map match actual channel children
    const contextMapChannels = cell.contextMap.channels ?? [];
    const actualChannelNames = channelChildren.map((c) => c.identity.name);
    for (const chanName of actualChannelNames) {
      if (!contextMapChannels.includes(chanName)) {
        violations.push({
          ...ctx,
          message: `Channel "${chanName}" exists as a child but is not listed in parent's context map channels`,
        });
      }
    }

    // Recurse into children
    for (const child of cell.children) {
      if (child.children.length > 0) {
        const childResult = compositionCheck([child]);
        violations.push(...childResult.violations);
      }
    }
  }

  return {
    checkName: "Composition Check",
    passed: violations.length === 0,
    violations,
  };
}
