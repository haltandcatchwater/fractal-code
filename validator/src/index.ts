#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import type { DiscoveredCell, CheckResult, CellHealth } from "./types/cell";
import { cellTypeCheck } from "./checks/cell-type-check";
import { contractCheck } from "./checks/contract-check";
import { compositionCheck } from "./checks/composition-check";
import { selfSimilarityCheck } from "./checks/self-similarity-check";
import { contextMapCheck } from "./checks/context-map-check";
import { signatureCheck } from "./checks/signature-check";
import { circuitBreakerCheck } from "./checks/circuit-breaker-check";
import { lineageCheck } from "./checks/lineage-check";

// ── Cell Discovery ──────────────────────────────────────────────────────

/**
 * Discover cells by requiring compiled JS modules that export cell instances.
 * Looks for files matching *.transformer.js, *.reactor.js, *.keeper.js,
 * *.channel.js, and app.js in a dist/ or src/ directory.
 */
function findCellFiles(dir: string): string[] {
  const cellFiles: string[] = [];
  const cellPattern = /\.(transformer|reactor|keeper|channel)\.js$/;
  const appPattern = /app\.js$/;

  function walk(current: string): void {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        walk(full);
      } else if (entry.isFile() && (cellPattern.test(entry.name) || appPattern.test(entry.name))) {
        cellFiles.push(full);
      }
    }
  }

  // Prefer dist/ (compiled), fall back to src/
  const distDir = path.join(dir, "dist");
  const srcDir = path.join(dir, "src");
  if (fs.existsSync(distDir)) {
    walk(distDir);
  } else if (fs.existsSync(srcDir)) {
    walk(srcDir);
  } else {
    walk(dir);
  }

  return cellFiles;
}

/** Safely call health() on a cell instance. */
function safeHealth(cell: any): CellHealth | undefined {
  try {
    if (typeof cell.health === "function") {
      return cell.health();
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Build a DiscoveredCell from a live cell instance.
 */
function cellToDiscovered(cell: any, filePath: string): DiscoveredCell {
  const emptyLineage = { source: "", trigger: "", justification: "", signature: "" };
  const healthReport = safeHealth(cell);

  const discovered: DiscoveredCell = {
    filePath,
    identity: cell.identity,
    input: cell.input ?? { schema: {}, description: "" },
    output: cell.output ?? { schema: {}, description: "" },
    lineage: cell.lineage ?? emptyLineage,
    signature: cell.signature ?? { hash: "", timestamp: "" },
    contextMap: typeof cell.toMap === "function" ? cell.toMap() : { identity: cell.identity, signature: "" },
    children: [],
    hasHealthMethod: typeof cell.health === "function",
    hasToMapMethod: typeof cell.toMap === "function",
    healthReport,
  };

  // Discover children
  const children = typeof cell.getChildren === "function" ? cell.getChildren() : [];
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && child.identity) {
        discovered.children.push(cellToDiscovered(child, filePath + `#${child.identity.name}`));
      }
    }
  }

  return discovered;
}

/**
 * Load a cell from a compiled JS module.
 * The module should export a cell instance (default or named export).
 */
function loadCell(filePath: string): DiscoveredCell | null {
  try {
    const mod = require(path.resolve(filePath));
    const cell = mod.default ?? mod.cell ?? mod.app ?? Object.values(mod)[0];
    if (!cell || !cell.identity) return null;
    return cellToDiscovered(cell, filePath);
  } catch (err) {
    console.error(`  Warning: Could not load cell from ${filePath}: ${(err as Error).message}`);
    return null;
  }
}

// ── Report ───────────────────────────────────────────────────────────────

function printReport(results: CheckResult[]): void {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║      FRACTAL CODE — CONSTITUTIONAL VALIDATION       ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  let totalViolations = 0;

  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`  ${icon} ${result.checkName}: ${status}`);

    if (!result.passed) {
      for (const v of result.violations) {
        totalViolations++;
        console.log(`    → [Principle ${v.principle}] ${v.cell}: ${v.message}`);
        console.log(`      File: ${v.file}`);
      }
    }
  }

  const allPassed = results.every((r) => r.passed);
  console.log("");
  if (allPassed) {
    console.log("  ══ ALL CHECKS PASSED — Constitution upheld ══\n");
  } else {
    console.log(`  ══ ${totalViolations} VIOLATION(S) FOUND — Constitution breached ══\n`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  const targetDir = process.argv[2] ?? ".";
  const resolvedDir = path.resolve(targetDir);

  console.log(`\nValidating: ${resolvedDir}`);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`Error: Directory "${resolvedDir}" does not exist.`);
    process.exit(1);
  }

  // Discover cells
  const cellFiles = findCellFiles(resolvedDir);
  if (cellFiles.length === 0) {
    console.log("  No cell files found. Looking for *.{transformer,reactor,keeper,channel}.js or app.js");
    console.log("  Make sure the project is compiled (npm run build) before validating.\n");
    process.exit(0);
  }

  console.log(`  Found ${cellFiles.length} cell file(s):\n`);
  for (const f of cellFiles) {
    console.log(`    ${path.relative(resolvedDir, f)}`);
  }
  console.log("");

  // Load cells
  const cells: DiscoveredCell[] = [];
  for (const filePath of cellFiles) {
    const cell = loadCell(filePath);
    if (cell) {
      cells.push(cell);
    }
  }

  if (cells.length === 0) {
    console.log("  No valid cells could be loaded. Check that files export cell instances.\n");
    process.exit(1);
  }

  console.log(`  Loaded ${cells.length} cell(s) for validation.\n`);

  // Run all eight checks
  const results: CheckResult[] = [
    cellTypeCheck(cells),
    contractCheck(cells),
    compositionCheck(cells),
    selfSimilarityCheck(cells),
    contextMapCheck(cells),
    signatureCheck(cells),
    circuitBreakerCheck(cells),
    lineageCheck(cells),
  ];

  printReport(results);

  const allPassed = results.every((r) => r.passed);
  process.exit(allPassed ? 0 : 1);
}

main();
