import { createHash } from "crypto";
import type { CheckResult, DiscoveredCell, Violation } from "../types/cell";

const SHA256_REGEX = /^[0-9a-f]{64}$/;

/**
 * Recompute a cell's signature from its contract fields (and child signatures if composed).
 * This mirrors the SDK's computation algorithm from the structural-signature spec.
 */
function recomputeHash(cell: DiscoveredCell): string {
  const ownContent =
    cell.identity.name +
    cell.identity.cellType +
    cell.identity.version +
    JSON.stringify(cell.input.schema) +
    JSON.stringify(cell.output.schema) +
    cell.lineage.source +
    cell.lineage.trigger +
    cell.lineage.justification;

  if (cell.children.length === 0) {
    return createHash("sha256").update(ownContent, "utf8").digest("hex");
  }

  const sortedChildHashes = cell.children.map((c) => c.signature.hash).sort();
  const content = ownContent + sortedChildHashes.join("");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Principle X: Every cell must carry a Structural Signature that ripples
 * upward on any change.
 */
export function signatureCheck(cells: DiscoveredCell[]): CheckResult {
  const violations: Violation[] = [];

  for (const cell of cells) {
    const ctx = { cell: cell.identity.name, file: cell.filePath, principle: "X" };

    // Hash must be valid format
    if (!cell.signature.hash || !SHA256_REGEX.test(cell.signature.hash)) {
      violations.push({
        ...ctx,
        message: `Invalid signature hash format: "${cell.signature.hash?.slice(0, 20)}..."`,
      });
      continue;
    }

    // Verify hash matches recomputed value
    const expected = recomputeHash(cell);
    if (cell.signature.hash !== expected) {
      violations.push({
        ...ctx,
        message: `Signature mismatch: stored ${cell.signature.hash.slice(0, 16)}... != computed ${expected.slice(0, 16)}...`,
      });
    }

    // If composed, verify children list in signature
    if (cell.children.length > 0) {
      const sortedChildHashes = cell.children.map((c) => c.signature.hash).sort();
      const sigChildren = cell.signature.children ?? [];

      if (sigChildren.length !== sortedChildHashes.length) {
        violations.push({
          ...ctx,
          message: `Signature children count mismatch: ${sigChildren.length} in signature vs ${sortedChildHashes.length} actual`,
        });
      } else {
        for (let i = 0; i < sortedChildHashes.length; i++) {
          if (sigChildren[i] !== sortedChildHashes[i]) {
            violations.push({
              ...ctx,
              message: `Signature children hash mismatch at index ${i}`,
            });
            break;
          }
        }
      }
    }

    // Timestamp must exist
    if (!cell.signature.timestamp) {
      violations.push({ ...ctx, message: "Missing signature.timestamp" });
    }

    // Recurse
    if (cell.children.length > 0) {
      const childResult = signatureCheck(cell.children);
      violations.push(...childResult.violations);
    }
  }

  return {
    checkName: "Signature Check",
    passed: violations.length === 0,
    violations,
  };
}
