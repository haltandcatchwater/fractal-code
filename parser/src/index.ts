#!/usr/bin/env node

/**
 * Fractal Code .fc Parser — Entry Point & CLI
 *
 * Usage:
 *   fractal-parse <file.fc> [--project-root <dir>]
 *   fractal-parse <directory> [--project-root <dir>]
 *
 * Parses .fc files and validates them against constitutional constraints.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname, basename } from "path";
import { parseFC, ParseError } from "./parse";
import { validateCell } from "./validate";
import { isPrimitive } from "./resolve-types";
import type { ParsedCell, ValidationResult } from "./types";

// ── Public API (for programmatic use) ───────────────────────────────────

export { parseFC, ParseError } from "./parse";
export { validateCell } from "./validate";
export { resolveType, isPrimitive, resolvePrimitive, resolveNamedType } from "./resolve-types";
export type {
  ParsedCell,
  CellIdentity,
  CellLineage,
  CellLogic,
  CellContract,
  TransformerContract,
  ReactorContract,
  KeeperContract,
  ChannelContract,
  ChildRef,
  ChannelDeclaration,
  ValidationResult,
  ValidationViolation,
  CellType,
  SafeModeAction,
  ChannelMode,
} from "./types";

// ── CLI ─────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const target = resolve(args[0]);
  const projectRootIdx = args.indexOf("--project-root");
  const projectRoot = projectRootIdx >= 0 && args[projectRootIdx + 1]
    ? resolve(args[projectRootIdx + 1])
    : findProjectRoot(target);

  // Discover known types from types/ directory
  const knownTypes = discoverTypes(projectRoot);

  // Parse target: file or directory
  if (!existsSync(target)) {
    console.error(`Error: ${target} does not exist`);
    process.exit(1);
  }

  const stat = statSync(target);
  const files = stat.isDirectory()
    ? discoverFCFiles(target)
    : [target];

  if (files.length === 0) {
    console.error("No .fc files found");
    process.exit(1);
  }

  let totalViolations = 0;
  let totalFiles = 0;

  console.log(`\n  FRACTAL CODE PARSER v0.1.0\n`);
  console.log(`  Project root: ${projectRoot}`);
  console.log(`  Known types:  ${knownTypes.size > 0 ? [...knownTypes].join(", ") : "(none)"}\n`);

  for (const filePath of files) {
    totalFiles++;
    const result = parseAndValidate(filePath, projectRoot, knownTypes);

    const fileName = basename(filePath);
    if (result.valid) {
      console.log(`  [PASS] ${fileName} — ${result.cell!.identity.type} "${result.cell!.identity.name}" v${result.cell!.identity.version}`);
    } else {
      console.log(`  [FAIL] ${fileName}`);
      for (const v of result.violations) {
        console.log(`         - ${v.field}: ${v.message}`);
      }
      totalViolations += result.violations.length;
    }
  }

  console.log(`\n  ──────────────────────────────────────────`);
  console.log(`  Files:      ${totalFiles}`);
  console.log(`  Violations: ${totalViolations}`);
  console.log(`  Result:     ${totalViolations === 0 ? "ALL CHECKS PASSED" : "VALIDATION FAILED"}\n`);

  process.exit(totalViolations > 0 ? 1 : 0);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function parseAndValidate(
  filePath: string,
  projectRoot: string,
  knownTypes: Set<string>,
): ValidationResult {
  try {
    const content = readFileSync(filePath, "utf-8");
    const cell = parseFC(content);
    return validateCell(cell, filePath, knownTypes);
  } catch (err) {
    if (err instanceof ParseError) {
      return {
        valid: false,
        violations: [{ field: "parse", message: err.message }],
      };
    }
    return {
      valid: false,
      violations: [{ field: "parse", message: `YAML parse error: ${(err as Error).message}` }],
    };
  }
}

function discoverFCFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isFile() && entry.endsWith(".fc")) {
      results.push(fullPath);
    } else if (stat.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
      results.push(...discoverFCFiles(fullPath));
    }
  }

  return results.sort();
}

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
    // types/ directory not readable — not an error
  }

  return types;
}

function findProjectRoot(target: string): string {
  let dir = statSync(target).isDirectory() ? target : dirname(target);

  // Walk up looking for fractal.json
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "fractal.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }

  // Fallback: use target's directory
  return statSync(target).isDirectory() ? target : dirname(target);
}

function printUsage(): void {
  console.log(`
  Fractal Code .fc Parser

  Usage:
    fractal-parse <file.fc>                  Parse and validate a single .fc file
    fractal-parse <directory>                Parse all .fc files in a directory
    fractal-parse <path> --project-root <dir>  Specify project root for type resolution

  Options:
    --project-root <dir>  Project root containing fractal.json and types/
    -h, --help            Show this help message

  Examples:
    fractal-parse greeter.transformer.fc
    fractal-parse ./cells/
    fractal-parse app.transformer.fc --project-root /path/to/project
`);
}

// ── Run CLI if executed directly ────────────────────────────────────────

main();
