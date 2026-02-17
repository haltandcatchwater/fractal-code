import { Keeper } from "@fractal-code/sdk";

/**
 * Store — Final destination for processed log data.
 * Maintains an array of enriched logs and aggregate pipeline statistics.
 *
 * This is the TypeScript bridge for store.keeper.fc — same cell, same contract.
 */

interface EnrichedLog {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  enrichments: {
    severity_score: number;
    category: string;
    processed_at: string;
    word_count: number;
  };
}

interface PipelineState {
  logs: EnrichedLog[];
  stats: {
    total_ingested: number;
    total_valid: number;
    total_invalid: number;
    total_enriched: number;
    total_stored: number;
    by_level: Record<string, number>;
    by_category: Record<string, number>;
  };
}

export const store = new Keeper<PipelineState>({
  name: "store",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: {
      type: "object",
      properties: {
        logs: { type: "array" },
        stats: { type: "object" },
      },
    },
    description: "Pipeline state including stored logs and aggregate statistics",
  },
  output: {
    schema: {
      type: "object",
      properties: {
        logs: { type: "array" },
        stats: { type: "object" },
      },
    },
    description: "Current pipeline state with all stored logs and stats",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "data-pipeline-example-v1",
    justification: "Persists processed logs and maintains aggregate pipeline statistics",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  initialState: {
    logs: [],
    stats: {
      total_ingested: 0,
      total_valid: 0,
      total_invalid: 0,
      total_enriched: 0,
      total_stored: 0,
      by_level: {},
      by_category: {},
    },
  },
});
