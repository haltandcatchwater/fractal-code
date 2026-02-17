import { Channel } from "@fractal-code/sdk";

/**
 * Connects the enricher to the store.
 * Carries enriched log entries in FIFO order for persistence.
 */

export const output = new Channel<{ from: string; to: string; data: unknown }>({
  name: "output",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, data: {} } },
    description: "Message envelope carrying enriched logs from enricher to store",
  },
  output: {
    schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, data: {} } },
    description: "Same envelope delivered to the store",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "data-pipeline-example-v1",
    justification: "Mediates communication between enricher and store per Composition Rule 2",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  bufferSize: 500,
});
