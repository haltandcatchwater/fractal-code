/**
 * FractalClaw — Constitutional Skill Loader
 *
 * The skill loading pipeline. Every .fc skill file passes through five stages:
 *
 *   .fc file → [1] parseFC() → [2] validateCell() → [3] scanLogic() →
 *              [4] signature verify → [5] budget checks → ACCEPT or REJECT
 *
 * A skill is REJECTED at the first stage that produces violations.
 * Legitimate skills pass all stages. Each malicious skill fails at
 * a specific constitutional principle.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename, dirname } from "path";
import { createHash } from "crypto";
// Import from parser submodules to avoid triggering the CLI main()
import { parseFC } from "@fractal-code/parser/dist/parse";
import { validateCell } from "@fractal-code/parser/dist/validate";
import type { ParsedCell, TransformerContract, ReactorContract, KeeperContract } from "@fractal-code/parser/dist/types";
import { scanLogicBody } from "./skill-scanner";
import type { ScanViolation } from "./skill-scanner";

// ── Types ───────────────────────────────────────────────────────────────

export interface SkillViolation {
  principle: string;
  message: string;
}

export interface SkillVerdict {
  name: string;
  cellType: string;
  accepted: boolean;
  signature?: string;
  computedSignature?: string;
  allViolationMessages: SkillViolation[];
}

export interface LoadResult {
  skills: SkillVerdict[];
  accepted: number;
  rejected: number;
  totalViolations: number;
}

// ── Signature Computation ───────────────────────────────────────────────

/**
 * Resolve a type reference to its JSON schema object.
 * Looks for types/<TypeName>.schema.json in the project root.
 */
function resolveTypeSchema(typeName: string, projectRoot: string): Record<string, unknown> {
  const schemaPath = join(projectRoot, "types", `${typeName}.schema.json`);
  if (existsSync(schemaPath)) {
    return JSON.parse(readFileSync(schemaPath, "utf-8"));
  }
  // Built-in primitives: wrap in a simple JSON schema
  return { type: typeName };
}

/**
 * Compute the expected SHA-256 signature for a parsed .fc cell.
 * Mirrors the SDK's signature algorithm:
 *   content = name + cellType(lowercase) + version +
 *             JSON.stringify(input.schema) + JSON.stringify(output.schema) +
 *             lineage.source + lineage.trigger + lineage.justification
 */
