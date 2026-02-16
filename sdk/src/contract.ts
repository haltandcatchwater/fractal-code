// ── Cell Types ──────────────────────────────────────────────────────────

export const CELL_TYPES = ["transformer", "reactor", "keeper", "channel"] as const;
export type CellType = (typeof CELL_TYPES)[number];

// ── Universal Contract Interfaces ───────────────────────────────────────

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

// ── Health & Circuit Breaker ────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "safe-mode";

export interface CellHealth {
  status: HealthStatus;
  message?: string;
  budgetRemaining?: number;
  children?: Record<string, CellHealth>;
}

/** Default complexity budget (TTL) for cells that support it. */
export const DEFAULT_COMPLEXITY_BUDGET = 1000;

// ── Intent Ledger (Lineage) ─────────────────────────────────────────────

/**
 * Structured lineage record — the Intent Ledger.
 * Every field is required. No vague text allowed.
 */
export interface CellLineage {
  source: string;        // Agent ID (e.g., "Claude-Opus-4.6", "GPT-4o", "Human-Angelo")
  trigger: string;       // Prompt ID, Issue #, or Decision Record that requested this
  justification: string; // One sentence explaining the structural necessity
  signature: string;     // Merkle hash of the parent context at the moment of creation
}

// ── Structural Signature ────────────────────────────────────────────────

export interface CellSignature {
  hash: string;
  children?: string[];
  timestamp: string;
}

// ── Context Map ─────────────────────────────────────────────────────────

export interface ContextMapEntry {
  identity: CellIdentity;
  parent?: string;
  children?: string[];
  channels?: string[];
  signature: string;
}

// ── Universal Contract ──────────────────────────────────────────────────

export interface UniversalContract {
  identity: CellIdentity;
  input: CellInput;
  output: CellOutput;
  lineage: CellLineage;
  signature: CellSignature;
  health(): CellHealth;
  toMap(): ContextMapEntry;
}

// ── Config for creating a cell ──────────────────────────────────────────

export interface CellConfig {
  name: string;
  version: string;
  input: CellInput;
  output: CellOutput;
  lineage: CellLineage;
  parent?: string;
}

// ── Validation ──────────────────────────────────────────────────────────

const SHA256_REGEX = /^[0-9a-f]{64}$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+/;

export function validateIdentity(id: CellIdentity): string[] {
  const errors: string[] = [];
  if (!id.name || id.name.trim().length === 0) errors.push("identity.name is required");
  if (!CELL_TYPES.includes(id.cellType)) errors.push(`identity.cellType must be one of: ${CELL_TYPES.join(", ")}`);
  if (!id.version || !SEMVER_REGEX.test(id.version)) errors.push("identity.version must be a semver string");
  return errors;
}

export function validateInput(input: CellInput): string[] {
  const errors: string[] = [];
  if (!input.schema) errors.push("input.schema is required");
  if (!input.description || input.description.trim().length === 0) errors.push("input.description is required");
  return errors;
}

export function validateOutput(output: CellOutput): string[] {
  const errors: string[] = [];
  if (!output.schema) errors.push("output.schema is required");
  if (!output.description || output.description.trim().length === 0) errors.push("output.description is required");
  return errors;
}

export function validateLineage(lineage: CellLineage): string[] {
  const errors: string[] = [];
  if (!lineage.source || lineage.source.trim().length === 0) errors.push("lineage.source is required (Agent ID)");
  if (!lineage.trigger || lineage.trigger.trim().length === 0) errors.push("lineage.trigger is required (Prompt ID, Issue #, or Decision Record)");
  if (!lineage.justification || lineage.justification.trim().length === 0) errors.push("lineage.justification is required (one sentence of structural necessity)");
  if (!lineage.signature || lineage.signature.trim().length === 0) errors.push("lineage.signature is required (Merkle hash of parent context at creation)");
  return errors;
}

export function validateSignature(sig: CellSignature): string[] {
  const errors: string[] = [];
  if (!sig.hash || !SHA256_REGEX.test(sig.hash)) errors.push("signature.hash must be a 64-char hex string");
  if (!sig.timestamp) errors.push("signature.timestamp is required");
  return errors;
}

export function validateContract(cell: UniversalContract): string[] {
  return [
    ...validateIdentity(cell.identity),
    ...validateInput(cell.input),
    ...validateOutput(cell.output),
    ...validateLineage(cell.lineage),
    ...validateSignature(cell.signature),
  ];
}
