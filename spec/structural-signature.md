# Structural Signature Specification

**Version 1.0**

## Overview

Every cell carries a Structural Signature — a compact cryptographic fingerprint based on Merkle trees that encodes its relationship to the entire system. When anything changes anywhere, the signatures ripple upward through the hierarchy. The architecture is self-auditing.

## Computation Algorithm

### Leaf Cells (No Children)

For a cell with no sub-cells, the signature is computed as:

```
hash = SHA-256(
  identity.name +
  identity.cellType +
  identity.version +
  JSON.stringify(input.schema) +
  JSON.stringify(output.schema) +
  lineage.reason +
  lineage.creator
)
```

### Composed Cells (With Children)

For a cell containing sub-cells, the signature incorporates child signatures:

```
childHashes = children.map(c => c.signature.hash).sort()
ownContent = identity.name + identity.cellType + identity.version +
             JSON.stringify(input.schema) + JSON.stringify(output.schema) +
             lineage.reason + lineage.creator
hash = SHA-256(ownContent + childHashes.join(""))
```

Child hashes are sorted lexicographically before concatenation to ensure deterministic output regardless of child ordering.

## Properties

### Determinism
The same cell structure always produces the same signature. No randomness.

### Change Propagation
Any modification to a cell's contract fields or to any descendant cell's signature causes the parent's signature to change. Changes ripple upward to the root.

### Tamper Detection
A cell's signature can be verified by recomputing it from its fields and children. If the stored hash doesn't match the computed hash, the cell or one of its children has been modified without proper signature update.

### Hierarchy Encoding
The signature of a root cell encodes the structure of the entire system. Two systems with identical signatures are structurally identical.

## Signature Object

```typescript
interface CellSignature {
  hash: string;         // SHA-256 hex digest (64 lowercase hex characters)
  children?: string[];  // Sorted list of child signature hashes (only for composed cells)
  timestamp: string;    // ISO 8601 timestamp of last computation
}
```

## Validation Rules

A signature is valid if:

1. `hash` is a 64-character lowercase hexadecimal string
2. `hash` matches the recomputed value from the cell's fields and children
3. `timestamp` is a valid ISO 8601 string
4. If children exist, `children` contains the correct sorted list of child hashes
5. All child signatures are themselves valid (recursive verification)

## Recomputation Triggers

Signatures must be recomputed when:
- Any contract field changes (identity, input, output, lineage)
- A sub-cell is added, removed, or modified
- A sub-cell's signature changes (propagation)

The SDK handles automatic recomputation via the `computeSignature()` method.
