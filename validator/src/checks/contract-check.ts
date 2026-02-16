import type { CheckResult, DiscoveredCell, Violation } from "../types/cell";

const SEMVER_REGEX = /^\d+\.\d+\.\d+/;
const SHA256_REGEX = /^[0-9a-f]{64}$/;

/**
 * Principle II: Every cell must implement the universal contract
 * (Identity, Input, Output, Health, Lineage, Signature).
 */
export function contractCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  for (const cell of cells) {
    const ctx = { cell: cell.identity.name, file: cell.filePath, principle: "II" };

    // Identity
    if (!cell.identity.name || cell.identity.name.trim().length === 0) {
      violations.push({ ...ctx, message: "Missing identity.name" });
    }
    if (!cell.identity.version || !SEMVER_REGEX.test(cell.identity.version)) {
      violations.push({ ...ctx, message: `Invalid identity.version "${cell.identity.version}" — must be semver` });
    }

    // Input
    if (!cell.input) {
      violations.push({ ...ctx, message: "Missing input declaration" });
    } else {
      if (!cell.input.schema) violations.push({ ...ctx, message: "Missing input.schema" });
      if (!cell.input.description || cell.input.description.trim().length === 0) {
        violations.push({ ...ctx, message: "Missing input.description" });
      }
    }

    // Output
    if (!cell.output) {
      violations.push({ ...ctx, message: "Missing output declaration" });
    } else {
      if (!cell.output.schema) violations.push({ ...ctx, message: "Missing output.schema" });
      if (!cell.output.description || cell.output.description.trim().length === 0) {
        violations.push({ ...ctx, message: "Missing output.description" });
      }
    }

    // Health
    if (!cell.hasHealthMethod) {
      violations.push({ ...ctx, message: "Missing health() method" });
    }

    // Lineage (Intent Ledger) — basic presence check; detailed check in lineage-check.ts
    if (!cell.lineage) {
      violations.push({ ...ctx, message: "Missing lineage (Intent Ledger) declaration" });
    }

    // Signature
    if (!cell.signature) {
      violations.push({ ...ctx, message: "Missing signature" });
    } else {
      if (!cell.signature.hash || !SHA256_REGEX.test(cell.signature.hash)) {
        violations.push({ ...ctx, message: "Invalid signature.hash — must be 64-char lowercase hex" });
      }
      if (!cell.signature.timestamp) {
        violations.push({ ...ctx, message: "Missing signature.timestamp" });
      }
    }

    // Recurse into children
    if (cell.children.length > 0) {
      const childResult = contractCheck(cell.children);
      violations.push(...childResult.violations);
    }
  }

  return {
    checkName: "Contract Check",
    passed: violations.length === 0,
    violations,
  };
}
