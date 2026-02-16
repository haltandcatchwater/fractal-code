# Intent Ledger Specification

**Version 1.0**

## Overview

Every cell's Lineage must conform to the Intent Ledger schema — a structured record of why the cell exists. Vague text is not acceptable. Every field is required.

## The Problem

In traditional codebases, the "why" behind code is lost almost immediately. Comments rot. Commit messages are vague. Documentation drifts. When an AI agent encounters a component, it has no reliable way to know why it was created or what decision led to its existence.

The Intent Ledger solves this by making lineage a structured, validated, first-class part of every cell.

## Schema

```typescript
interface CellLineage {
  source: string;        // The Agent ID that created this cell
  trigger: string;       // The specific request that prompted creation
  justification: string; // One sentence explaining structural necessity
  signature: string;     // Merkle hash of parent context at creation time
}
```

### Field Definitions

#### `source` (required)
The identity of the creator. Must be a non-empty string.

Examples:
- `"Claude-Opus-4.6"` — created by Claude
- `"GPT-4o"` — created by GPT
- `"Human-Angelo"` — created by a human
- `"Gemini-2.0-Flash"` — created by Gemini

#### `trigger` (required)
The specific prompt, issue, or decision record that requested this cell's creation. Must be traceable.

Examples:
- `"prompt-2026-02-16-bootstrap"` — a specific prompt session
- `"issue-42"` — a GitHub issue number
- `"ADR-007-add-caching-layer"` — an Architecture Decision Record
- `"constitution-v1.0-step5"` — a constitutional directive

#### `justification` (required)
A single sentence explaining the structural necessity of this cell. Not a description of what it does — an explanation of why it must exist.

Examples:
- `"Mediates all sibling communication as required by Composition Rule 2"`
- `"Provides stateless greeting transformation for the hello-fractal demo pipeline"`
- `"Maintains greeting history state to demonstrate Keeper cell pattern"`

#### `signature` (required)
The Merkle hash of the parent context at the moment of creation. This cryptographically links the cell to the system state that existed when it was born.

For root cells or cells created during bootstrap, this should be the hash of the initial system state (e.g., `"0".repeat(64)` for the very first cells in a system).

## Validation Rules

A cell's lineage is compliant if and only if:

1. `source` is a non-empty string
2. `trigger` is a non-empty string
3. `justification` is a non-empty string
4. `signature` is a non-empty string
5. None of the fields contain only whitespace

## Why Not Free Text?

The old approach — `reason: "Demonstrates basic Transformer usage"` — is ambiguous. It doesn't tell you:
- Who created it (which agent? which human?)
- What prompted it (was it a bug fix? a feature request? a constitutional mandate?)
- What the system looked like when it was created (is it still relevant?)

The Intent Ledger schema answers all three questions for every cell, permanently.
