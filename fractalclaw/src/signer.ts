/**
 * FractalClaw — Structural Signature Computation
 *
 * Computes the SHA-256 structural signature for a .fc cell file.
 * Mirrors the SDK's signature algorithm: the hash is derived from
 * identity fields, resolved JSON schemas, and Intent Ledger entries.
 *
 * The signature is deterministic — the same .fc file with the same
 * type schemas will always produce the same hash.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { parseFC } from "@fractal-code/parser/dist/parse";
import type {
  ParsedCell,
  TransformerContract,
  ReactorContract,
  KeeperContract,
} from "@fractal-code/parser/dist/types";

// ── Project Root Resolution ─────────────────────────────────────────────

/**
 * Walk up the directory tree from `startPath` looking for a `fractal.json` file.
 * Returns the directory containing it, or falls back to the directory of startPath.
 */
export function findProjectRoot(startPath: string): string {
  let current = existsSync(startPath) && require("fs").statSync(startPath).isDirectory()
    ? startPath
    : dirname(startPath);

  while (true) {
    const candidate = join(current, "fractal.json");
    if (existsSync(candidate)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root without finding fractal.json
      break;
    }
    current = parent;
  }

  // Fallback: directory of the original path
  return existsSync(startPath) && require("fs").statSync(startPath).isDirectory()
    ? startPath
    : dirname(startPath);
}

// ── Type Schema Resolution ──────────────────────────────────────────────

/**
 * Resolve a type reference (e.g., "WeatherRequest") to its JSON schema object.
 * Looks for types/<TypeName>.schema.json in the project root.
 * Falls back to a simple { type: typeName } wrapper for built-in primitives.
 */
function resolveTypeSchema(
  typeName: string,
  projectRoot: string
): Record<string, unknown> {
  const schemaPath = join(projectRoot, "types", `${typeName}.schema.json`);
  if (existsSync(schemaPath)) {
    return JSON.parse(readFileSync(schemaPath, "utf-8"));
  }
  // Built-in primitives: wrap in a simple JSON schema
  return { type: typeName };
}

// ── Signature Computation ───────────────────────────────────────────────

/**
 * Compute the structural signature for a parsed .fc cell.
 *
 * Algorithm (matches the SDK):
 *   content = name + cellType(lowercase) + version +
 *             JSON.stringify(inputSchema) + JSON.stringify(outputSchema) +
 *             lineage.source + lineage.trigger + lineage.justification
 *   hash = SHA-256(content)
 *
 * Input/output schemas are resolved per cell type:
 *   - Transformer: contract.input / contract.output
 *   - Reactor:     contract.listens_to / contract.emits
 *   - Keeper:      contract.state_schema / contract.state_schema (same for both)
 */
export function computeSignature(
  filePath: string,
  projectRoot: string
): { parsed: ParsedCell; computed: string; declared: string } {
  const content = readFileSync(filePath, "utf-8");
  const parsed = parseFC(content);

  const name = parsed.identity.name;
  const cellType = parsed.identity.type.toLowerCase();
  const version = parsed.identity.version;

  // Resolve input/output schemas based on cell type
  let inputSchema: Record<string, unknown>;
  let outputSchema: Record<string, unknown>;

  switch (parsed.identity.type) {
    case "Transformer": {
      const contract = parsed.contract as TransformerContract;
      inputSchema = resolveTypeSchema(contract.input, projectRoot);
      outputSchema = resolveTypeSchema(contract.output, projectRoot);
      break;
    }
    case "Reactor": {
      const contract = parsed.contract as ReactorContract;
      inputSchema = resolveTypeSchema(contract.listens_to, projectRoot);
      outputSchema = resolveTypeSchema(contract.emits, projectRoot);
      break;
    }
    case "Keeper": {
      const contract = parsed.contract as KeeperContract;
      inputSchema = resolveTypeSchema(contract.state_schema, projectRoot);
      outputSchema = resolveTypeSchema(contract.state_schema, projectRoot);
      break;
    }
    default:
      inputSchema = {};
      outputSchema = {};
  }

  const hashContent =
    name +
    cellType +
    version +
    JSON.stringify(inputSchema) +
    JSON.stringify(outputSchema) +
    parsed.lineage.source +
    parsed.lineage.trigger +
    parsed.lineage.justification;

  const computed = createHash("sha256").update(hashContent, "utf8").digest("hex");
  const declared = parsed.signature;

  return { parsed, computed, declared };
}
