/**
 * FractalClaw — Constitutional Skill Loader Demo
 *
 * Entry point. Loads legitimate skills (should PASS), loads malicious
 * skills (should FAIL), prints formatted output, shows budget enforcement.
 */

import { join } from "path";
import { loadSkills } from "./skill-loader";
import { runBudgetDemo } from "./skill-executor";

const PROJECT_ROOT = join(__dirname, "..");
const LEGITIMATE_DIR = join(PROJECT_ROOT, "demos", "legitimate");
const MALICIOUS_DIR = join(PROJECT_ROOT, "demos", "malicious");

function printHeader(): void {
  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log("  FractalClaw — Constitutional Skill Loader");
  console.log("═══════════════════════════════════════════════════════");
}

function printLegitimate(): number {
  console.log("\nLoading skills...\n");

  const result = loadSkills(LEGITIMATE_DIR, PROJECT_ROOT);

  for (const skill of result.skills) {
    if (skill.accepted) {
      const name = skill.name.padEnd(22);
      const type = `[${skill.cellType}]`.padEnd(15);
      const sigShort = skill.signature ? `sig:0x${skill.signature.slice(0, 4).toUpperCase()}...` : "sig:unknown";
      console.log(`  ✅ PASS  ${name}${type}${sigShort}`);
    }
  }

  return result.accepted;
}

function printMalicious(): { rejected: number; violations: number } {
  console.log("\nScanning for threats...\n");

  const result = loadSkills(MALICIOUS_DIR, PROJECT_ROOT);
  let totalViolations = 0;

  for (const skill of result.skills) {
    if (!skill.accepted) {
      console.log(`  ❌ REJECTED  ${skill.name}`);

      // Filter to show only the most relevant violations (not structural noise)
      const meaningful = filterMeaningfulViolations(skill.allViolationMessages);
      for (const v of meaningful) {
        console.log(`     → ${v.principle}: ${v.message}`);
        totalViolations++;
      }
      console.log("");
    }
  }

  return { rejected: result.rejected, violations: totalViolations };
}

/**
 * Filter violations to show the constitutional reason, not structural noise.
 * Static scanner, signature, and budget violations are meaningful.
 * Structural validation violations are noise for the demo.
 */
function filterMeaningfulViolations(
  violations: Array<{ principle: string; message: string }>,
): Array<{ principle: string; message: string }> {
  const meaningful = violations.filter(
    (v) => v.principle.startsWith("Principle") || v.principle === "Circuit Breaker",
  );
  // If we have meaningful violations, show only those.
  // If not, show all (something structural is the real issue).
  return meaningful.length > 0 ? meaningful : violations;
}

async function printBudgetDemo(): Promise<void> {
  console.log("Circuit Breaker enforcement...\n");

  const steps = await runBudgetDemo();

  for (const step of steps) {
    if (step.blocked) {
      console.log(`  🛑 Call ${step.call}: BLOCKED — complexity budget exhausted, cell in safe-mode`);
    } else {
      console.log(`  ✓ Call ${step.call}: budget ${step.budgetBefore} → ${step.budgetAfter}`);
    }
  }
}

function printSummary(accepted: number, rejected: number, violations: number): void {
  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Results: ${accepted} loaded  |  ${rejected} rejected  |  ${violations} violations caught`);
  console.log("  Constitutional integrity: ENFORCED");
  console.log("═══════════════════════════════════════════════════════");
  console.log("");
}

async function main(): Promise<void> {
  printHeader();

  const accepted = printLegitimate();
  const { rejected, violations } = printMalicious();
  await printBudgetDemo();

  printSummary(accepted, rejected, violations);
}

main().catch(console.error);
