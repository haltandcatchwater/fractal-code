/**
 * FractalClaw — verify command
 *
 * Deep per-check verification of a single .fc file. Runs all 8
 * constitutional checks individually and reports pass/fail for each,
 * with detailed diagnostics on any failures.
 *
 * Usage:
 *   fractalclaw verify <file>
 */

import { readFileSync, existsSync } from "fs";
import { resolve, basename, dirname, join } from "path";
import { parseFC } from "@fractal-code/parser/dist/parse";
import type { ParsedCell, TransformerContract, ReactorContract, KeeperContract } from "@fractal-code/parser/dist/types";
import { scanLogicBody } from "../skill-scanner";
import { computeSignature, findProjectRoot } from "../signer";

// ── Constants ────────────────────────────────────────────────────────────

const VALID_CELL_TYPES = ["Transformer", "Reactor", "Keeper", "Channel"] as const;
type CellType = (typeof VALID_CELL_TYPES)[number];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const EXPECTED_SAFE_MODE: Record<CellType, string> = {
  Transformer: "halt",
  Reactor: "halt",
  Keeper: "read_only",
  Channel: "drop_newest",
};

const CHECK_WIDTH = 33;

// ── Types ────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  passed: boolean;
  summary: string;
  details: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

function padCheck(name: string): string {
  return name.padEnd(CHECK_WIDTH);
}

function formatSigShort(sig: string): string {
  const hex = sig.startsWith("0x") ? sig.slice(2) : sig;
  return `0x${hex.slice(0, 16).toUpperCase()}...`;
}

function isCellType(value: string): value is CellType {
  return (VALID_CELL_TYPES as readonly string[]).includes(value);
}

// ── Individual Checks ────────────────────────────────────────────────────

function checkYamlParsing(content: string): { result: CheckResult; parsed: ParsedCell | null } {
  try {
    const parsed = parseFC(content);
    return {
      result: { name: "YAML parsing", passed: true, summary: "valid structure", details: [] },
      parsed,
    };
  } catch (err) {
    return {
      result: {
        name: "YAML parsing",
        passed: false,
        summary: "parse error",
        details: [`${(err as Error).message}`],
      },
      parsed: null,
    };
  }
}

function checkCellType(parsed: ParsedCell): CheckResult {
  const type = parsed.identity.type;
  if (isCellType(type)) {
    return { name: "Cell type", passed: true, summary: `${type} (valid)`, details: [] };
  }
  return {
    name: "Cell type",
    passed: false,
    summary: `"${type}" is not a valid cell type`,
    details: [`Expected one of: ${VALID_CELL_TYPES.join(", ")}`],
  };
}

function checkIdentity(parsed: ParsedCell): CheckResult {
  const { name, version, type } = parsed.identity;
  const problems: string[] = [];

  if (!name) problems.push("name is missing or empty");
  if (!version) {
    problems.push("version is missing or empty");
  } else if (!SEMVER_RE.test(version)) {
    problems.push(`version "${version}" is not valid semver (expected X.Y.Z)`);
  }
  if (!type) problems.push("type is missing or empty");

  if (problems.length === 0) {
    return { name: "Identity", passed: true, summary: "name, version, type present", details: [] };
  }
  return {
    name: "Identity",
    passed: false,
    summary: `${problems.length} field(s) invalid`,
    details: problems,
  };
}

function checkContract(parsed: ParsedCell): CheckResult {
  const type = parsed.identity.type;
  const contract = parsed.contract as unknown as Record<string, unknown>;
  const problems: string[] = [];

  switch (type) {
    case "Transformer": {
      const c = parsed.contract as TransformerContract;
      if (!c.input) problems.push("input is missing or empty");
      if (!c.output) problems.push("output is missing or empty");
      if (problems.length === 0) {
        return { name: "Contract", passed: true, summary: "input and output defined", details: [] };
      }
      break;
    }
    case "Reactor": {
      const c = parsed.contract as ReactorContract;
      if (!c.listens_to) problems.push("listens_to is missing or empty");
      if (!c.emits) problems.push("emits is missing or empty");
      if (problems.length === 0) {
        return { name: "Contract", passed: true, summary: "listens_to and emits defined", details: [] };
      }
      break;
    }
    case "Keeper": {
      const c = parsed.contract as KeeperContract;
      if (!c.state_schema) problems.push("state_schema is missing or empty");
      if (!c.operations || c.operations.length === 0) problems.push("operations is missing or empty");
      if (problems.length === 0) {
        return { name: "Contract", passed: true, summary: "state_schema and operations defined", details: [] };
      }
      break;
    }
    case "Channel": {
      const c = contract as any;
      if (!c.carries) problems.push("carries is missing or empty");
      if (!c.mode) problems.push("mode is missing or empty");
      if (c.buffer_size === undefined || c.buffer_size === null) problems.push("buffer_size is missing");
      if (problems.length === 0) {
        return { name: "Contract", passed: true, summary: "carries, mode, and buffer_size defined", details: [] };
      }
      break;
    }
    default: {
      problems.push(`unknown cell type "${type}" — cannot validate contract`);
    }
  }

  return {
    name: "Contract",
    passed: false,
    summary: `${problems.length} field(s) missing`,
    details: problems,
  };
}

