import { describe, it, expect } from "vitest";
import { parseFC, ParseError } from "../parse";
import { validateCell } from "../validate";
import { isPrimitive, resolvePrimitive } from "../resolve-types";
import type { ParsedCell, ValidationResult } from "../types";

// ═══════════════════════════════════════════════════════════════════════
// Fixtures: valid .fc content for each cell type
// ═══════════════════════════════════════════════════════════════════════

const VALID_TRANSFORMER = `
cell:
  identity:
    name: "CurrencyConverter"
    version: "1.0.0"
    type: "Transformer"

  contract:
    input: "string"
    output: "number"
    circuit_breaker:
      complexity_budget: 1000
      safe_mode_action: "halt"

  lineage:
    source: "Agent-Claude-Opus-4.6"
    trigger: "Issue #12"
    justification: "Adding financial primitive to standard library."
    parent_context_hash: "0x7f8e9a1b2c3d4e5f"

  logic:
    lang: "typescript"
    process: |
      const rate = lookup(input.pair);
      return input.amount * rate;

  signature: "0xAB45CD78EF901234"
`;

const VALID_REACTOR = `
cell:
  identity:
    name: "PriceAlertMonitor"
    version: "1.0.0"
    type: "Reactor"

  contract:
    listens_to: "string"
    emits: "string"
    circuit_breaker:
      complexity_budget: 500
      safe_mode_action: "halt"

  lineage:
    source: "Agent-GPT-4o"
    trigger: "Issue #18"
    justification: "Monitor for threshold-breaking price changes."
    parent_context_hash: "0x3c2d1a4b5e6f"

  logic:
    lang: "typescript"
    on: |
      if (event.price > threshold) {
        emit({ symbol: event.symbol, price: event.price });
      }

  signature: "0xCD78EF12"
`;

const VALID_KEEPER = `
cell:
  identity:
    name: "SessionStore"
    version: "1.0.0"
    type: "Keeper"

  contract:
    state_schema: "object"
    operations:
      - "get"
      - "set"
      - "delete"
    circuit_breaker:
      complexity_budget: 2000
      safe_mode_action: "read_only"

  lineage:
    source: "Agent-Claude-Opus-4.6"
    trigger: "Issue #22"
    justification: "Session persistence for user authentication flow."
    parent_context_hash: "0x9b8a7c6d5e4f"

  logic:
    lang: "typescript"
    get: |
      return state[key] ?? null;
    set: |
      state[key] = value;
    delete: |
      delete state[key];

  signature: "0xEF123456"
`;

const VALID_CHANNEL = `
cell:
  identity:
    name: "RequestPipeline"
    version: "1.0.0"
    type: "Channel"

  contract:
    carries: "string"
    mode: "fifo"
    buffer_size: 100
    circuit_breaker:
      complexity_budget: 5000
      safe_mode_action: "drop_newest"

  lineage:
    source: "Human-Angelo"
    trigger: "Architecture-Decision-001"
    justification: "Primary request ingestion channel for API gateway."
    parent_context_hash: "0x1a2b3c4d5e6f"

  connects:
    from: "ApiGateway"
    to: "RequestHandler"

  signature: "0x56789ABC"
`;

const VALID_COMPOSED = `
cell:
  identity:
    name: "GreetingPipeline"
    version: "1.0.0"
    type: "Transformer"

  contract:
    input: "string"
    output: "string"
    circuit_breaker:
      complexity_budget: 100
      safe_mode_action: "halt"

  lineage:
    source: "Agent-Claude-Opus-4.6"
    trigger: "constitution-v1.0-step5"
    justification: "Root cell demonstrating fractal composition with all four cell types."
    parent_context_hash: "0000000000000000000000000000000000000000000000000000000000000000"

  children:
    - ref: "./request.reactor.fc"
      as: "request"
    - ref: "./pipe.channel.fc"
      as: "pipe"
    - ref: "./greeter.transformer.fc"
      as: "greeter"
    - ref: "./memory.keeper.fc"
      as: "memory"

  channels:
    - name: "pipe"
      topology:
        - from: "request"
          to: "greeter"
        - from: "greeter"
          to: "memory"

  logic:
    lang: "typescript"
    process: |
      const event = await request.on({ name: input });
      return await greeter.process(event.name);

  signature: "0x9A8B7C6D"
`;

