/**
 * Fractal Code .fc Parser — Type Definitions
 *
 * These types represent the structure of a parsed .fc file.
 * They are designed to be compatible with the SDK's UniversalContract
 * while carrying the YAML-specific fields (logic.lang, type references, etc.)
 */

// ── Cell Types ──────────────────────────────────────────────────────────

export const CELL_TYPES = ["Transformer", "Reactor", "Keeper", "Channel"] as const;
export type CellType = (typeof CELL_TYPES)[number];

// ── Identity ────────────────────────────────────────────────────────────

export interface CellIdentity {
  name: string;
  version: string;
  type: CellType;
}

// ── Lineage (Intent Ledger) ─────────────────────────────────────────────

export interface CellLineage {
  source: string;
  trigger: string;
  justification: string;
  parent_context_hash: string;
}

// ── Circuit Breaker ─────────────────────────────────────────────────────

export type SafeModeAction = "halt" | "read_only" | "drop_newest";

export interface CircuitBreaker {
  complexity_budget: number;
  safe_mode_action: SafeModeAction;
}

// ── Contracts (type-specific) ───────────────────────────────────────────

export interface TransformerContract {
  input: string;
  output: string;
  circuit_breaker: CircuitBreaker;
}

export interface ReactorContract {
  listens_to: string;
  emits: string;
  circuit_breaker: CircuitBreaker;
}

export interface KeeperContract {
  state_schema: string;
  operations: string[];
  circuit_breaker: CircuitBreaker;
}

export type ChannelMode = "fifo" | "lifo" | "pubsub";

export interface ChannelContract {
  carries: string;
  mode: ChannelMode;
  buffer_size: number;
  circuit_breaker: CircuitBreaker;
}

export type CellContract =
  | TransformerContract
  | ReactorContract
  | KeeperContract
  | ChannelContract;

// ── Logic ───────────────────────────────────────────────────────────────

export interface CellLogic {
  lang: string;
  process?: string;
  on?: string;
  get?: string;
  set?: string;
  delete?: string;
}

// ── Composition ─────────────────────────────────────────────────────────

export interface ChildRef {
  ref: string;
  as: string;
}

export interface ChannelTopologyEdge {
  from: string;
  to: string;
}

export interface ChannelDeclaration {
  name: string;
  topology: ChannelTopologyEdge[];
}

export interface ChannelConnects {
  from: string;
  to: string;
}

// ── Parsed Cell ─────────────────────────────────────────────────────────

export interface ParsedCell {
  identity: CellIdentity;
  contract: CellContract;
  lineage: CellLineage;
  logic: CellLogic | null;
  signature: string;
  children?: ChildRef[];
  channels?: ChannelDeclaration[];
  connects?: ChannelConnects;
}

// ── Validation ──────────────────────────────────────────────────────────

export interface ValidationViolation {
  field: string;
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  cell?: ParsedCell;
}

// ── Built-in Primitives ─────────────────────────────────────────────────

export const BUILT_IN_PRIMITIVES = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "any",
  "void",
] as const;

export type BuiltInPrimitive = (typeof BUILT_IN_PRIMITIVES)[number];

export const CHANNEL_MODES = ["fifo", "lifo", "pubsub"] as const;

export const SAFE_MODE_ACTIONS: Record<CellType, SafeModeAction> = {
  Transformer: "halt",
  Reactor: "halt",
  Keeper: "read_only",
  Channel: "drop_newest",
};