function checkCircuitBreaker(parsed: ParsedCell): CheckResult {
  const type = parsed.identity.type;
  const cb = (parsed.contract as any)?.circuit_breaker;
  const problems: string[] = [];

  if (!cb) {
    return {
      name: "Circuit Breaker",
      passed: false,
      summary: "circuit_breaker block missing",
      details: ["No circuit_breaker defined in contract"],
    };
  }

  const budget = cb.complexity_budget;

  if (typeof budget !== "number" || !Number.isInteger(budget) || budget <= 0) {
    problems.push(`complexity_budget ${budget} must be a positive integer`);
  } else if (budget > 1_000_000) {
    problems.push(`complexity_budget ${budget} exceeds maximum of 1,000,000`);
  }

  if (isCellType(type)) {
    const expected = EXPECTED_SAFE_MODE[type];
    if (cb.safe_mode_action !== expected) {
      problems.push(
        `safe_mode_action "${cb.safe_mode_action}" does not match expected "${expected}" for ${type}`
      );
    }
  }

  if (problems.length === 0) {
    return {
      name: "Circuit Breaker",
      passed: true,
      summary: `budget: ${budget}, action: ${cb.safe_mode_action}`,
      details: [],
    };
  }
  return {
    name: "Circuit Breaker",
    passed: false,
    summary: `${problems.length} issue(s)`,
    details: problems,
  };
}

function checkIntentLedger(parsed: ParsedCell): CheckResult {
  const { source, trigger, justification, parent_context_hash } = parsed.lineage;
  const problems: string[] = [];

  if (!source) problems.push("source is missing or empty");
  if (!trigger) problems.push("trigger is missing or empty");
  if (!justification) problems.push("justification is missing or empty");
  if (!parent_context_hash) problems.push("parent_context_hash is missing or empty");

  if (problems.length === 0) {
    return {
      name: "Intent Ledger",
      passed: true,
      summary: "all 4 fields present and non-empty",
      details: [],
    };
  }
  return {
    name: "Intent Ledger",
    passed: false,
    summary: `${problems.length} field(s) missing or empty`,
    details: problems,
  };
}

function checkStaticAnalysis(parsed: ParsedCell): CheckResult {
  const scanResult = scanLogicBody(parsed.identity.name, parsed.logic);

  if (scanResult.passed) {
    return {
      name: "Static analysis",
      passed: true,
      summary: "no banned patterns detected",
      details: [],
    };
  }

  const count = scanResult.violations.length;
  return {
    name: "Static analysis",
    passed: false,
    summary: `${count} violation${count === 1 ? "" : "s"} detected`,
    details: scanResult.violations.map((v) => v.message),
  };
}

function checkStructuralSignature(filePath: string, projectRoot: string): CheckResult {
  try {
    const { parsed, computed, declared } = computeSignature(filePath, projectRoot);

    // Normalize for comparison
    const normalizedDeclared = declared.startsWith("0x") ? declared.slice(2) : declared;
    const normalizedComputed = computed;

    if (normalizedDeclared === normalizedComputed) {
      return {
        name: "Structural Signature",
        passed: true,
        summary: "declared matches computed",
        details: [],
      };
    }

    return {
      name: "Structural Signature",
      passed: false,
      summary: "declared does not match computed",
      details: [
        `Declared:  ${formatSigShort(declared)}`,
        `Computed:  ${formatSigShort(computed)}`,
        "Fix: run `npx fractalclaw sign -w` to update",
      ],
    };
  } catch (err) {
    return {
      name: "Structural Signature",
      passed: false,
      summary: "signature computation failed",
      details: [(err as Error).message],
    };
  }
}

// ── Main Command ─────────────────────────────────────────────────────────

export function verifyCommand(filePath: string): void {
  // Step 1: Resolve the file path
  const resolved = resolve(filePath);

  if (!existsSync(resolved)) {
    console.error(`Error: file not found: ${resolved}`);
    process.exit(1);
  }

  if (!resolved.endsWith(".fc")) {
    console.error(`Error: file must have .fc extension: ${resolved}`);
    process.exit(1);
  }

  // Step 2: Find project root
  const projectRoot = findProjectRoot(resolved);

  // Step 3: Read file content
  const content = readFileSync(resolved, "utf-8");
  const fileName = basename(resolved);

  console.log(`Verifying: ${fileName}`);
  console.log("");

  const results: CheckResult[] = [];

  // Check 1: YAML parsing
  const { result: yamlResult, parsed } = checkYamlParsing(content);
  results.push(yamlResult);

  if (parsed) {
    // Check 2: Cell type
    results.push(checkCellType(parsed));

    // Check 3: Identity
    results.push(checkIdentity(parsed));

    // Check 4: Contract
    results.push(checkContract(parsed));

    // Check 5: Circuit Breaker
    results.push(checkCircuitBreaker(parsed));

    // Check 6: Intent Ledger
    results.push(checkIntentLedger(parsed));

    // Check 7: Static analysis
    results.push(checkStaticAnalysis(parsed));

    // Check 8: Structural Signature
    results.push(checkStructuralSignature(resolved, projectRoot));
  } else {
    // If YAML parsing failed, mark remaining checks as failed
    const skippedChecks = [
      "Cell type",
      "Identity",
      "Contract",
      "Circuit Breaker",
      "Intent Ledger",
      "Static analysis",
      "Structural Signature",
    ];
    for (const name of skippedChecks) {
      results.push({
        name,
        passed: false,
        summary: "skipped (YAML parse failed)",
        details: [],
      });
    }
  }

  // Print results
  for (const check of results) {
    const icon = check.passed ? "\u2705" : "\u274C";
    console.log(`  ${icon} ${padCheck(check.name)}${check.summary}`);

    for (const detail of check.details) {
      console.log(`     \u2192 ${detail}`);
    }
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("");
  if (failed === 0) {
    console.log(`  Result: PASS \u2014 ${passed}/${total} checks passed`);
  } else {
    console.log(
      `  Result: FAIL \u2014 ${passed}/${total} checks passed, ${failed} failed`
    );
  }

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}
