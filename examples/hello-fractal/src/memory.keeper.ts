import { Keeper } from "@fractal-code/sdk";

interface GreetingHistory {
  greetings: Array<{ name: string; message: string; timestamp: string }>;
}

/** A Keeper that stores the history of all greetings produced. */
export const memory = new Keeper<GreetingHistory>({
  name: "memory",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: { type: "object", properties: { greetings: { type: "array" } } },
    description: "Greeting history state to persist",
  },
  output: {
    schema: { type: "object", properties: { greetings: { type: "array" } } },
    description: "The current greeting history",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "constitution-v1.0-step5",
    justification: "Maintains greeting history state to demonstrate the Keeper cell pattern",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  initialState: { greetings: [] },
});
