/**
 * FractalClaw — Budget Enforcement Demo
 *
 * Creates a real SDK Transformer with budget=3, calls process() 4 times,
 * shows budget decrement then safe-mode block on the 4th call.
 * Demonstrates that Fractal Code's circuit breaker is not advisory —
 * it's a hard runtime enforcement mechanism.
 */

import { Transformer } from "@fractal-code/sdk";

export interface BudgetStep {
  call: number;
  blocked: boolean;
  budgetBefore: number;
  budgetAfter: number;
  error?: string;
}

/**
 * Run the circuit breaker demo: 3 successful calls, then safe-mode block.
 */
export async function runBudgetDemo(): Promise<BudgetStep[]> {
  const steps: BudgetStep[] = [];

  const cell = new Transformer<string, string>({
    name: "budget-demo",
    version: "1.0.0",
    input: {
      schema: { type: "string" },
      description: "Demo input",
    },
    output: {
      schema: { type: "string" },
      description: "Demo output",
    },
    lineage: {
      source: "FractalClaw-Demo",
      trigger: "budget-enforcement-poc",
      justification: "Demonstrates circuit breaker hard enforcement at budget exhaustion.",
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
    },
    complexityBudget: 3,
    process: async (input: string) => `processed: ${input}`,
  });

  for (let i = 1; i <= 4; i++) {
    const budgetBefore = cell.budgetRemaining;
    try {
      await cell.process(`call-${i}`);
      steps.push({
        call: i,
        blocked: false,
        budgetBefore,
        budgetAfter: cell.budgetRemaining,
      });
    } catch (err) {
      steps.push({
        call: i,
        blocked: true,
        budgetBefore,
        budgetAfter: cell.budgetRemaining,
        error: (err as Error).message,
      });
    }
  }

  return steps;
}
