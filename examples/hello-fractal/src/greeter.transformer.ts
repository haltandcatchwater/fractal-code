import { Transformer } from "@fractal-code/sdk";

/** A simple Transformer that converts a name into a greeting. Stateless. */
export const greeter = new Transformer<string, string>({
  name: "greeter",
  version: "1.0.0",
  parent: "app",
  input: {
    schema: { type: "string" },
    description: "A name to greet",
  },
  output: {
    schema: { type: "string" },
    description: "A greeting message",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "constitution-v1.0-step5",
    justification: "Provides stateless greeting transformation for the hello-fractal demo pipeline",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  complexityBudget: 100,
  process: async (name: string) => `Hello, ${name}! Welcome to Fractal Code.`,
});
