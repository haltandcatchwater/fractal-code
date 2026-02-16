import { createHash } from "crypto";
import type { CellSignature, UniversalContract } from "./contract";

/**
 * Compute the content string used for hashing a cell's own fields.
 * Matches the Structural Signature spec: name + cellType + version +
 * JSON(input.schema) + JSON(output.schema) + Intent Ledger fields
 */
function cellContent(cell: UniversalContract): string {
  return (
    cell.identity.name +
    cell.identity.cellType +
    cell.identity.version +
    JSON.stringify(cell.input.schema) +
    JSON.stringify(cell.output.schema) +
    cell.lineage.source +
    cell.lineage.trigger +
    cell.lineage.justification
  );
}

/**
 * Compute a SHA-256 hex digest of a string.
 */
function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Compute the Structural Signature for a leaf cell (no children).
 */
export function computeLeafSignature(cell: UniversalContract): CellSignature {
  return {
    hash: sha256(cellContent(cell)),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Compute the Structural Signature for a composed cell (with children).
 * Child hashes are sorted lexicographically for determinism.
 */
export function computeComposedSignature(
  cell: UniversalContract,
  childSignatures: CellSignature[],
): CellSignature {
  const sortedChildHashes = childSignatures.map((s) => s.hash).sort();
  const content = cellContent(cell) + sortedChildHashes.join("");
  return {
    hash: sha256(content),
    children: sortedChildHashes,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Verify that a cell's stored signature matches a fresh computation.
 * Returns true if the signature is valid.
 */
export function verifySignature(
  cell: UniversalContract,
  childSignatures?: CellSignature[],
): boolean {
  const fresh =
    childSignatures && childSignatures.length > 0
      ? computeComposedSignature(cell, childSignatures)
      : computeLeafSignature(cell);
  return fresh.hash === cell.signature.hash;
}
