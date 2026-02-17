import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Contract types & validation ───────────────────────────────────────
import {
  CELL_TYPES,
  DEFAULT_COMPLEXITY_BUDGET,
  validateIdentity,
  validateInput,
  validateOutput,
  validateLineage,
  validateSignature,
  validateContract,
} from "../contract";
import type {
  CellIdentity,
  CellInput,
  CellOutput,
  CellLineage,
  CellSignature,
  CellHealth,
  ContextMapEntry,
  UniversalContract,
} from "../contract";

// ── Signature utilities ───────────────────────────────────────────────
import {
  computeLeafSignature,
  computeComposedSignature,
  verifySignature,
} from "../signature";

// ── Cell classes ──────────────────────────────────────────────────────
import { Transformer } from "../transformer";
import { Reactor } from "../reactor";
import { Keeper } from "../keeper";
import { Channel } from "../channel";

// ── Index utilities ───────────────────────────────────────────────────
import { buildContextMap, printContextMap } from "../index";

// ════════════════════════════════════════════════════════════════════════
// Helpers: reusable valid fixtures
// ════════════════════════════════════════════════════════════════════════

function validLineage(): CellLineage {
  return {
    source: "Claude-Opus-4.6",
    trigger: "Issue-42",
    justification: "Provides deterministic hashing for cells.",
    signature: "a".repeat(64),
  };
}

function validInput(): CellInput {
  return { schema: { type: "string" }, description: "Raw text input" };
}

function validOutput(): CellOutput {
  return { schema: { type: "number" }, description: "Numeric result" };
}

function makeTransformer(
  overrides: Partial<{
    name: string;
    version: string;
    process: (x: any) => Promise<any>;
    children: UniversalContract[];
    complexityBudget: number;
    parent: string;
  }> = {},
) {
  return new Transformer({
    name: overrides.name ?? "test-transformer",
    version: overrides.version ?? "1.0.0",
    input: validInput(),
    output: validOutput(),
    lineage: validLineage(),
    process: overrides.process ?? (async (x: number) => x * 2),
    children: overrides.children,
    complexityBudget: overrides.complexityBudget,
    parent: overrides.parent,
  });
}

function makeReactor(
  overrides: Partial<{
    name: string;
    version: string;
    on: (e: any) => Promise<any>;
    listensTo: string[];
    children: UniversalContract[];
    complexityBudget: number;
    parent: string;
  }> = {},
) {
  return new Reactor({
    name: overrides.name ?? "test-reactor",
    version: overrides.version ?? "1.0.0",
    input: validInput(),
    output: validOutput(),
    lineage: validLineage(),
    on: overrides.on ?? (async (e: string) => `handled: ${e}`),
    listensTo: overrides.listensTo ?? ["click", "submit"],
    children: overrides.children,
    complexityBudget: overrides.complexityBudget,
    parent: overrides.parent,
  });
}

function makeKeeper<T>(
  initialState: T,
  overrides: Partial<{
    name: string;
    version: string;
    children: UniversalContract[];
    parent: string;
  }> = {},
) {
  return new Keeper<T>({
    name: overrides.name ?? "test-keeper",
    version: overrides.version ?? "1.0.0",
    input: validInput(),
    output: validOutput(),
    lineage: validLineage(),
    initialState,
    children: overrides.children,
    parent: overrides.parent,
  });
}

function makeChannel<T>(
  overrides: Partial<{
    name: string;
    version: string;
    bufferSize: number;
    children: UniversalContract[];
    parent: string;
  }> = {},
) {
  return new Channel<T>({
    name: overrides.name ?? "test-channel",
    version: overrides.version ?? "1.0.0",
    input: validInput(),
    output: validOutput(),
    lineage: validLineage(),
    bufferSize: overrides.bufferSize,
    children: overrides.children,
    parent: overrides.parent,
  });
}

// ════════════════════════════════════════════════════════════════════════
// 1. Contract Validation
// ════════════════════════════════════════════════════════════════════════