// ═══════════════════════════════════════════════════════════════════════
// 1. YAML Parsing (parse.ts)
// ═══════════════════════════════════════════════════════════════════════

describe("parseFC", () => {
  it("parses a valid Transformer .fc file", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    expect(cell.identity.name).toBe("CurrencyConverter");
    expect(cell.identity.version).toBe("1.0.0");
    expect(cell.identity.type).toBe("Transformer");
  });

  it("parses a valid Reactor .fc file", () => {
    const cell = parseFC(VALID_REACTOR);
    expect(cell.identity.name).toBe("PriceAlertMonitor");
    expect(cell.identity.type).toBe("Reactor");
  });

  it("parses a valid Keeper .fc file", () => {
    const cell = parseFC(VALID_KEEPER);
    expect(cell.identity.name).toBe("SessionStore");
    expect(cell.identity.type).toBe("Keeper");
  });

  it("parses a valid Channel .fc file", () => {
    const cell = parseFC(VALID_CHANNEL);
    expect(cell.identity.name).toBe("RequestPipeline");
    expect(cell.identity.type).toBe("Channel");
  });

  it("extracts Transformer contract fields", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    const contract = cell.contract as any;
    expect(contract.input).toBe("string");
    expect(contract.output).toBe("number");
    expect(contract.circuit_breaker.complexity_budget).toBe(1000);
    expect(contract.circuit_breaker.safe_mode_action).toBe("halt");
  });

  it("extracts Reactor contract fields", () => {
    const cell = parseFC(VALID_REACTOR);
    const contract = cell.contract as any;
    expect(contract.listens_to).toBe("string");
    expect(contract.emits).toBe("string");
  });

  it("extracts Keeper contract fields", () => {
    const cell = parseFC(VALID_KEEPER);
    const contract = cell.contract as any;
    expect(contract.state_schema).toBe("object");
    expect(contract.operations).toEqual(["get", "set", "delete"]);
  });

  it("extracts Channel contract fields", () => {
    const cell = parseFC(VALID_CHANNEL);
    const contract = cell.contract as any;
    expect(contract.carries).toBe("string");
    expect(contract.mode).toBe("fifo");
    expect(contract.buffer_size).toBe(100);
  });

  it("extracts lineage (Intent Ledger)", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    expect(cell.lineage.source).toBe("Agent-Claude-Opus-4.6");
    expect(cell.lineage.trigger).toBe("Issue #12");
    expect(cell.lineage.justification).toBe("Adding financial primitive to standard library.");
    expect(cell.lineage.parent_context_hash).toBe("0x7f8e9a1b2c3d4e5f");
  });

  it("extracts logic with lang and method body", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    expect(cell.logic).not.toBeNull();
    expect(cell.logic!.lang).toBe("typescript");
    expect(cell.logic!.process).toContain("const rate = lookup(input.pair)");
  });

  it("extracts Keeper logic with multiple methods", () => {
    const cell = parseFC(VALID_KEEPER);
    expect(cell.logic!.get).toContain("return state[key]");
    expect(cell.logic!.set).toContain("state[key] = value");
    expect(cell.logic!.delete).toContain("delete state[key]");
  });

  it("extracts signature as a string", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    expect(cell.signature).toBe("0xAB45CD78EF901234");
  });

  it("extracts Channel connects", () => {
    const cell = parseFC(VALID_CHANNEL);
    expect(cell.connects).toBeDefined();
    expect(cell.connects!.from).toBe("ApiGateway");
    expect(cell.connects!.to).toBe("RequestHandler");
  });

  it("extracts children and channels for composed cells", () => {
    const cell = parseFC(VALID_COMPOSED);
    expect(cell.children).toHaveLength(4);
    expect(cell.children![0].ref).toBe("./request.reactor.fc");
    expect(cell.children![0].as).toBe("request");
    expect(cell.channels).toHaveLength(1);
    expect(cell.channels![0].name).toBe("pipe");
    expect(cell.channels![0].topology).toHaveLength(2);
  });

  it("throws ParseError for invalid YAML", () => {
    expect(() => parseFC(":::invalid:::yaml")).toThrow();
  });

  it("throws ParseError for missing root cell key", () => {
    expect(() => parseFC("notcell:\n  foo: bar")).toThrow("Missing root");
  });

  it("throws ParseError for empty content", () => {
    expect(() => parseFC("")).toThrow();
  });

  it("handles missing optional sections gracefully", () => {
    const minimal = `
cell:
  identity:
    name: "test"
    version: "1.0.0"
    type: "Channel"
  contract:
    carries: "string"
    mode: "fifo"
    buffer_size: 50
    circuit_breaker:
      complexity_budget: 100
      safe_mode_action: "drop_newest"
  lineage:
    source: "Agent-X"
    trigger: "Test"
    justification: "Testing minimal cell."
    parent_context_hash: "0xabc"
  signature: "0xdef"
`;
    const cell = parseFC(minimal);
    expect(cell.logic).toBeNull();
    expect(cell.children).toBeUndefined();
    expect(cell.channels).toBeUndefined();
    expect(cell.connects).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Identity Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — identity", () => {
  function parseAndValidate(yaml: string, filePath?: string): ValidationResult {
    const cell = parseFC(yaml);
    return validateCell(cell, filePath);
  }

  it("passes for a valid Transformer", () => {
    const result = parseAndValidate(VALID_TRANSFORMER);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("fails when identity.name is empty", () => {
    const yaml = VALID_TRANSFORMER.replace('"CurrencyConverter"', '""');
    const result = parseAndValidate(yaml);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.field === "identity.name")).toBe(true);
  });

  it("fails when identity.version is not semver", () => {
    const yaml = VALID_TRANSFORMER.replace('"1.0.0"', '"latest"');
    const result = parseAndValidate(yaml);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.field === "identity.version")).toBe(true);
  });

  it("accepts semver with pre-release", () => {
    const yaml = VALID_TRANSFORMER.replace('"1.0.0"', '"2.0.0-beta.1"');
    const result = parseAndValidate(yaml);
    const versionErrors = result.violations.filter((v) => v.field === "identity.version");
    expect(versionErrors).toHaveLength(0);
  });

  it("fails when identity.type is invalid", () => {
    const yaml = VALID_TRANSFORMER.replace('"Transformer"', '"Service"');
    const result = parseAndValidate(yaml);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.field === "identity.type")).toBe(true);
  });

  it("validates all four cell types", () => {
    expect(parseAndValidate(VALID_TRANSFORMER).valid).toBe(true);
    expect(parseAndValidate(VALID_REACTOR).valid).toBe(true);
    expect(parseAndValidate(VALID_KEEPER).valid).toBe(true);
    expect(parseAndValidate(VALID_CHANNEL).valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Contract Validation (type-specific)
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — contract", () => {
  function parseAndValidate(yaml: string): ValidationResult {
    return validateCell(parseFC(yaml));
  }

  it("fails when Transformer input is empty", () => {
    const yaml = VALID_TRANSFORMER.replace('input: "string"', 'input: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.input")).toBe(true);
  });

  it("fails when Transformer output is empty", () => {
    const yaml = VALID_TRANSFORMER.replace('output: "number"', 'output: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.output")).toBe(true);
  });

  it("fails when Reactor listens_to is empty", () => {
    const yaml = VALID_REACTOR.replace('listens_to: "string"', 'listens_to: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.listens_to")).toBe(true);
  });

  it("fails when Reactor emits is empty", () => {
    const yaml = VALID_REACTOR.replace('emits: "string"', 'emits: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.emits")).toBe(true);
  });

  it("fails when Keeper state_schema is empty", () => {
    const yaml = VALID_KEEPER.replace('state_schema: "object"', 'state_schema: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.state_schema")).toBe(true);
  });

  it("fails when Keeper operations missing get", () => {
    const yaml = VALID_KEEPER.replace('- "get"\n      - "set"', '- "set"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "contract.operations" && v.message.includes('"get"'),
    )).toBe(true);
  });

  it("fails when Keeper operations missing set", () => {
    const yaml = VALID_KEEPER.replace('- "get"\n      - "set"', '- "get"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "contract.operations" && v.message.includes('"set"'),
    )).toBe(true);
  });

  it("fails when Channel carries is empty", () => {
    const yaml = VALID_CHANNEL.replace('carries: "string"', 'carries: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.carries")).toBe(true);
  });

  it("fails when Channel mode is invalid", () => {
    const yaml = VALID_CHANNEL.replace('mode: "fifo"', 'mode: "random"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.mode")).toBe(true);
  });

  it("fails when Channel buffer_size is zero", () => {
    const yaml = VALID_CHANNEL.replace("buffer_size: 100", "buffer_size: 0");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.buffer_size")).toBe(true);
  });

  it("fails when Channel buffer_size is negative", () => {
    const yaml = VALID_CHANNEL.replace("buffer_size: 100", "buffer_size: -5");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "contract.buffer_size")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Circuit Breaker Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — circuit breaker", () => {
  function parseAndValidate(yaml: string): ValidationResult {
    return validateCell(parseFC(yaml));
  }

  it("passes with correct safe_mode_action for each type", () => {
    expect(parseAndValidate(VALID_TRANSFORMER).valid).toBe(true);
    expect(parseAndValidate(VALID_REACTOR).valid).toBe(true);
    expect(parseAndValidate(VALID_KEEPER).valid).toBe(true);
    expect(parseAndValidate(VALID_CHANNEL).valid).toBe(true);
  });

  it("fails when complexity_budget is zero", () => {
    const yaml = VALID_TRANSFORMER.replace("complexity_budget: 1000", "complexity_budget: 0");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "contract.circuit_breaker.complexity_budget",
    )).toBe(true);
  });

  it("fails when complexity_budget is negative", () => {
    const yaml = VALID_TRANSFORMER.replace("complexity_budget: 1000", "complexity_budget: -10");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "contract.circuit_breaker.complexity_budget",
    )).toBe(true);
  });

  it("fails when Transformer safe_mode_action is not halt", () => {
    const yaml = VALID_TRANSFORMER.replace('safe_mode_action: "halt"', 'safe_mode_action: "read_only"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "contract.circuit_breaker.safe_mode_action" && v.message.includes('"halt"'),
    )).toBe(true);
  });

  it("fails when Keeper safe_mode_action is not read_only", () => {
    const yaml = VALID_KEEPER.replace('safe_mode_action: "read_only"', 'safe_mode_action: "halt"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "contract.circuit_breaker.safe_mode_action" && v.message.includes('"read_only"'),
    )).toBe(true);
  });

  it("fails when Channel safe_mode_action is not drop_newest", () => {
    const yaml = VALID_CHANNEL.replace('safe_mode_action: "drop_newest"', 'safe_mode_action: "halt"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "contract.circuit_breaker.safe_mode_action" && v.message.includes('"drop_newest"'),
    )).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Lineage (Intent Ledger) Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — lineage", () => {
  function parseAndValidate(yaml: string): ValidationResult {
    return validateCell(parseFC(yaml));
  }

  it("passes with complete lineage", () => {
    const result = parseAndValidate(VALID_TRANSFORMER);
    const lineageViolations = result.violations.filter((v) => v.field.startsWith("lineage"));
    expect(lineageViolations).toHaveLength(0);
  });

  it("fails when source is empty", () => {
    const yaml = VALID_TRANSFORMER.replace('source: "Agent-Claude-Opus-4.6"', 'source: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "lineage.source")).toBe(true);
  });

  it("fails when trigger is empty", () => {
    const yaml = VALID_TRANSFORMER.replace('trigger: "Issue #12"', 'trigger: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "lineage.trigger")).toBe(true);
  });

  it("fails when justification is empty", () => {
    const yaml = VALID_TRANSFORMER.replace(
      'justification: "Adding financial primitive to standard library."',
      'justification: ""',
    );
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "lineage.justification")).toBe(true);
  });

  it("fails when parent_context_hash is empty", () => {
    const yaml = VALID_TRANSFORMER.replace(
      'parent_context_hash: "0x7f8e9a1b2c3d4e5f"',
      'parent_context_hash: ""',
    );
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "lineage.parent_context_hash")).toBe(true);
  });

  it("fails when source is whitespace only", () => {
    const yaml = VALID_TRANSFORMER.replace('source: "Agent-Claude-Opus-4.6"', 'source: "   "');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "lineage.source")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Logic Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — logic", () => {
  function parseAndValidate(yaml: string): ValidationResult {
    return validateCell(parseFC(yaml));
  }

  it("passes for Transformer with process method", () => {
    const result = parseAndValidate(VALID_TRANSFORMER);
    const logicViolations = result.violations.filter((v) => v.field.startsWith("logic"));
    expect(logicViolations).toHaveLength(0);
  });

  it("passes for Reactor with on method", () => {
    const result = parseAndValidate(VALID_REACTOR);
    const logicViolations = result.violations.filter((v) => v.field.startsWith("logic"));
    expect(logicViolations).toHaveLength(0);
  });

  it("passes for Keeper with get and set methods", () => {
    const result = parseAndValidate(VALID_KEEPER);
    const logicViolations = result.violations.filter((v) => v.field.startsWith("logic"));
    expect(logicViolations).toHaveLength(0);
  });

  it("passes for Channel without logic section", () => {
    const result = parseAndValidate(VALID_CHANNEL);
    const logicViolations = result.violations.filter((v) => v.field.startsWith("logic"));
    expect(logicViolations).toHaveLength(0);
  });

  it("fails when Transformer missing process method", () => {
    const yaml = VALID_TRANSFORMER.replace("process: |", "not_process: |");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "logic.process")).toBe(true);
  });

  it("fails when Reactor missing on method", () => {
    const yaml = VALID_REACTOR.replace("on: |", "not_on: |");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "logic.on")).toBe(true);
  });

  it("fails when Keeper missing get method", () => {
    const yaml = VALID_KEEPER.replace("get: |", "fetch: |");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "logic.get")).toBe(true);
  });

  it("fails when Keeper missing set method", () => {
    const yaml = VALID_KEEPER.replace("set: |", "put: |");
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "logic.set")).toBe(true);
  });

  it("fails when logic.lang is empty", () => {
    const yaml = VALID_TRANSFORMER.replace('lang: "typescript"', 'lang: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "logic.lang")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Signature Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — signature", () => {
  function parseAndValidate(yaml: string): ValidationResult {
    return validateCell(parseFC(yaml));
  }

  it("passes with a non-empty signature", () => {
    const result = parseAndValidate(VALID_TRANSFORMER);
    const sigViolations = result.violations.filter((v) => v.field === "signature");
    expect(sigViolations).toHaveLength(0);
  });

  it("fails when signature is empty", () => {
    const yaml = VALID_TRANSFORMER.replace('signature: "0xAB45CD78EF901234"', 'signature: ""');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field === "signature")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. Composition Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — composition", () => {
  function parseAndValidate(yaml: string): ValidationResult {
    return validateCell(parseFC(yaml));
  }

  it("passes for a valid composed cell", () => {
    const result = parseAndValidate(VALID_COMPOSED);
    expect(result.valid).toBe(true);
  });

  it("fails when child is missing ref", () => {
    const yaml = VALID_COMPOSED.replace(
      '- ref: "./request.reactor.fc"\n      as: "request"',
      '- ref: ""\n      as: "request"',
    );
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field.includes("children") && v.message.includes("ref"))).toBe(true);
  });

  it("fails when child is missing as", () => {
    const yaml = VALID_COMPOSED.replace(
      '- ref: "./request.reactor.fc"\n      as: "request"',
      '- ref: "./request.reactor.fc"\n      as: ""',
    );
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) => v.field.includes("children") && v.message.includes("as"))).toBe(true);
  });

  it("fails when 2+ non-channel children have no channel declared", () => {
    const yaml = `
cell:
  identity:
    name: "NoChannel"
    version: "1.0.0"
    type: "Transformer"
  contract:
    input: "string"
    output: "string"
    circuit_breaker:
      complexity_budget: 100
      safe_mode_action: "halt"
  lineage:
    source: "Agent-X"
    trigger: "Test"
    justification: "Testing composition without channel."
    parent_context_hash: "0xabc"
  children:
    - ref: "./a.transformer.fc"
      as: "a"
    - ref: "./b.reactor.fc"
      as: "b"
  logic:
    lang: "typescript"
    process: |
      return "test";
  signature: "0xdef"
`;
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.field === "channels" && v.message.includes("Principle III"),
    )).toBe(true);
  });

  it("passes when single non-channel child (no sibling communication needed)", () => {
    const yaml = `
cell:
  identity:
    name: "SingleChild"
    version: "1.0.0"
    type: "Transformer"
  contract:
    input: "string"
    output: "string"
    circuit_breaker:
      complexity_budget: 100
      safe_mode_action: "halt"
  lineage:
    source: "Agent-X"
    trigger: "Test"
    justification: "Testing single child composition."
    parent_context_hash: "0xabc"
  children:
    - ref: "./child.transformer.fc"
      as: "child"
  logic:
    lang: "typescript"
    process: |
      return "test";
  signature: "0xdef"
`;
    const result = parseAndValidate(yaml);
    const channelViolations = result.violations.filter((v) => v.field === "channels");
    expect(channelViolations).toHaveLength(0);
  });

  it("fails when channel topology references unknown alias", () => {
    const yaml = VALID_COMPOSED.replace('from: "request"', 'from: "unknown"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.message.includes('"unknown"') && v.message.includes("does not match"),
    )).toBe(true);
  });

  it("fails when channel name doesn't match any child alias", () => {
    const yaml = VALID_COMPOSED.replace('name: "pipe"', 'name: "nonexistent"');
    const result = parseAndValidate(yaml);
    expect(result.violations.some((v) =>
      v.message.includes('"nonexistent"') && v.message.includes("does not match"),
    )).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. Type Reference Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — type references", () => {
  it("passes when all types are built-in primitives", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    const result = validateCell(cell, undefined, new Set());
    // "string" and "number" are primitives, so should pass
    const typeViolations = result.violations.filter(
      (v) => v.message.includes("does not resolve"),
    );
    expect(typeViolations).toHaveLength(0);
  });

  it("fails when named type is not found in known types", () => {
    const yaml = VALID_TRANSFORMER.replace('input: "string"', 'input: "UnknownType"');
    const cell = parseFC(yaml);
    const result = validateCell(cell, undefined, new Set(["OtherType"]));
    expect(result.violations.some((v) =>
      v.message.includes('"UnknownType"') && v.message.includes("does not resolve"),
    )).toBe(true);
  });

  it("passes when named type exists in known types set", () => {
    const yaml = VALID_TRANSFORMER.replace('input: "string"', 'input: "CurrencyRequest"');
    const cell = parseFC(yaml);
    const result = validateCell(cell, undefined, new Set(["CurrencyRequest"]));
    const typeViolations = result.violations.filter(
      (v) => v.message.includes("does not resolve"),
    );
    expect(typeViolations).toHaveLength(0);
  });

  it("skips type validation when no known types provided", () => {
    const yaml = VALID_TRANSFORMER.replace('input: "string"', 'input: "MaybeExists"');
    const cell = parseFC(yaml);
    const result = validateCell(cell); // no knownTypes argument
    const typeViolations = result.violations.filter(
      (v) => v.message.includes("does not resolve"),
    );
    expect(typeViolations).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. File Naming Validation
// ═══════════════════════════════════════════════════════════════════════

describe("validateCell — file naming", () => {
  it("passes when filename matches cell type", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    const result = validateCell(cell, "src/currency-converter.transformer.fc");
    const nameViolations = result.violations.filter((v) => v.field === "filename");
    expect(nameViolations).toHaveLength(0);
  });

  it("fails when filename type doesn't match declared type", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    const result = validateCell(cell, "src/converter.reactor.fc");
    expect(result.violations.some((v) =>
      v.field === "filename" && v.message.includes("reactor"),
    )).toBe(true);
  });

  it("warns about non-standard filename format", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    const result = validateCell(cell, "src/converter.fc");
    expect(result.violations.some((v) =>
      v.field === "filename" && v.message.includes("convention"),
    )).toBe(true);
  });

  it("skips validation when no filePath provided", () => {
    const cell = parseFC(VALID_TRANSFORMER);
    const result = validateCell(cell);
    const nameViolations = result.violations.filter((v) => v.field === "filename");
    expect(nameViolations).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 11. Type Resolution (resolve-types.ts)
// ═══════════════════════════════════════════════════════════════════════

describe("type resolution", () => {
  it("recognizes all built-in primitives", () => {
    const primitives = ["string", "number", "boolean", "object", "array", "any", "void"];
    for (const p of primitives) {
      expect(isPrimitive(p)).toBe(true);
    }
  });

  it("isPrimitive is case-insensitive", () => {
    expect(isPrimitive("String")).toBe(true);
    expect(isPrimitive("NUMBER")).toBe(true);
    expect(isPrimitive("Boolean")).toBe(true);
  });

  it("rejects non-primitives", () => {
    expect(isPrimitive("CurrencyRequest")).toBe(false);
    expect(isPrimitive("SessionState")).toBe(false);
    expect(isPrimitive("")).toBe(false);
  });

  it("resolvePrimitive returns JSON Schema for primitives", () => {
    expect(resolvePrimitive("string")).toEqual({ type: "string" });
    expect(resolvePrimitive("number")).toEqual({ type: "number" });
    expect(resolvePrimitive("boolean")).toEqual({ type: "boolean" });
    expect(resolvePrimitive("any")).toEqual({});
    expect(resolvePrimitive("void")).toEqual({ type: "null" });
  });

  it("resolvePrimitive returns null for non-primitives", () => {
    expect(resolvePrimitive("FooBar")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 12. Integration: all checks combined
// ═══════════════════════════════════════════════════════════════════════

describe("integration — full validation", () => {
  it("all four cell type examples pass all checks", () => {
    const examples = [VALID_TRANSFORMER, VALID_REACTOR, VALID_KEEPER, VALID_CHANNEL];
    for (const yaml of examples) {
      const cell = parseFC(yaml);
      const result = validateCell(cell);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    }
  });

  it("composed cell passes all checks", () => {
    const cell = parseFC(VALID_COMPOSED);
    const result = validateCell(cell);
    expect(result.valid).toBe(true);
  });

  it("completely broken cell reports many violations", () => {
    const yaml = `
cell:
  identity:
    name: ""
    version: "nope"
    type: "Widget"
  contract:
    input: ""
    output: ""
  lineage:
    source: ""
    trigger: ""
    justification: ""
    parent_context_hash: ""
  logic:
    lang: ""
  signature: ""
`;
    const cell = parseFC(yaml);
    const result = validateCell(cell);
    expect(result.valid).toBe(false);
    // Should have violations from identity, contract, lineage, logic, signature
    expect(result.violations.length).toBeGreaterThan(5);
  });
});
