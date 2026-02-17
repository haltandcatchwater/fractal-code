/**
 * Fractal Code .fc Parser — Constitutional Constraint Validation
 *
 * Validates a parsed .fc cell against all constitutional constraints.
 * Does NOT parse or validate implementation bodies (opaque in v0).
 */

import type {
  ParsedCell,
  ValidationResult,
  ValidationViolation,
  CellType,
  TransformerContract,
  ReactorContract,
  KeeperContract,
  ChannelContract,
  SafeModeAction,
} from "./types";
import { CELL_TYPES, CHANNEL_MODES, SAFE_MODE_ACTIONS } from "./types";
import { isPrimitive } from "./resolve-types";

// ── Semver regex ────────────────────────────────────────────────────────

const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Validate a parsed cell against all constitutional constraints.
 *
 * @param cell The parsed cell from parse.ts
 * @param filePath Optional file path for file naming validation
 * @param knownTypes Optional set of known type names (from types/ directory)
 */
export function validateCell(
  cell: ParsedCell,
  filePath?: string,
  knownTypes?: Set<string>,
): ValidationResult {
  const violations: ValidationViolation[] = [];

  validateIdentity(cell, violations);
  validateContract(cell, violations);
  validateCircuitBreaker(cell, violations);
  validateLineage(cell, violations);
  validateLogic(cell, violations);
  validateSignature(cell, violations);
  validateComposition(cell, violations);
  validateTypeRefs(cell, violations, knownTypes);

  if (filePath) {
    validateFileName(cell, filePath, violations);
  }

  return {
    valid: violations.length === 0,
    violations,
    cell,
  };
}

// ── Identity Validation ─────────────────────────────────────────────────

function validateIdentity(cell: ParsedCell, violations: ValidationViolation[]): void {
  const { identity } = cell;

  if (!identity.name || !identity.name.trim()) {
    violations.push({
      field: "identity.name",
      message: "identity.name is required and must be non-empty",
    });
  }

  if (!identity.version || !SEMVER_RE.test(identity.version)) {
    violations.push({
      field: "identity.version",
      message: `identity.version must be a valid semver string, got "${identity.version}"`,
    });
  }

  if (!CELL_TYPES.includes(identity.type as CellType)) {
    violations.push({
      field: "identity.type",
      message: `identity.type must be one of: ${CELL_TYPES.join(", ")}. Got "${identity.type}"`,
    });
  }
}

// ── Contract Validation (type-specific) ─────────────────────────────────

function validateContract(cell: ParsedCell, violations: ValidationViolation[]): void {
  const { identity, contract } = cell;

  if (!contract) {
    violations.push({ field: "contract", message: "contract section is required" });
    return;
  }

  switch (identity.type) {
    case "Transformer":
      validateTransformerContract(contract as TransformerContract, violations);
      break;
    case "Reactor":
      validateReactorContract(contract as ReactorContract, violations);
      break;
    case "Keeper":
      validateKeeperContract(contract as KeeperContract, violations);
      break;
    case "Channel":
      validateChannelContract(contract as ChannelContract, violations);
      break;
  }
}

function validateTransformerContract(
  contract: TransformerContract,
  violations: ValidationViolation[],
): void {
  if (!contract.input || !contract.input.trim()) {
    violations.push({
      field: "contract.input",
      message: "Transformer contract requires non-empty input type reference",
    });
  }
  if (!contract.output || !contract.output.trim()) {
    violations.push({
      field: "contract.output",
      message: "Transformer contract requires non-empty output type reference",
    });
  }
}

function validateReactorContract(
  contract: ReactorContract,
  violations: ValidationViolation[],
): void {
  if (!contract.listens_to || !contract.listens_to.trim()) {
    violations.push({
      field: "contract.listens_to",
      message: "Reactor contract requires non-empty listens_to type reference",
    });
  }
  if (!contract.emits || !contract.emits.trim()) {
    violations.push({
      field: "contract.emits",
      message: "Reactor contract requires non-empty emits type reference",
    });
  }
}

function validateKeeperContract(
  contract: KeeperContract,
  violations: ValidationViolation[],
): void {
  if (!contract.state_schema || !contract.state_schema.trim()) {
    violations.push({
      field: "contract.state_schema",
      message: "Keeper contract requires non-empty state_schema type reference",
    });
  }

  if (!Array.isArray(contract.operations) || contract.operations.length === 0) {
    violations.push({
      field: "contract.operations",
      message: "Keeper contract requires non-empty operations array",
    });
  } else {
    if (!contract.operations.includes("get")) {
      violations.push({
        field: "contract.operations",
        message: 'Keeper contract operations must include "get"',
      });
    }
    if (!contract.operations.includes("set")) {
      violations.push({
        field: "contract.operations",
        message: 'Keeper contract operations must include "set"',
      });
    }
  }
}

