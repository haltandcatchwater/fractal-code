# Universal Contract Specification

**Version 1.1**

## Overview

The universal contract is the interface that every cell must implement, regardless of cell type or scale. A single function and a distributed system of ten thousand components present the same contract.

## Contract Fields

### 1. Identity

```typescript
interface CellIdentity {
  name: string;          // Unique name within its parent scope
  cellType: CellType;    // "transformer" | "reactor" | "keeper" | "channel"
  version: string;       // Semantic version of the contract implementation
}
```

Every cell must declare what it is. The `name` is unique among siblings within a parent cell. The `cellType` must be one of the four defined types. The `version` tracks the contract version this cell implements.

### 2. Input

```typescript
interface CellInput {
  schema: Record<string, unknown>;  // JSON-schema-like description of accepted input
  description: string;               // Human/agent-readable description
}
```

Every cell must declare what it accepts. Even cells that accept no input must declare an empty schema explicitly.

### 3. Output

```typescript
interface CellOutput {
  schema: Record<string, unknown>;  // JSON-schema-like description of produced output
  description: string;               // Human/agent-readable description
}
```

Every cell must declare what it produces. Even cells that produce no output must declare an empty schema explicitly.

### 4. Health & Circuit Breaker

```typescript
type HealthStatus = "healthy" | "degraded" | "unhealthy" | "safe-mode";

interface CellHealth {
  status: HealthStatus;
  message?: string;
  budgetRemaining?: number;           // Complexity budget TTL (Transformers & Reactors)
  children?: Record<string, CellHealth>;  // Health of sub-cells (if composed)
}
```

Every cell must report its own operational status. Composed cells must aggregate the health of their sub-cells.

**Circuit Breaker:** Transformers and Reactors must implement a mandatory complexity budget (TTL). Each execution cycle decrements the budget. When it reaches zero, the cell enters `"safe-mode"` and halts execution. See [circuit-breaker.md](./circuit-breaker.md) for the full specification.

### 5. Lineage (Intent Ledger)

```typescript
interface CellLineage {
  source: string;        // Agent ID (e.g., "Claude-Opus-4.6", "Human-Angelo")
  trigger: string;       // Prompt ID, Issue #, or Decision Record
  justification: string; // One sentence explaining structural necessity
  signature: string;     // Merkle hash of parent context at creation time
}
```

Every cell must carry a structured record of why it exists. This is not optional, and the fields are not free text — they must conform to the Intent Ledger schema. See [intent-ledger.md](./intent-ledger.md) for the full specification.

### 6. Signature

```typescript
interface CellSignature {
  hash: string;         // SHA-256 hex digest (64 lowercase hex characters)
  children?: string[];  // Sorted list of child signature hashes (only for composed cells)
  timestamp: string;    // ISO 8601 timestamp of last computation
}
```

Every cell carries a Merkle-based structural fingerprint. See [structural-signature.md](./structural-signature.md) for the full specification.

## The Complete Contract Interface

```typescript
interface UniversalContract {
  identity: CellIdentity;
  input: CellInput;
  output: CellOutput;
  lineage: CellLineage;
  signature: CellSignature;
  health(): CellHealth;
  toMap(): ContextMapEntry;
}
```

## Validation Rules

A cell is contract-compliant if and only if:

1. `identity.name` is a non-empty string
2. `identity.cellType` is one of: `"transformer"`, `"reactor"`, `"keeper"`, `"channel"`
3. `identity.version` is a valid semantic version string
4. `input` has both `schema` and `description` defined
5. `output` has both `schema` and `description` defined
6. `health()` returns a valid `CellHealth` object with a recognized status
7. `lineage.source` is a non-empty string (Agent ID)
8. `lineage.trigger` is a non-empty string (Prompt ID / Issue # / Decision Record)
9. `lineage.justification` is a non-empty string (one sentence of structural necessity)
10. `lineage.signature` is a non-empty string (Merkle hash of parent context)
11. `signature.hash` is a valid SHA-256 hex string (64 characters)
12. `signature.timestamp` is a valid ISO 8601 timestamp
13. For Transformers and Reactors: `health()` reports `budgetRemaining` (Circuit Breaker)
