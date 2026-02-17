/**
 * FractalClaw — scan command
 *
 * Scans directories for .fc skill files and checks each one against
 * the constitutional pipeline (parse, validate, scan, signature, budget).
 *
 * Usage:
 *   fractalclaw scan <directory> [--json] [--verbose] [--no-recursive]
 */

import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, resolve, dirname, basename } from "path";
import { loadSingleSkill } from "../skill-loader";
import type { SkillVerdict } from "../skill-loader";

// ── Project Root Resolution ─────────────────────────────────────────────

/**
 * Walk up the directory tree from `startDir` looking for a `fractal.json` file.
 * Returns the directory containing it, or falls back to `startDir` itself.
 */
function findProjectRoot(startDir: string): string {
  let current = resolve(startDir);

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

  return resolve(startDir);
}

// ── File Discovery ──────────────────────────────────────────────────────

/**
 * Discover all .fc files in a directory.
 * When `recursive` is true, descends into subdirectories.
 */
function discoverFcFiles(dir: string, recursive: boolean): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isFile() && entry.endsWith(".fc")) {
      results.push(fullPath);
    } else if (stat.isDirectory() && recursive) {
      results.push(...discoverFcFiles(fullPath, true));
    }
  }

  return results.sort();
}

// ── Output Formatting ───────────────────────────────────────────────────

/**
 * Filter violations to only meaningful ones: those whose principle starts
 * with "Principle" or equals "Circuit Breaker". Falls back to all violations
 * if no meaningful ones match.
 */
function filterViolations(
  violations: Array<{ principle: string; message: string }>
): Array<{ principle: string; message: string }> {
  const meaningful = violations.filter(
    (v) => v.principle.startsWith("Principle") || v.principle === "Circuit Breaker"
  );
  return meaningful.length > 0 ? meaningful : violations;
}

/**
 * Truncate a signature hash for display: "0x" + first 8 hex chars + "..."
 */
function formatSig(sig: string | undefined): string {
  if (!sig) return "";
  const hex = sig.startsWith("0x") ? sig.slice(2) : sig;
  return `sig:0x${hex.slice(0, 4).toUpperCase()}...`;
}

/**
 * Print a passing skill to stdout.
 */
function printPass(verdict: SkillVerdict, verbose: boolean): void {
  const sig = formatSig(verdict.signature);
  const namePadded = verdict.name.padEnd(22);
  console.log(`  \u2705 PASS  ${namePadded}[${verdict.cellType}]  ${sig}`);

  if (verbose && verdict.allViolationMessages.length > 0) {
    for (const v of verdict.allViolationMessages) {
      console.log(`     \u2192 ${v.principle}: ${v.message}`);
    }
  }
}

/**
 * Print a rejected skill to stdout with its violations.
 */
function printRejected(verdict: SkillVerdict): void {
  console.log(`  \u274C REJECTED  ${verdict.name}`);

  const violations = filterViolations(verdict.allViolationMessages);
  for (const v of violations) {
    console.log(`     \u2192 ${v.principle}: ${v.message}`);
  }
}

// ── Main Command ────────────────────────────────────────────────────────

export function scanCommand(
  directory: string,
  options: { json?: boolean; verbose?: boolean; recursive?: boolean }
): void {
  const resolvedDir = resolve(directory);
  const projectRoot = findProjectRoot(resolvedDir);
  const recursive = options.recursive !== false; // default true

  // Discover .fc files
  const files = discoverFcFiles(resolvedDir, recursive);

  if (files.length === 0 && !options.json) {
    console.log("No .fc files found.");
    process.exit(0);
  }

  // Process each file through the constitutional pipeline
  const results: SkillVerdict[] = [];

  for (const filePath of files) {
    const verdict = loadSingleSkill(filePath, projectRoot);
    results.push(verdict);
  }

  // JSON output mode
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    const anyRejected = results.some((r) => !r.accepted);
    process.exit(anyRejected ? 1 : 0);
  }

  // Human-readable output
  for (const verdict of results) {
    if (verdict.accepted) {
      printPass(verdict, !!options.verbose);
    } else {
      printRejected(verdict);
    }
  }

  // Summary
  const passed = results.filter((r) => r.accepted).length;
  const rejected = results.filter((r) => !r.accepted).length;
  const totalViolations = results.reduce(
    (sum, r) => sum + r.allViolationMessages.length,
    0
  );

  console.log("");
  console.log(
    `Results: ${passed} passed | ${rejected} rejected | ${totalViolations} violations found`
  );

  // Exit code: 1 if any rejected
  if (rejected > 0) {
    process.exit(1);
  }
}
