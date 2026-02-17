import { writeFileSync, existsSync } from "fs";

export function initCommand(name: string): void {
  const filename = `${name}.transformer.fc`;

  if (existsSync(filename)) {
    console.error(`\u274C File ${filename} already exists`);
    process.exit(1);
  }

  const template = `# TODO: Rename this file to ${name}.<type>.fc
cell:
  identity:
    name: "${name}"             # TODO: Replace with your skill name
    version: "1.0.0"
    type: "Transformer"        # TODO: Transformer | Reactor | Keeper | Channel

  contract:
    input: "string"            # TODO: Define input type or reference a schema
    output: "string"           # TODO: Define output type or reference a schema
    circuit_breaker:
      complexity_budget: 100
      safe_mode_action: "halt"

  lineage:
    source: ""                 # TODO: Your agent ID (e.g., "Agent-Claude-Opus-4.6")
    trigger: ""                # TODO: Issue #, prompt ID, or decision record
    justification: ""          # TODO: One sentence explaining why this skill exists
    parent_context_hash: ""    # TODO: Merkle hash of parent context

  logic:
    lang: "typescript"
    process: |
      // TODO: Implement your skill logic here
      return input;

  signature: "TODO:COMPUTE"    # Run: npx fractalclaw sign -w ${name}.transformer.fc
`;

  writeFileSync(filename, template, "utf-8");

  console.log(`\u2705 Created ${filename}`);
  console.log();
  console.log("Next steps:");
  console.log(`  1. Edit the file \u2014 fill in identity, contract, lineage, and logic`);
  console.log(`  2. Seal it:  npx fractalclaw sign -w ${filename}`);
  console.log(`  3. Verify:   npx fractalclaw scan .`);
}