function validateChannelContract(
  contract: ChannelContract,
  violations: ValidationViolation[],
): void {
  if (!contract.carries || !contract.carries.trim()) {
    violations.push({
      field: "contract.carries",
      message: "Channel contract requires non-empty carries type reference",
    });
  }

  if (!CHANNEL_MODES.includes(contract.mode as any)) {
    violations.push({
      field: "contract.mode",
      message: `Channel contract mode must be one of: ${CHANNEL_MODES.join(", ")}. Got "${contract.mode}"`,
    });
  }

  if (!Number.isInteger(contract.buffer_size) || contract.buffer_size <= 0) {
    violations.push({
      field: "contract.buffer_size",
      message: `Channel contract buffer_size must be a positive integer, got ${contract.buffer_size}`,
    });
  }
}

// ── Circuit Breaker Validation ──────────────────────────────────────────

function validateCircuitBreaker(cell: ParsedCell, violations: ValidationViolation[]): void {
  const cb = (cell.contract as any)?.circuit_breaker;

  if (!cb) {
    violations.push({
      field: "contract.circuit_breaker",
      message: "circuit_breaker configuration is required",
    });
    return;
  }

  if (!Number.isInteger(cb.complexity_budget) || cb.complexity_budget <= 0) {
    violations.push({
      field: "contract.circuit_breaker.complexity_budget",
      message: `complexity_budget must be a positive integer, got ${cb.complexity_budget}`,
    });
  }

  const expectedAction = SAFE_MODE_ACTIONS[cell.identity.type as CellType];
  if (expectedAction && cb.safe_mode_action !== expectedAction) {
    violations.push({
      field: "contract.circuit_breaker.safe_mode_action",
      message: `safe_mode_action for ${cell.identity.type} must be "${expectedAction}", got "${cb.safe_mode_action}"`,
    });
  }

  if (!cb.safe_mode_action || !cb.safe_mode_action.trim()) {
    violations.push({
      field: "contract.circuit_breaker.safe_mode_action",
      message: "safe_mode_action is required",
    });
  }
}

// ── Lineage (Intent Ledger) Validation ──────────────────────────────────

function validateLineage(cell: ParsedCell, violations: ValidationViolation[]): void {
  const { lineage } = cell;

  if (!lineage.source || !lineage.source.trim()) {
    violations.push({
      field: "lineage.source",
      message: "lineage.source is required (Agent ID)",
    });
  }

  if (!lineage.trigger || !lineage.trigger.trim()) {
    violations.push({
      field: "lineage.trigger",
      message: "lineage.trigger is required (Prompt ID, Issue #, or Decision Record)",
    });
  }

  if (!lineage.justification || !lineage.justification.trim()) {
    violations.push({
      field: "lineage.justification",
      message: "lineage.justification is required (one sentence of structural necessity)",
    });
  }

  if (!lineage.parent_context_hash || !lineage.parent_context_hash.trim()) {
    violations.push({
      field: "lineage.parent_context_hash",
      message: "lineage.parent_context_hash is required (Merkle hash of parent context)",
    });
  }
}

// ── Logic Validation ────────────────────────────────────────────────────

function validateLogic(cell: ParsedCell, violations: ValidationViolation[]): void {
  const { identity, logic } = cell;

  // Channels don't require logic methods
  if (identity.type === "Channel") return;

  if (!logic) {
    violations.push({
      field: "logic",
      message: "logic section is required",
    });
    return;
  }

  if (!logic.lang || !logic.lang.trim()) {
    violations.push({
      field: "logic.lang",
      message: "logic.lang is required (e.g., \"typescript\")",
    });
  }

  // Validate type-specific methods are present
  switch (identity.type) {
    case "Transformer":
      if (!logic.process) {
        violations.push({
          field: "logic.process",
          message: "Transformer requires a logic.process method",
        });
      }
      break;
    case "Reactor":
      if (!logic.on) {
        violations.push({
          field: "logic.on",
          message: "Reactor requires a logic.on method",
        });
      }
      break;
    case "Keeper":
      if (!logic.get) {
        violations.push({
          field: "logic.get",
          message: "Keeper requires a logic.get method",
        });
      }
      if (!logic.set) {
        violations.push({
          field: "logic.set",
          message: "Keeper requires a logic.set method",
        });
      }
      break;
  }
}

// ── Signature Validation ────────────────────────────────────────────────

