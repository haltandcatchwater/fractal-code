import { Channel } from "@fractal-code/sdk";

/**
 * Connects the validator to the enricher.
 * Carries validated log entries in FIFO order.
 */

export const pipeline = new Channel<{ from: string; to: string; data: unknown }>({
  name: "pipeline",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, data: {} } },
    description: "Message envelope carrying validated logs from validator to enricher",
  },
  output: {
    schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, data: {} } },
    description: "Same envelope delivered to the enricher",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "data-pipeline-example-v1",
    justification: "Mediates communication between validator and enricher per Composition Rule 2",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  bufferSize: 500,
});
