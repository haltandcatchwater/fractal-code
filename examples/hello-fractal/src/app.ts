import { Transformer, printContextMap } from "@fractal-code/sdk";
import { greeter } from "./greeter.transformer";
import { request } from "./request.reactor";
import { memory } from "./memory.keeper";
import { pipe } from "./pipe.channel";

/**
 * Root cell: a Transformer that composes all four cell types.
 *
 * Flow: Request (Reactor) → Pipe (Channel) → Greeter (Transformer) → Pipe (Channel) → Memory (Keeper)
 *
 * All sibling communication passes through the Pipe channel.
 */
export const app = new Transformer<string, string>({
  name: "app",
  version: "1.0.0",
  input: {
    schema: { type: "string" },
    description: "A name to process through the greeting pipeline",
  },
  output: {
    schema: { type: "string" },
    description: "The greeting message produced by the pipeline",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "constitution-v1.0-step5",
    justification: "Root cell demonstrating fractal composition with all four cell types communicating through Channels",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  complexityBudget: 100,
  children: [request, pipe, greeter, memory],
  process: async (name: string) => {
    // Step 1: Reactor receives the request event
    const event = await request.on({ name, timestamp: new Date().toISOString() });

    // Step 2: Send accepted name through Channel
    await pipe.send({ from: "request", to: "greeter", data: event.name });

    // Step 3: Receive from Channel and process through Transformer
    const msg = await pipe.receive();
    const greeting = await greeter.process(msg.data as string);

    // Step 4: Send result through Channel to Keeper
    await pipe.send({ from: "greeter", to: "memory", data: greeting });

    // Step 5: Receive from Channel and store in Keeper
    const result = await pipe.receive();
    const history = await memory.get();
    history.greetings.push({ name, message: result.data as string, timestamp: new Date().toISOString() });
    await memory.set(history);

    return greeting;
  },
});

// ── Run the demo ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═══ HELLO FRACTAL ═══\n");
  console.log("Demonstrating all four cell types with Circuit Breaker & Intent Ledger.\n");

  // Process some greetings
  const names = ["Angelo", "Claude", "Fractal"];
  for (const name of names) {
    const result = await app.process(name);
    console.log(`  [Output] ${result}`);
  }

  // Show stored state
  const history = await memory.get();
  console.log(`\n  [Keeper] Stored ${history.greetings.length} greeting(s) in memory.`);

  // Show health with circuit breaker budget
  const health = app.health();
  console.log(`\n  [Health] App status: ${health.status} (budget: ${health.budgetRemaining})`);
  if (health.children) {
    for (const [name, h] of Object.entries(health.children)) {
      const budget = h.budgetRemaining !== undefined ? ` budget: ${h.budgetRemaining}` : "";
      console.log(`    ${name}: ${h.status}${h.message ? ` (${h.message})` : ""}${budget}`);
    }
  }

  // Print the full context map
  printContextMap(app);

  // Show signature chain
  console.log("═══ STRUCTURAL SIGNATURES ═══\n");
  console.log(`  Root (app):     ${app.signature.hash.slice(0, 32)}...`);
  console.log(`  Children:`);
  for (const child of app.getChildren()) {
    console.log(`    ${child.identity.name.padEnd(12)} ${child.signature.hash.slice(0, 32)}...`);
  }

  // Show Intent Ledger
  console.log("\n═══ INTENT LEDGER ═══\n");
  console.log(`  Root (app):`);
  console.log(`    source:        ${app.lineage.source}`);
  console.log(`    trigger:       ${app.lineage.trigger}`);
  console.log(`    justification: ${app.lineage.justification}`);
  console.log("");
}

main().catch(console.error);
