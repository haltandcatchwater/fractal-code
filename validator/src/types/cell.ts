/**
 * Type definitions for the constitutional validator.
 * These mirror the SDK types but are standalone so the validator
 * can operate independently.
 */

export const VALID_CELL_TYPES = ["transformer", "reactor", "keeper", "channel"] as const;
export type CellType = (typeof VALID_CELL_TYPES)[number];

export interface CellIdentity {
  name: string;
  cellType: CellType;
  version: string;
}

export interface CellInput {
  schema: Record<string, unknown>;
  description: string;
}

export interface CellOutput {
  schema: Record<string, unknown>;
  description: string;
}

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "safe-mode";

export interface CellHealth {
  status: HealthStatus;
  message?: string;
  budgetRemaining?: number;
  children?: Record<string, CellHealth>;
}

/** Intent Ledger — structured lineage schema. All fields required. */
export interface CellLineage {
  source: string;        // Agent ID
  trigger: string;       // Prompt ID, Issue #, or Decision Record
  justification: string; // One sentence of structural necessity
  signature: string;     // Merkle hash of parent context at creation
}

export interface CellSignature {
  hash: string;
  children?: string[];
  timestamp: string;
}

export interface ContextMapEntry {
  identity: CellIdentity;
  parent?: string;
  children?: string[];
  channels?: string[];
  signature: string;
}

/** Represents a discovered cell for validation purposes. */
export interface DiscoveredCell {
  filePath: string;
  identity: CellIdentity;
  input: CellInput;
  output: CellOutput;
  lineage: CellLineage;
  signature: CellSignature;
  contextMap: ContextMapEntry;
  children: DiscoveredCell[];
  hasHealthMethod: boolean;
  hasToMapMethod: boolean;
  healthReport?: CellHealth;
}

/** Result of a single validation check. */
export interface CheckResult {
  checkName: string;
  passed: boolean;
  violations: Violation[];
}

export interface Violation {
  cell: string;
  file: string;
  message: string;
  principle: string;
}
