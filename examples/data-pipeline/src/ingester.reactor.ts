import { Reactor } from "@fractal-code/sdk";

/**
 * Ingester — Entry point of the data pipeline.
 * Listens for raw log events and passes them through after basic structural check.
 *
 * This is the TypeScript bridge for ingester.reactor.fc — same cell, same contract.
 */

interface RawLogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const ingester = new Reactor<RawLogEntry, RawLogEntry>({
  name: "ingester",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: {
      type: "object",
      properties: {
        timestamp: { type: "string" },
        level: { type: "string" },
        source: { type: "string" },
        message: { type: "string" },
      },
    },
    description: "A raw log entry event to ingest into the pipeline",
  },
  output: {
    schema: {
      type: "object",
      properties: {
        timestamp: { type: "string" },
        level: { type: "string" },
        source: { type: "string" },
        message: { type: "string" },
      },
    },
    description: "The same log entry, acknowledged and ready for processing",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "data-pipeline-example-v1",
    justification: "Entry point reactor that ingests raw log events into the pipeline",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  complexityBudget: 10000,
  listensTo: ["log-event"],
  on: async (event: RawLogEntry): Promise<RawLogEntry> => {
    if (!event.timestamp || !event.level || !event.source || !event.message) {
      throw new Error("Malformed log entry: missing required fields");
    }
    return event;
  },
});