function computeExpectedSignature(cell: ParsedCell, projectRoot: string): string {
  const name = cell.identity.name;
  const cellType = cell.identity.type.toLowerCase();
  const version = cell.identity.version;

  // Resolve input/output schemas based on cell type
  let inputSchema: Record<string, unknown>;
  let outputSchema: Record<string, unknown>;

  switch (cell.identity.type) {
    case "Transformer": {
      const contract = cell.contract as TransformerContract;
      inputSchema = resolveTypeSchema(contract.input, projectRoot);
      outputSchema = resolveTypeSchema(contract.output, projectRoot);
      break;
    }
    case "Reactor": {
      const contract = cell.contract as ReactorContract;
      inputSchema = resolveTypeSchema(contract.listens_to, projectRoot);
      outputSchema = resolveTypeSchema(contract.emits, projectRoot);
      break;
    }
    case "Keeper": {
      const contract = cell.contract as KeeperContract;
      inputSchema = resolveTypeSchema(contract.state_schema, projectRoot);
      outputSchema = resolveTypeSchema(contract.state_schema, projectRoot);
      break;
    }
    default:
      inputSchema = {};
      outputSchema = {};
  }

  const content =
    name +
    cellType +
    version +
    JSON.stringify(inputSchema) +
    JSON.stringify(outputSchema) +
    cell.lineage.source +
    cell.lineage.trigger +
    cell.lineage.justification;

  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ── Budget Validation ───────────────────────────────────────────────────

const MAX_SAFE_BUDGET = 1_000_000;

function checkBudget(cell: ParsedCell): SkillViolation[] {
  const violations: SkillViolation[] = [];
  const cb = (cell.contract as any)?.circuit_breaker;

  if (!cb) return violations;

  const budget = cb.complexity_budget;

  if (budget === Infinity || budget > MAX_SAFE_BUDGET) {
    violations.push({
      principle: "Circuit Breaker",
      message: `complexity_budget ${budget} exceeds safe maximum`,
    });
  }

  if (budget <= 0) {
    violations.push({
      principle: "Circuit Breaker",
      message: `complexity_budget ${budget} must be positive`,
    });
  }

  return violations;
}

// ── Discovery ───────────────────────────────────────────────────────────

function discoverTypes(projectRoot: string): Set<string> {
  const typesDir = join(projectRoot, "types");
  const types = new Set<string>();

  if (!existsSync(typesDir)) return types;

  try {
    const files = readdirSync(typesDir);
    for (const file of files) {
      if (file.endsWith(".schema.json")) {
        types.add(file.replace(".schema.json", ""));
      }
    }
  } catch {
    // types/ not readable
  }

  return types;
}

// ── Pipeline ────────────────────────────────────────────────────────────

/**
 * Load and validate a single .fc skill file through the full pipeline.
 */
export function loadSingleSkill(filePath: string, projectRoot: string): SkillVerdict {
  const allViolations: SkillViolation[] = [];
  let cellName = basename(filePath, ".fc");
  let cellType = "unknown";

  // Stage 1: Parse
  let parsed: ParsedCell;
  try {
    const content = readFileSync(filePath, "utf-8");
    parsed = parseFC(content);
    cellName = parsed.identity.name;
    cellType = parsed.identity.type;
  } catch (err) {
    return {
      name: cellName,
      cellType,
      accepted: false,
      allViolationMessages: [{
        principle: "Parse",
        message: `Parse error: ${(err as Error).message}`,
      }],
    };
  }

  // Stage 2: Structural validation (parser's validateCell)
  const knownTypes = discoverTypes(projectRoot);
  const validation = validateCell(parsed, filePath, knownTypes);
  if (!validation.valid) {
    for (const v of validation.violations) {
      allViolations.push({
        principle: "Structure",
        message: `${v.field}: ${v.message}`,
      });
    }
  }

  // Stage 3: Static analysis (scan logic bodies)
  const scanResult = scanLogicBody(cellName, parsed.logic);
  if (!scanResult.passed) {
    for (const v of scanResult.violations) {
      allViolations.push({
        principle: `Principle ${v.principle}`,
        message: v.message,
      });
    }
  }

  // Stage 4: Signature verification
  const computedSig = computeExpectedSignature(parsed, projectRoot);
  const declaredSig = parsed.signature;

  // Only check signature if it's not a placeholder
  if (declaredSig && !declaredSig.startsWith("0x0000")) {
    // Normalize: strip optional 0x prefix for comparison
    const normalizedDeclared = declaredSig.startsWith("0x") ? declaredSig.slice(2) : declaredSig;
    const normalizedComputed = computedSig;

    if (normalizedDeclared !== normalizedComputed) {
      allViolations.push({
        principle: "Principle X",
        message: `Signature mismatch — declared ${normalizedDeclared.slice(0, 16)}... != computed ${normalizedComputed.slice(0, 16)}...`,
      });
    }
  }

  // Stage 5: Budget sanity
  const budgetViolations = checkBudget(parsed);
  allViolations.push(...budgetViolations);

  return {
    name: cellName,
    cellType,
    accepted: allViolations.length === 0,
    signature: computedSig,
    computedSignature: computedSig,
    allViolationMessages: allViolations,
  };
}

/**
 * Load all .fc skills from a directory.
 */
export function loadSkills(dir: string, projectRoot: string): LoadResult {
  const skills: SkillVerdict[] = [];

  if (!existsSync(dir)) {
    return { skills, accepted: 0, rejected: 0, totalViolations: 0 };
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".fc"))
    .sort();

  for (const file of files) {
    skills.push(loadSingleSkill(join(dir, file), projectRoot));
  }

  const accepted = skills.filter((s) => s.accepted).length;
  const rejected = skills.filter((s) => !s.accepted).length;
  const totalViolations = skills.reduce((sum, s) => sum + s.allViolationMessages.length, 0);

  return { skills, accepted, rejected, totalViolations };
}