function validateSignature(cell: ParsedCell, violations: ValidationViolation[]): void {
  if (!cell.signature || !cell.signature.trim()) {
    violations.push({
      field: "signature",
      message: "signature is required (hex string)",
    });
  }
}

// ── Composition Validation ──────────────────────────────────────────────

function validateComposition(cell: ParsedCell, violations: ValidationViolation[]): void {
  if (!cell.children || cell.children.length === 0) return;

  // Validate child refs
  for (let i = 0; i < cell.children.length; i++) {
    const child = cell.children[i];
    if (!child.ref || !child.ref.trim()) {
      violations.push({
        field: `children[${i}].ref`,
        message: `Child at index ${i} is missing ref (file path)`,
      });
    }
    if (!child.as || !child.as.trim()) {
      violations.push({
        field: `children[${i}].as`,
        message: `Child at index ${i} is missing as (local alias)`,
      });
    }
  }

  // Collect aliases
  const aliases = new Set(cell.children.map((c) => c.as).filter(Boolean));

  // Count non-channel children (we infer type from filename convention)
  const nonChannelChildren = cell.children.filter(
    (c) => !c.ref.includes(".channel."),
  );

  // If 2+ non-channel children exist, at least one channel must be declared
  if (nonChannelChildren.length >= 2) {
    if (!cell.channels || cell.channels.length === 0) {
      violations.push({
        field: "channels",
        message:
          "Composed cell with 2+ non-channel children must declare at least one channel for inter-cell communication (Principle III)",
      });
    }
  }

  // Validate channel declarations
  if (cell.channels) {
    for (const ch of cell.channels) {
      if (!ch.name || !ch.name.trim()) {
        violations.push({
          field: "channels[].name",
          message: "Channel declaration requires a name",
        });
      } else if (!aliases.has(ch.name)) {
        violations.push({
          field: "channels[].name",
          message: `Channel name "${ch.name}" does not match any child alias`,
        });
      }

      for (const edge of ch.topology) {
        if (!aliases.has(edge.from)) {
          violations.push({
            field: "channels[].topology[].from",
            message: `Topology "from" alias "${edge.from}" does not match any child alias`,
          });
        }
        if (!aliases.has(edge.to)) {
          violations.push({
            field: "channels[].topology[].to",
            message: `Topology "to" alias "${edge.to}" does not match any child alias`,
          });
        }
      }
    }
  }
}

// ── Type Reference Validation ───────────────────────────────────────────

function validateTypeRefs(
  cell: ParsedCell,
  violations: ValidationViolation[],
  knownTypes?: Set<string>,
): void {
  // Skip if no known types provided (can't validate without project context)
  if (!knownTypes) return;

  const refs = collectTypeRefsFromContract(cell);
  for (const ref of refs) {
    if (!isPrimitive(ref) && !knownTypes.has(ref)) {
      violations.push({
        field: "contract",
        message: `Type reference "${ref}" does not resolve to a built-in primitive or a types/${ref}.schema.json file`,
      });
    }
  }
}

function collectTypeRefsFromContract(cell: ParsedCell): string[] {
  const refs: string[] = [];
  const contract = cell.contract as any;

  switch (cell.identity.type) {
    case "Transformer":
      if (contract.input) refs.push(contract.input);
      if (contract.output) refs.push(contract.output);
      break;
    case "Reactor":
      if (contract.listens_to) refs.push(contract.listens_to);
      if (contract.emits) refs.push(contract.emits);
      break;
    case "Keeper":
      if (contract.state_schema) refs.push(contract.state_schema);
      break;
    case "Channel":
      if (contract.carries) refs.push(contract.carries);
      break;
  }

  return refs;
}

// ── File Naming Validation ──────────────────────────────────────────────

function validateFileName(
  cell: ParsedCell,
  filePath: string,
  violations: ValidationViolation[],
): void {
  const fileName = filePath.split("/").pop() ?? filePath.split("\\").pop() ?? "";
  if (!fileName.endsWith(".fc")) return;

  const withoutExt = fileName.replace(/\.fc$/, "");
  const parts = withoutExt.split(".");

  if (parts.length < 2) {
    violations.push({
      field: "filename",
      message: `File name "${fileName}" should follow <name>.<cell-type>.fc convention`,
    });
    return;
  }

  const fileType = parts[parts.length - 1];
  const expectedType = cell.identity.type.toLowerCase();

  if (fileType !== expectedType) {
    violations.push({
      field: "filename",
      message: `File name type "${fileType}" does not match declared type "${cell.identity.type}"`,
    });
  }
}
