import { Transformer, printContextMap } from "@fractal-code/sdk";
import { ingester } from "./ingester.reactor";
import { validator } from "./validator.transformer";
import { enricher } from "./enricher.transformer";
import { store } from "./store.keeper";
import { pipeline } from "./pipeline.channel";
import { output } from "./output.channel";

/**
 * Root cell: a Transformer that composes a full log processing pipeline.
 *
 * Architecture:
 *   Ingester (Reactor) -> [intake*] -> Validator (Transformer) -> [pipeline] -> Enricher (Transformer) -> [output] -> Store (Keeper)
 *
 * * The intake channel is defined in intake.channel.fc — here we use the pipeline
 *   and output TypeScript channels to demonstrate mixed .ts/.fc interoperability.
 *
 * All sibling communication passes through Channels.
 */

interface RawLogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const app = new Transformer<RawLogEntry[], string>({
  name: "data-pipeline",
  version: "1.0.0",
  input: {
    schema: { type: "array", items: { type: "object" } },
    description: "An array of raw log entries to process through the pipeline",
  },
  output: {
    schema: { type: "string" },
    description: "A summary of pipeline processing results",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "data-pipeline-example-v1",
    justification: "Root composed cell orchestrating the full log processing pipeline with all four cell types",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  complexityBudget: 1000,
  children: [ingester, validator, enricher, store, pipeline, output],
  process: async (entries: RawLogEntry[]): Promise<string> => {
    const state = await store.get();

    for (const entry of entries) {
      state.stats.total_ingested++;

      // Step 1: Ingest via Reactor
      let ingested: RawLogEntry;
      try {
        ingested = await ingester.on(entry);
      } catch {
        state.stats.total_invalid++;
        continue;
      }

      // Step 2: Send through pipeline channel to validator
      await pipeline.send({ from: "ingester", to: "validator", data: ingested });
      const validatorMsg = await pipeline.receive();

      // Step 3: Validate
      const validated = await validator.process(validatorMsg.data as RawLogEntry);

      if (!validated.valid) {
        state.stats.total_invalid++;
        continue;
      }
      state.stats.total_valid++;

      // Step 4: Send through output channel to enricher
      await output.send({ from: "validator", to: "enricher", data: validated });
      const enricherMsg = await output.receive();

      // Step 5: Enrich
      const enriched = await enricher.process(enricherMsg.data as any);
      state.stats.total_enriched++;

      // Step 6: Store
      state.logs.push(enriched);
      state.stats.total_stored++;
      state.stats.by_level[enriched.level] = (state.stats.by_level[enriched.level] || 0) + 1;
      state.stats.by_category[enriched.enrichments.category] =
        (state.stats.by_category[enriched.enrichments.category] || 0) + 1;
    }

    await store.set(state);

    return `Processed ${entries.length} entries: ${state.stats.total_valid} valid, ${state.stats.total_invalid} invalid, ${state.stats.total_stored} stored`;
  },
});

// ── Demo Runner ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═══ DATA PIPELINE — Fractal Code Example ═══\n");
  console.log("Demonstrates a realistic log processing pipeline using all four cell types.");
  console.log("Mix of .ts and .fc files proving format interoperability.\n");

  // Sample log data
  const logs: RawLogEntry[] = [
    { timestamp: "2026-02-16T10:00:00Z", level: "info", source: "api-gateway", message: "Request received from client 192.168.1.1" },
    { timestamp: "2026-02-16T10:00:01Z", level: "debug", source: "auth-service", message: "Auth token validated for user session" },
    { timestamp: "2026-02-16T10:00:02Z", level: "warn", source: "db-pool", message: "Connection pool nearing capacity: 45/50 active connections" },
    { timestamp: "2026-02-16T10:00:03Z", level: "error", source: "payment-service", message: "Timeout connecting to payment gateway after 30s" },
    { timestamp: "2026-02-16T10:00:04Z", level: "info", source: "deploy-agent", message: "Build v2.3.1 deployed to production cluster" },
    { timestamp: "2026-02-16T10:00:05Z", level: "fatal", source: "worker-3", message: "Out of memory exception — process crash detected on worker-3" },
    { timestamp: "2026-02-16T10:00:06Z", level: "error", source: "auth-service", message: "Permission denied for user attempting admin access" },
    { timestamp: "2026-02-16T10:00:07Z", level: "info", source: "cache-layer", message: "Cache hit ratio at 94.2% over last 5 minutes" },
    { timestamp: "invalid-date", level: "info", source: "test", message: "This entry has a bad timestamp" },
    { timestamp: "2026-02-16T10:00:09Z", level: "bogus", source: "test", message: "This entry has an invalid level" },
  ];

  console.log(`  Processing ${logs.length} log entries...\n`);

  // Run the pipeline
  const result = await app.process(logs);
  console.log(`  [Result] ${result}\n`);

  // Show stored data
  const state = await store.get();
  console.log("  ── Pipeline Statistics ──");
  console.log(`  Ingested:  ${state.stats.total_ingested}`);
  console.log(`  Valid:     ${state.stats.total_valid}`);
  console.log(`  Invalid:   ${state.stats.total_invalid}`);
  console.log(`  Enriched:  ${state.stats.total_enriched}`);
  console.log(`  Stored:    ${state.stats.total_stored}`);

  console.log("\n  ── By Level ──");
  for (const [level, count] of Object.entries(state.stats.by_level).sort()) {
    console.log(`  ${level.padEnd(8)} ${count}`);
  }

  console.log("\n  ── By Category ──");
  for (const [category, count] of Object.entries(state.stats.by_category).sort()) {
    console.log(`  ${category.padEnd(12)} ${count}`);
  }

  console.log("\n  ── Sample Enriched Logs ──");
  for (const log of state.logs.slice(0, 3)) {
    console.log(`  [${log.id}] ${log.level.toUpperCase().padEnd(6)} ${log.source.padEnd(16)} "${log.message.slice(0, 50)}..."`);
    console.log(`           severity: ${log.enrichments.severity_score}  category: ${log.enrichments.category}  words: ${log.enrichments.word_count}`);
  }

  // Show health with circuit breaker
  console.log("\n  ── Health Report ──");
  const health = app.health();
  console.log(`  Pipeline: ${health.status} (budget: ${health.budgetRemaining})`);
  if (health.children) {
    for (const [name, h] of Object.entries(health.children)) {
      const budget = h.budgetRemaining !== undefined ? ` budget: ${h.budgetRemaining}` : "";
      console.log(`    ${name.padEnd(12)} ${h.status}${h.message ? ` (${h.message})` : ""}${budget}`);
    }
  }

  // Print context map
  printContextMap(app);

  // Show signature chain
  console.log("═══ STRUCTURAL SIGNATURES ═══\n");
  console.log(`  Root: ${app.signature.hash.slice(0, 32)}...`);
  for (const child of app.getChildren()) {
    console.log(`    ${child.identity.name.padEnd(12)} ${child.signature.hash.slice(0, 32)}...`);
  }

  console.log("\n═══ INTENT LEDGER ═══\n");
  console.log(`  Root (data-pipeline):`);
  console.log(`    source:        ${app.lineage.source}`);
  console.log(`    trigger:       ${app.lineage.trigger}`);
  console.log(`    justification: ${app.lineage.justification}`);
  console.log("");
}

main().catch(console.error);
