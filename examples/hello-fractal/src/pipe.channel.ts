import { Channel } from "@fractal-code/sdk";

/** A Channel that mediates communication between sibling cells. */
export const pipe = new Channel<{ from: string; to: string; data: unknown }>({
  name: "pipe",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, data: {} } },
    description: "A message envelope with sender, recipient, and payload",
  },
  output: {
    schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, data: {} } },
    description: "The same message envelope, delivered to the recipient",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "constitution-v1.0-step5",
    justification: "Mediates all sibling communication as required by Composition Rule 2",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  bufferSize: 50,
});
