import { Reactor } from "@fractal-code/sdk";

interface GreetingRequest {
  name: string;
  timestamp: string;
}

interface GreetingEvent {
  accepted: boolean;
  name: string;
}

/** A Reactor that listens for greeting request events and acknowledges them. */
export const request = new Reactor<GreetingRequest, GreetingEvent>({
  name: "request",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: { type: "object", properties: { name: { type: "string" }, timestamp: { type: "string" } } },
    description: "A greeting request with a name and timestamp",
  },
  output: {
    schema: { type: "object", properties: { accepted: { type: "boolean" }, name: { type: "string" } } },
    description: "An acknowledgment indicating the request was accepted",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "constitution-v1.0-step5",
    justification: "Handles incoming greeting events as the entry point Reactor for the demo pipeline",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  complexityBudget: 100,
  listensTo: ["greeting-request"],
  on: async (event: GreetingRequest) => {
    console.log(`  [Reactor] Received greeting request for: ${event.name}`);
    return { accepted: true, name: event.name };
  },
});