describe("Contract Validation", () => {
  // ── validateIdentity ───────────────────────────────────────────────
  describe("validateIdentity", () => {
    it("returns no errors for a valid identity", () => {
      const id: CellIdentity = { name: "foo", cellType: "transformer", version: "1.0.0" };
      expect(validateIdentity(id)).toEqual([]);
    });

    it("rejects empty name", () => {
      const id: CellIdentity = { name: "", cellType: "transformer", version: "1.0.0" };
      const errors = validateIdentity(id);
      expect(errors).toContain("identity.name is required");
    });

    it("rejects whitespace-only name", () => {
      const id: CellIdentity = { name: "   ", cellType: "transformer", version: "1.0.0" };
      const errors = validateIdentity(id);
      expect(errors).toContain("identity.name is required");
    });

    it("rejects invalid cellType", () => {
      const id = { name: "foo", cellType: "widget" as any, version: "1.0.0" };
      const errors = validateIdentity(id);
      expect(errors.some((e) => e.includes("cellType must be one of"))).toBe(true);
    });

    it("accepts all four valid cell types", () => {
      for (const ct of CELL_TYPES) {
        const id: CellIdentity = { name: "x", cellType: ct, version: "2.0.0" };
        expect(validateIdentity(id)).toEqual([]);
      }
    });

    it("rejects non-semver version", () => {
      const id: CellIdentity = { name: "foo", cellType: "keeper", version: "latest" };
      expect(validateIdentity(id)).toContain("identity.version must be a semver string");
    });

    it("rejects missing version", () => {
      const id = { name: "foo", cellType: "keeper", version: "" } as CellIdentity;
      expect(validateIdentity(id)).toContain("identity.version must be a semver string");
    });

    it("accepts semver with pre-release suffix", () => {
      const id: CellIdentity = { name: "foo", cellType: "channel", version: "1.2.3-beta.1" };
      expect(validateIdentity(id)).toEqual([]);
    });
  });

  // ── validateInput ──────────────────────────────────────────────────
  describe("validateInput", () => {
    it("returns no errors for a valid input", () => {
      expect(validateInput(validInput())).toEqual([]);
    });

    it("rejects missing schema (null-ish)", () => {
      const errors = validateInput({ schema: null as any, description: "ok" });
      expect(errors).toContain("input.schema is required");
    });

    it("rejects empty description", () => {
      const errors = validateInput({ schema: { type: "string" }, description: "" });
      expect(errors).toContain("input.description is required");
    });

    it("rejects whitespace-only description", () => {
      const errors = validateInput({ schema: { type: "string" }, description: "   " });
      expect(errors).toContain("input.description is required");
    });
  });

  // ── validateOutput ─────────────────────────────────────────────────
  describe("validateOutput", () => {
    it("returns no errors for a valid output", () => {
      expect(validateOutput(validOutput())).toEqual([]);
    });

    it("rejects missing schema", () => {
      const errors = validateOutput({ schema: undefined as any, description: "ok" });
      expect(errors).toContain("output.schema is required");
    });

    it("rejects empty description", () => {
      const errors = validateOutput({ schema: {}, description: "" });
      expect(errors).toContain("output.description is required");
    });
  });

  // ── validateLineage (Intent Ledger) ────────────────────────────────
  describe("validateLineage (Intent Ledger)", () => {
    it("returns no errors for a valid lineage", () => {
      expect(validateLineage(validLineage())).toEqual([]);
    });

    it("rejects missing source", () => {
      const l = { ...validLineage(), source: "" };
      expect(validateLineage(l)).toContain("lineage.source is required (Agent ID)");
    });

    it("rejects whitespace-only source", () => {
      const l = { ...validLineage(), source: "   " };
      expect(validateLineage(l)).toContain("lineage.source is required (Agent ID)");
    });

    it("rejects missing trigger", () => {
      const l = { ...validLineage(), trigger: "" };
      expect(validateLineage(l)).toContain("lineage.trigger is required (Prompt ID, Issue #, or Decision Record)");
    });

    it("rejects missing justification", () => {
      const l = { ...validLineage(), justification: "" };
      expect(validateLineage(l)).toContain("lineage.justification is required (one sentence of structural necessity)");
    });

    it("rejects missing signature", () => {
      const l = { ...validLineage(), signature: "" };
      expect(validateLineage(l)).toContain("lineage.signature is required (Merkle hash of parent context at creation)");
    });

    it("returns multiple errors when several fields are invalid", () => {
      const l = { source: "", trigger: "", justification: "", signature: "" };
      const errors = validateLineage(l);
      expect(errors).toHaveLength(4);
    });
  });

  // ── validateSignature ──────────────────────────────────────────────
  describe("validateSignature", () => {
    it("returns no errors for a valid CellSignature", () => {
      const sig: CellSignature = { hash: "a".repeat(64), timestamp: new Date().toISOString() };
      expect(validateSignature(sig)).toEqual([]);
    });

    it("rejects hash shorter than 64 hex chars", () => {
      const sig: CellSignature = { hash: "abc123", timestamp: "2026-01-01T00:00:00Z" };
      expect(validateSignature(sig)).toContain("signature.hash must be a 64-char hex string");
    });

    it("rejects hash with uppercase hex", () => {
      const sig: CellSignature = { hash: "A".repeat(64), timestamp: "2026-01-01T00:00:00Z" };
      expect(validateSignature(sig)).toContain("signature.hash must be a 64-char hex string");
    });

    it("rejects hash with non-hex characters", () => {
      const sig: CellSignature = { hash: "g".repeat(64), timestamp: "2026-01-01T00:00:00Z" };
      expect(validateSignature(sig)).toContain("signature.hash must be a 64-char hex string");
    });

    it("rejects missing timestamp", () => {
      const sig = { hash: "0".repeat(64), timestamp: "" } as CellSignature;
      expect(validateSignature(sig)).toContain("signature.timestamp is required");
    });
  });

  // ── validateContract ───────────────────────────────────────────────
  describe("validateContract", () => {
    it("returns no errors for a fully valid cell", () => {
      const t = makeTransformer();
      expect(validateContract(t)).toEqual([]);
    });

    it("aggregates errors from all sub-validators", () => {
      // Create a cell with deliberately broken fields
      const t = makeTransformer();
      // Overwrite identity to be invalid
      (t as any).identity = { name: "", cellType: "bogus", version: "nope" };
      (t as any).input = { schema: null, description: "" };
      (t as any).output = { schema: null, description: "" };
      (t as any).lineage = { source: "", trigger: "", justification: "", signature: "" };
      (t as any).signature = { hash: "short", timestamp: "" };

      const errors = validateContract(t);
      // Should have errors from every category
      expect(errors.length).toBeGreaterThan(5);
      expect(errors.some((e) => e.includes("identity"))).toBe(true);
      expect(errors.some((e) => e.includes("input"))).toBe(true);
      expect(errors.some((e) => e.includes("output"))).toBe(true);
      expect(errors.some((e) => e.includes("lineage"))).toBe(true);
      expect(errors.some((e) => e.includes("signature"))).toBe(true);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// 2. Structural Signature
// ════════════════════════════════════════════════════════════════════════

describe("Structural Signature", () => {
  describe("computeLeafSignature", () => {
    it("returns a 64-char lowercase hex hash", () => {
      const t = makeTransformer();
      const sig = computeLeafSignature(t);
      expect(sig.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns a valid ISO timestamp", () => {
      const t = makeTransformer();
      const sig = computeLeafSignature(t);
      expect(() => new Date(sig.timestamp)).not.toThrow();
      expect(new Date(sig.timestamp).toISOString()).toBe(sig.timestamp);
    });

    it("is deterministic (same cell -> same hash)", () => {
      const t = makeTransformer();
      const sig1 = computeLeafSignature(t);
      const sig2 = computeLeafSignature(t);
      expect(sig1.hash).toBe(sig2.hash);
    });

    it("changes when the cell name changes", () => {
      const t1 = makeTransformer({ name: "alpha" });
      const t2 = makeTransformer({ name: "bravo" });
      expect(t1.signature.hash).not.toBe(t2.signature.hash);
    });

    it("changes when the cell version changes", () => {
      const t1 = makeTransformer({ version: "1.0.0" });
      const t2 = makeTransformer({ version: "2.0.0" });
      expect(t1.signature.hash).not.toBe(t2.signature.hash);
    });

    it("changes when the input schema changes", () => {
      const t1 = makeTransformer();
      const t2 = new Transformer({
        name: "test-transformer",
        version: "1.0.0",
        input: { schema: { type: "object", properties: { x: { type: "number" } } }, description: "Raw text input" },
        output: validOutput(),
        lineage: validLineage(),
        process: async (x: number) => x * 2,
      });
      expect(t1.signature.hash).not.toBe(t2.signature.hash);
    });

    it("changes when lineage source changes", () => {
      const lineageA = { ...validLineage(), source: "Agent-A" };
      const lineageB = { ...validLineage(), source: "Agent-B" };
      const t1 = new Transformer({
        name: "t",
        version: "1.0.0",
        input: validInput(),
        output: validOutput(),
        lineage: lineageA,
        process: async (x: number) => x,
      });
      const t2 = new Transformer({
        name: "t",
        version: "1.0.0",
        input: validInput(),
        output: validOutput(),
        lineage: lineageB,
        process: async (x: number) => x,
      });
      expect(t1.signature.hash).not.toBe(t2.signature.hash);
    });

    it("does not include children array for leaf", () => {
      const t = makeTransformer();
      expect(t.signature.children).toBeUndefined();
    });
  });

  describe("computeComposedSignature", () => {
    it("includes sorted child hashes", () => {
      const childA = makeKeeper(0, { name: "child-a" });
      const childB = makeChannel<string>({ name: "child-b" });
      const parent = makeTransformer({ name: "parent", children: [childA, childB] });

      expect(parent.signature.children).toBeDefined();
      expect(parent.signature.children!.length).toBe(2);
      // Sorted lexicographically
      const sorted = [...parent.signature.children!].sort();
      expect(parent.signature.children).toEqual(sorted);
    });

    it("composed hash differs from leaf hash of the same cell", () => {
      const child = makeKeeper(0, { name: "child" });
      const parentWithChild = makeTransformer({ name: "p", children: [child] });
      const parentWithout = makeTransformer({ name: "p" });
      expect(parentWithChild.signature.hash).not.toBe(parentWithout.signature.hash);
    });

    it("hash changes when a child changes", () => {
      const childV1 = makeKeeper(0, { name: "child", version: "1.0.0" });
      const childV2 = makeKeeper(0, { name: "child", version: "2.0.0" });
      const p1 = makeTransformer({ name: "p", children: [childV1] });
      const p2 = makeTransformer({ name: "p", children: [childV2] });
      expect(p1.signature.hash).not.toBe(p2.signature.hash);
    });

    it("order of children does not matter (sorted)", () => {
      const a = makeKeeper(0, { name: "aaa" });
      const b = makeChannel<string>({ name: "bbb" });
      const p1 = makeTransformer({ name: "p", children: [a, b] });
      const p2 = makeTransformer({ name: "p", children: [b, a] });
      expect(p1.signature.hash).toBe(p2.signature.hash);
    });
  });

  describe("verifySignature", () => {
    it("returns true for a freshly created leaf cell", () => {
      const t = makeTransformer();
      expect(verifySignature(t)).toBe(true);
    });

    it("returns true for a freshly created composed cell", () => {
      const child = makeKeeper(42, { name: "state" });
      const parent = makeTransformer({ name: "root", children: [child] });
      expect(verifySignature(parent, [child.signature])).toBe(true);
    });

    it("returns false when the hash has been tampered with", () => {
      const t = makeTransformer();
      t.signature = { ...t.signature, hash: "f".repeat(64) };
      expect(verifySignature(t)).toBe(false);
    });

    it("returns false when a child signature has been tampered with", () => {
      const child = makeKeeper(42, { name: "state" });
      const parent = makeTransformer({ name: "root", children: [child] });
      const tamperedChild: CellSignature = { ...child.signature, hash: "0".repeat(64) };
      expect(verifySignature(parent, [tamperedChild])).toBe(false);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// 3. Transformer
// ════════════════════════════════════════════════════════════════════════

describe("Transformer", () => {
  describe("creation", () => {
    it("sets cellType to 'transformer'", () => {
      const t = makeTransformer();
      expect(t.identity.cellType).toBe("transformer");
    });

    it("stores name and version from config", () => {
      const t = makeTransformer({ name: "doubler", version: "3.1.0" });
      expect(t.identity.name).toBe("doubler");
      expect(t.identity.version).toBe("3.1.0");
    });

    it("computes a valid signature on construction", () => {
      const t = makeTransformer();
      expect(t.signature.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(t.signature.timestamp).toBeTruthy();
    });

    it("passes validateContract with no errors", () => {
      const t = makeTransformer();
      expect(validateContract(t)).toEqual([]);
    });
  });

  describe("process()", () => {
    it("executes the provided function", async () => {
      const t = makeTransformer({ process: async (x: number) => x + 10 });
      const result = await t.process(5);
      expect(result).toBe(15);
    });

    it("passes input through correctly", async () => {
      const t = makeTransformer({
        process: async (input: { a: number; b: number }) => input.a + input.b,
      });
      const result = await t.process({ a: 3, b: 7 });
      expect(result).toBe(10);
    });
  });

  describe("circuit breaker", () => {
    it("starts with the configured complexity budget", () => {
      const t = makeTransformer({ complexityBudget: 5 });
      expect(t.budgetRemaining).toBe(5);
    });

    it("defaults to DEFAULT_COMPLEXITY_BUDGET when not specified", () => {
      const t = makeTransformer();
      expect(t.budgetRemaining).toBe(DEFAULT_COMPLEXITY_BUDGET);
    });

    it("decrements budget on each process() call", async () => {
      const t = makeTransformer({ complexityBudget: 3 });
      await t.process(1);
      expect(t.budgetRemaining).toBe(2);
      await t.process(1);
      expect(t.budgetRemaining).toBe(1);
    });

    it("enters safe-mode and throws when budget reaches zero", async () => {
      const t = makeTransformer({ complexityBudget: 1 });
      await t.process(1); // budget now 0
      await expect(t.process(1)).rejects.toThrow("Safe-Mode");
      await expect(t.process(1)).rejects.toThrow(t.identity.name);
    });

    it("resetBudget() restores the budget to its initial value", async () => {
      const t = makeTransformer({ complexityBudget: 2 });
      await t.process(1);
      await t.process(1);
      expect(t.budgetRemaining).toBe(0);
      t.resetBudget();
      expect(t.budgetRemaining).toBe(2);
      // Can process again after reset
      const result = await t.process(42);
      expect(result).toBe(84); // 42 * 2 from default process
    });
  });

  describe("health()", () => {
    it("returns 'healthy' when budget is positive and no children", () => {
      const t = makeTransformer({ complexityBudget: 10 });
      const h = t.health();
      expect(h.status).toBe("healthy");
      expect(h.budgetRemaining).toBe(10);
    });

    it("returns 'safe-mode' when budget is exhausted", async () => {
      const t = makeTransformer({ complexityBudget: 1 });
      await t.process(1);
      const h = t.health();
      expect(h.status).toBe("safe-mode");
      expect(h.budgetRemaining).toBe(0);
    });

    it("does not include children key for leaf transformer", () => {
      const t = makeTransformer();
      expect(t.health().children).toBeUndefined();
    });

    it("reports child health when children exist", () => {
      const child = makeKeeper(0, { name: "my-state" });
      const t = makeTransformer({ children: [child] });
      const h = t.health();
      expect(h.children).toBeDefined();
      expect(h.children!["my-state"]).toBeDefined();
      expect(h.children!["my-state"].status).toBe("healthy");
    });

    it("propagates 'safe-mode' from parent even with healthy children", async () => {
      const child = makeKeeper(0, { name: "s" });
      const t = makeTransformer({ complexityBudget: 1, children: [child] });
      await t.process(1);
      expect(t.health().status).toBe("safe-mode");
    });

    it("degrades to 'degraded' when a child is in safe-mode", async () => {
      const childReactor = makeReactor({ name: "r", complexityBudget: 1 });
      await childReactor.on("evt"); // exhaust child budget
      const parent = makeTransformer({ children: [childReactor], complexityBudget: 100 });
      const h = parent.health();
      expect(h.status).toBe("degraded");
    });
  });

  describe("toMap()", () => {
    it("returns a ContextMapEntry with correct identity", () => {
      const t = makeTransformer({ name: "m", version: "1.2.3" });
      const map = t.toMap();
      expect(map.identity.name).toBe("m");
      expect(map.identity.cellType).toBe("transformer");
      expect(map.identity.version).toBe("1.2.3");
    });

    it("lists children names", () => {
      const c1 = makeKeeper(0, { name: "k1" });
      const c2 = makeChannel<string>({ name: "ch1" });
      const t = makeTransformer({ children: [c1, c2] });
      const map = t.toMap();
      expect(map.children).toContain("k1");
      expect(map.children).toContain("ch1");
    });

    it("lists channels (children with cellType=channel)", () => {
      const k = makeKeeper(0, { name: "k" });
      const ch = makeChannel<string>({ name: "ch" });
      const t = makeTransformer({ children: [k, ch] });
      const map = t.toMap();
      expect(map.channels).toEqual(["ch"]);
    });

    it("includes parent when configured", () => {
      const t = makeTransformer({ parent: "root" });
      expect(t.toMap().parent).toBe("root");
    });

    it("parent is undefined when not configured", () => {
      const t = makeTransformer();
      expect(t.toMap().parent).toBeUndefined();
    });

    it("includes signature hash", () => {
      const t = makeTransformer();
      expect(t.toMap().signature).toBe(t.signature.hash);
    });
  });

  describe("getChildren()", () => {
    it("returns empty array when no children", () => {
      const t = makeTransformer();
      expect(t.getChildren()).toEqual([]);
    });

    it("returns the children array", () => {
      const k = makeKeeper(0, { name: "k" });
      const t = makeTransformer({ children: [k] });
      expect(t.getChildren()).toHaveLength(1);
      expect(t.getChildren()[0].identity.name).toBe("k");
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// 4. Reactor
// ════════════════════════════════════════════════════════════════════════

describe("Reactor", () => {
  describe("creation", () => {
    it("sets cellType to 'reactor'", () => {
      const r = makeReactor();
      expect(r.identity.cellType).toBe("reactor");
    });

    it("passes validateContract", () => {
      expect(validateContract(makeReactor())).toEqual([]);
    });
  });

  describe("on()", () => {
    it("invokes the handler and returns its result", async () => {
      const r = makeReactor({
        on: async (e: string) => e.toUpperCase(),
      });
      expect(await r.on("hello")).toBe("HELLO");
    });
  });

  describe("listensTo()", () => {
    it("returns the configured event names", () => {
      const r = makeReactor({ listensTo: ["pageLoad", "resize"] });
      expect(r.listensTo()).toEqual(["pageLoad", "resize"]);
    });

    it("returns empty array when empty", () => {
      const r = makeReactor({ listensTo: [] });
      expect(r.listensTo()).toEqual([]);
    });
  });

  describe("circuit breaker", () => {
    it("decrements budget on on() calls", async () => {
      const r = makeReactor({ complexityBudget: 3 });
      await r.on("e1");
      expect(r.budgetRemaining).toBe(2);
    });

    it("throws when budget is exhausted", async () => {
      const r = makeReactor({ complexityBudget: 1 });
      await r.on("e1");
      await expect(r.on("e2")).rejects.toThrow("Safe-Mode");
      await expect(r.on("e2")).rejects.toThrow(r.identity.name);
    });

    it("resetBudget() restores the budget", async () => {
      const r = makeReactor({ complexityBudget: 1 });
      await r.on("e1");
      r.resetBudget();
      expect(r.budgetRemaining).toBe(1);
      // No throw
      await expect(r.on("e2")).resolves.toBeDefined();
    });
  });

  describe("health()", () => {
    it("returns healthy with budget", () => {
      const r = makeReactor({ complexityBudget: 5 });
      expect(r.health().status).toBe("healthy");
      expect(r.health().budgetRemaining).toBe(5);
    });

    it("returns safe-mode when exhausted", async () => {
      const r = makeReactor({ complexityBudget: 1 });
      await r.on("x");
      expect(r.health().status).toBe("safe-mode");
    });

    it("reports child health", () => {
      const child = makeKeeper(0, { name: "ck" });
      const r = makeReactor({ children: [child] });
      expect(r.health().children).toBeDefined();
      expect(r.health().children!["ck"].status).toBe("healthy");
    });
  });

  describe("toMap() and getChildren()", () => {
    it("toMap includes correct identity", () => {
      const r = makeReactor({ name: "event-handler" });
      expect(r.toMap().identity.name).toBe("event-handler");
      expect(r.toMap().identity.cellType).toBe("reactor");
    });

    it("getChildren returns children", () => {
      const ch = makeChannel<string>({ name: "pipe" });
      const r = makeReactor({ children: [ch] });
      expect(r.getChildren()).toHaveLength(1);
    });

    it("toMap lists channels from children", () => {
      const ch = makeChannel<number>({ name: "data-pipe" });
      const k = makeKeeper(0, { name: "state" });
      const r = makeReactor({ children: [ch, k] });
      expect(r.toMap().channels).toEqual(["data-pipe"]);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// 5. Keeper
// ════════════════════════════════════════════════════════════════════════

describe("Keeper", () => {
  describe("creation", () => {
    it("sets cellType to 'keeper'", () => {
      const k = makeKeeper(0);
      expect(k.identity.cellType).toBe("keeper");
    });

    it("passes validateContract", () => {
      expect(validateContract(makeKeeper("hello"))).toEqual([]);
    });
  });

  describe("get() / set()", () => {
    it("get() returns the initial state", async () => {
      const k = makeKeeper(42);
      expect(await k.get()).toBe(42);
    });

    it("set() updates the state", async () => {
      const k = makeKeeper<number>(0);
      await k.set(99);
      expect(await k.get()).toBe(99);
    });

    it("works with complex state objects", async () => {
      const k = makeKeeper<{ count: number; items: string[] }>({
        count: 0,
        items: [],
      });
      await k.set({ count: 3, items: ["a", "b", "c"] });
      const state = await k.get();
      expect(state.count).toBe(3);
      expect(state.items).toEqual(["a", "b", "c"]);
    });

    it("set() followed by get() reflects latest value", async () => {
      const k = makeKeeper<string>("initial");
      await k.set("updated");
      await k.set("final");
      expect(await k.get()).toBe("final");
    });
  });

  describe("health()", () => {
    it("returns 'healthy' for a leaf keeper", () => {
      const k = makeKeeper(0);
      expect(k.health().status).toBe("healthy");
    });

    it("does not include budgetRemaining (keepers have no budget)", () => {
      const k = makeKeeper(0);
      expect(k.health().budgetRemaining).toBeUndefined();
    });

    it("includes child health when children exist", () => {
      const child = makeChannel<string>({ name: "ch" });
      const k = makeKeeper(0, { children: [child] });
      expect(k.health().children).toBeDefined();
      expect(k.health().children!["ch"]).toBeDefined();
    });

    it("degrades when a child is degraded", () => {
      // Create a channel that is > 90% full to trigger degraded
      const ch = makeChannel<number>({ name: "full-chan", bufferSize: 2 });
      // Fill buffer to > 90%
      ch.send(1);
      ch.send(2); // 2/2 = 100% > 90%
      const k = makeKeeper(0, { children: [ch] });
      expect(k.health().status).toBe("degraded");
    });
  });

  describe("toMap() and getChildren()", () => {
    it("toMap returns correct identity", () => {
      const k = makeKeeper(0, { name: "cache" });
      expect(k.toMap().identity.name).toBe("cache");
      expect(k.toMap().identity.cellType).toBe("keeper");
    });

    it("getChildren returns children", () => {
      const child = makeKeeper("nested", { name: "nested" });
      const k = makeKeeper(0, { children: [child] });
      expect(k.getChildren()).toHaveLength(1);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// 6. Channel
// ════════════════════════════════════════════════════════════════════════

describe("Channel", () => {
  describe("creation", () => {
    it("sets cellType to 'channel'", () => {
      const ch = makeChannel();
      expect(ch.identity.cellType).toBe("channel");
    });

    it("passes validateContract", () => {
      expect(validateContract(makeChannel())).toEqual([]);
    });

    it("starts with empty buffer", () => {
      const ch = makeChannel();
      expect(ch.length).toBe(0);
    });

    it("defaults buffer size to 100", () => {
      const ch = makeChannel<string>();
      // Fill 100 items; 101st should fail
      const promises = Array.from({ length: 100 }, (_, i) => ch.send(`msg-${i}`));
      expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe("send() / receive()", () => {
    it("send adds to buffer and receive removes in FIFO order", async () => {
      const ch = makeChannel<string>();
      await ch.send("first");
      await ch.send("second");
      expect(ch.length).toBe(2);
      expect(await ch.receive()).toBe("first");
      expect(await ch.receive()).toBe("second");
      expect(ch.length).toBe(0);
    });

    it("send throws when buffer is full", async () => {
      const ch = makeChannel<number>({ bufferSize: 2 });
      await ch.send(1);
      await ch.send(2);
      await expect(ch.send(3)).rejects.toThrow("buffer full");
      await expect(ch.send(3)).rejects.toThrow(ch.identity.name);
    });

    it("receive throws when buffer is empty", async () => {
      const ch = makeChannel<number>();
      await expect(ch.receive()).rejects.toThrow("buffer empty");
      await expect(ch.receive()).rejects.toThrow(ch.identity.name);
    });

    it("can send again after receiving (frees space)", async () => {
      const ch = makeChannel<number>({ bufferSize: 1 });
      await ch.send(1);
      await ch.receive();
      await expect(ch.send(2)).resolves.toBeUndefined();
      expect(await ch.receive()).toBe(2);
    });
  });

  describe("peek()", () => {
    it("returns undefined on empty buffer", () => {
      const ch = makeChannel<string>();
      expect(ch.peek()).toBeUndefined();
    });

    it("returns the front element without removing it", async () => {
      const ch = makeChannel<string>();
      await ch.send("alpha");
      await ch.send("beta");
      expect(ch.peek()).toBe("alpha");
      expect(ch.length).toBe(2); // Not consumed
    });
  });

  describe("length", () => {
    it("tracks the number of items in the buffer", async () => {
      const ch = makeChannel<number>();
      expect(ch.length).toBe(0);
      await ch.send(1);
      expect(ch.length).toBe(1);
      await ch.send(2);
      expect(ch.length).toBe(2);
      await ch.receive();
      expect(ch.length).toBe(1);
    });
  });

  describe("health()", () => {
    it("returns 'healthy' when utilization is <= 90%", () => {
      const ch = makeChannel<number>({ bufferSize: 10 });
      const h = ch.health();
      expect(h.status).toBe("healthy");
      expect(h.message).toContain("0/10");
    });

    it("returns 'degraded' when utilization > 90%", async () => {
      const ch = makeChannel<number>({ bufferSize: 10 });
      // Send 10 items -> 100% utilization
      for (let i = 0; i < 10; i++) await ch.send(i);
      const h = ch.health();
      expect(h.status).toBe("degraded");
      expect(h.message).toContain("10/10");
    });

    it("reports buffer utilization in message", async () => {
      const ch = makeChannel<number>({ bufferSize: 5 });
      await ch.send(1);
      await ch.send(2);
      expect(ch.health().message).toBe("Buffer: 2/5");
    });

    it("includes child health when children exist", () => {
      const child = makeKeeper(0, { name: "sub" });
      const ch = makeChannel<number>({ children: [child] });
      expect(ch.health().children).toBeDefined();
      expect(ch.health().children!["sub"].status).toBe("healthy");
    });

    it("degrades when children are degraded even if buffer is fine", async () => {
      // Create a degraded child (a nearly-full channel)
      const innerCh = makeChannel<number>({ name: "inner", bufferSize: 2 });
      await innerCh.send(1);
      await innerCh.send(2); // 100% > 90% -> degraded

      const outerCh = makeChannel<string>({ name: "outer", bufferSize: 100, children: [innerCh] });
      expect(outerCh.health().status).toBe("degraded");
    });
  });

  describe("toMap() and getChildren()", () => {
    it("toMap has correct cellType", () => {
      const ch = makeChannel({ name: "pipe" });
      expect(ch.toMap().identity.cellType).toBe("channel");
    });

    it("getChildren returns children", () => {
      const child = makeKeeper(0, { name: "nested" });
      const ch = makeChannel({ children: [child] });
      expect(ch.getChildren()).toHaveLength(1);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// 7. Composition
// ════════════════════════════════════════════════════════════════════════

describe("Composition", () => {
  it("parent with children produces a composed signature", () => {
    const keeper = makeKeeper({ items: [] }, { name: "state-store" });
    const channel = makeChannel<string>({ name: "data-pipe" });
    const parent = makeTransformer({
      name: "orchestrator",
      children: [keeper, channel],
    });

    expect(parent.signature.children).toBeDefined();
    expect(parent.signature.children).toHaveLength(2);
    expect(parent.signature.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("composed cell looks identical to a simple cell from the outside (same contract shape)", () => {
    const leaf = makeTransformer({ name: "leaf" });
    const keeper = makeKeeper(0, { name: "k" });
    const composed = makeTransformer({ name: "composed", children: [keeper] });

    // Both implement the same contract fields
    expect(leaf.identity).toBeDefined();
    expect(composed.identity).toBeDefined();
    expect(leaf.input).toBeDefined();
    expect(composed.input).toBeDefined();
    expect(leaf.output).toBeDefined();
    expect(composed.output).toBeDefined();
    expect(leaf.lineage).toBeDefined();
    expect(composed.lineage).toBeDefined();
    expect(leaf.signature).toBeDefined();
    expect(composed.signature).toBeDefined();
    expect(typeof leaf.health).toBe("function");
    expect(typeof composed.health).toBe("function");
    expect(typeof leaf.toMap).toBe("function");
    expect(typeof composed.toMap).toBe("function");
  });

  it("context map entry lists children and channels separately", () => {
    const k = makeKeeper(0, { name: "cache" });
    const ch = makeChannel<string>({ name: "bus" });
    const r = makeReactor({ name: "handler" });
    const parent = makeTransformer({
      name: "root",
      children: [k, ch, r],
    });

    const map = parent.toMap();
    expect(map.children).toEqual(expect.arrayContaining(["cache", "bus", "handler"]));
    expect(map.channels).toEqual(["bus"]); // Only channels
  });

  it("deep nesting: grandchild health propagates to root", async () => {
    const grandchild = makeReactor({ name: "gc", complexityBudget: 1 });
    await grandchild.on("x"); // exhaust budget -> safe-mode

    const child = makeTransformer({ name: "child", children: [grandchild], complexityBudget: 100 });
    const root = makeTransformer({ name: "root", children: [child], complexityBudget: 100 });

    const h = root.health();
    expect(h.status).toBe("degraded"); // child is degraded because grandchild is safe-mode
    expect(h.children!["child"].status).toBe("degraded");
    expect(h.children!["child"].children!["gc"].status).toBe("safe-mode");
  });
});

// ════════════════════════════════════════════════════════════════════════
// 8. buildContextMap / printContextMap
// ════════════════════════════════════════════════════════════════════════

describe("buildContextMap / printContextMap", () => {
  describe("buildContextMap", () => {
    it("returns a single entry for a leaf cell", () => {
      const t = makeTransformer({ name: "solo" });
      const map = buildContextMap(t);
      expect(map).toHaveLength(1);
      expect(map[0].identity.name).toBe("solo");
    });

    it("traverses the full hierarchy depth-first", () => {
      const grandchild = makeKeeper(0, { name: "gc", parent: "child" });
      const child = makeTransformer({ name: "child", children: [grandchild], parent: "root" });
      const root = makeTransformer({ name: "root", children: [child] });

      const map = buildContextMap(root);
      expect(map).toHaveLength(3);
      expect(map[0].identity.name).toBe("root");
      expect(map[1].identity.name).toBe("child");
      expect(map[2].identity.name).toBe("gc");
    });

    it("includes all four cell types in a mixed hierarchy", () => {
      const k = makeKeeper(0, { name: "state" });
      const ch = makeChannel<string>({ name: "pipe" });
      const r = makeReactor({ name: "listener" });
      const root = makeTransformer({ name: "root", children: [k, ch, r] });

      const map = buildContextMap(root);
      expect(map).toHaveLength(4);
      const types = map.map((e) => e.identity.cellType);
      expect(types).toContain("transformer");
      expect(types).toContain("keeper");
      expect(types).toContain("channel");
      expect(types).toContain("reactor");
    });

    it("each entry has a valid signature hash", () => {
      const child = makeKeeper(0, { name: "k" });
      const root = makeTransformer({ name: "root", children: [child] });
      const map = buildContextMap(root);
      for (const entry of map) {
        expect(entry.signature).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  });

  describe("printContextMap", () => {
    it("calls console.log and prints the hierarchy", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const child = makeChannel<string>({ name: "bus", parent: "root" });
      const root = makeTransformer({ name: "root", children: [child] });

      printContextMap(root);

      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("FRACTAL CODE CONTEXT MAP");
      expect(output).toContain("root");
      expect(output).toContain("bus");
      expect(output).toContain("TRANSFORMER");
      expect(output).toContain("CHANNEL");
      expect(output).toContain("(root)");
      expect(output).toContain("sig:");

      spy.mockRestore();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// 9. Cross-cutting: DEFAULT_COMPLEXITY_BUDGET and CELL_TYPES constants
// ════════════════════════════════════════════════════════════════════════

describe("Exported constants", () => {
  it("CELL_TYPES contains exactly four types", () => {
    expect(CELL_TYPES).toEqual(["transformer", "reactor", "keeper", "channel"]);
  });

  it("DEFAULT_COMPLEXITY_BUDGET is 1000", () => {
    expect(DEFAULT_COMPLEXITY_BUDGET).toBe(1000);
  });
});
