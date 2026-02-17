import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import type {
  DiscoveredCell,
  CellIdentity,
  CellInput,
  CellOutput,
  CellLineage,
  CellType,
} from "../types/cell";
import { cellTypeCheck } from "../checks/cell-type-check";
import { contractCheck } from "../checks/contract-check";
import { compositionCheck } from "../checks/composition-check";
import { selfSimilarityCheck } from "../checks/self-similarity-check";
import { contextMapCheck } from "../checks/context-map-check";
import { signatureCheck } from "../checks/signature-check";
import { circuitBreakerCheck } from "../checks/circuit-breaker-check";
import { lineageCheck } from "../checks/lineage-check";

// ── Hash Helper ──────────────────────────────────────────────────────────
// Mirrors the recomputeHash algorithm from signature-check.ts exactly.

function computeHash(cell: DiscoveredCell): string {
  const ownContent =
    cell.identity.name +
    cell.identity.cellType +
    cell.identity.version +
    JSON.stringify(cell.input.schema) +
    JSON.stringify(cell.output.schema) +
    (cell.lineage?.source ?? "") +
    (cell.lineage?.trigger ?? "") +
    (cell.lineage?.justification ?? "");

  if (cell.children.length === 0) {
    return createHash("sha256").update(ownContent, "utf8").digest("hex");
  }

  const sortedChildHashes = cell.children.map((c) => c.signature.hash).sort();
  const content = ownContent + sortedChildHashes.join("");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ── Factory ──────────────────────────────────────────────────────────────
// Builds a fully valid leaf DiscoveredCell. Individual tests override fields
// to trigger specific violations.

function makeCell(overrides?: Partial<DiscoveredCell>): DiscoveredCell {
  const identity: CellIdentity = {
    name: "test-cell",
    cellType: "transformer",
    version: "1.0.0",
  };

  const input: CellInput = {
    schema: { type: "object", properties: { data: { type: "string" } } },
    description: "Accepts a data string for transformation",
  };

  const output: CellOutput = {
    schema: { type: "object", properties: { result: { type: "string" } } },
    description: "Returns the transformed result",
  };

  const lineage: CellLineage = {
    source: "Claude-Opus-4.6",
    trigger: "Issue #1 — initial cell creation",
    justification: "Root transformer needed to process incoming data",
    signature: "abc123parenthash",
  };

  // Build a temporary cell to compute hash
  const tempCell: DiscoveredCell = {
    filePath: "src/test-cell.transformer.ts",
    identity,
    input,
    output,
    lineage,
    signature: { hash: "", timestamp: "2026-02-16T00:00:00Z" },
    contextMap: {
      identity,
      signature: "",
      children: [],
      channels: [],
    },
    children: [],
    hasHealthMethod: true,
    hasToMapMethod: true,
    healthReport: {
      status: "healthy",
      budgetRemaining: 100,
    },
    ...overrides,
  };

  // Compute the correct hash for leaf cells (only if no overrides touched signature)
  if (!overrides?.signature) {
    const hash = computeHash(tempCell);
    tempCell.signature = {
      hash,
      timestamp: "2026-02-16T00:00:00Z",
    };
    tempCell.contextMap.signature = hash;
  }

  return tempCell;
}

/**
 * Build a composed cell with children. Children are leaf cells by default.
 * The parent signature incorporates child hashes as the real algorithm does.
 */
function makeComposedCell(
  childOverrides?: Partial<DiscoveredCell>[],
  parentOverrides?: Partial<DiscoveredCell>,
): DiscoveredCell {
  // Build children first
  const child1 = makeCell({
    filePath: "src/child-a.transformer.ts",
    identity: { name: "child-a", cellType: "transformer", version: "1.0.0" },
    ...(childOverrides?.[0] ?? {}),
  });
  const child2 = makeCell({
    filePath: "src/child-b.reactor.ts",
    identity: { name: "child-b", cellType: "reactor", version: "1.0.0" },
    ...(childOverrides?.[1] ?? {}),
  });
  const channel = makeCell({
    filePath: "src/data-bus.channel.ts",
    identity: { name: "data-bus", cellType: "channel", version: "1.0.0" },
    ...(childOverrides?.[2] ?? {}),
  });

  const children = [child1, child2, channel];

  const parentIdentity: CellIdentity = {
    name: "parent-cell",
    cellType: "transformer",
    version: "1.0.0",
  };

  const parentInput: CellInput = {
    schema: { type: "object", properties: { data: { type: "string" } } },
    description: "Composed interface accepting data",
  };

  const parentOutput: CellOutput = {
    schema: { type: "object", properties: { result: { type: "string" } } },
    description: "Composed interface returning result",
  };

  const parentLineage: CellLineage = {
    source: "Claude-Opus-4.6",
    trigger: "Issue #2 — composed cell",
    justification: "Orchestrates child cells for multi-step processing",
    signature: "def456parenthash",
  };

  // Build temporary parent to compute hash
  const sortedChildHashes = children.map((c) => c.signature.hash).sort();

  const tempParent: DiscoveredCell = {
    filePath: "src/parent-cell.transformer.ts",
    identity: parentIdentity,
    input: parentInput,
    output: parentOutput,
    lineage: parentLineage,
    signature: { hash: "", children: sortedChildHashes, timestamp: "2026-02-16T00:00:00Z" },
    contextMap: {
      identity: parentIdentity,
      signature: "",
      children: ["child-a", "child-b", "data-bus"],
      channels: ["data-bus"],
    },
    children,
    hasHealthMethod: true,
    hasToMapMethod: true,
    healthReport: {
      status: "healthy",
      budgetRemaining: 100,
    },
    ...parentOverrides,
  };

  // Compute parent hash incorporating children
  if (!parentOverrides?.signature) {
    const hash = computeHash(tempParent);
    tempParent.signature = {
      hash,
      children: sortedChildHashes,
      timestamp: "2026-02-16T00:00:00Z",
    };
    tempParent.contextMap.signature = hash;
  }

  return tempParent;
}

// =========================================================================
// 1. cellTypeCheck
// =========================================================================
describe("cellTypeCheck", () => {
  it("passes for all four valid cell types", () => {
    const types: CellType[] = ["transformer", "reactor", "keeper", "channel"];
    const cells = types.map((t) =>
      makeCell({
        identity: { name: `my-${t}`, cellType: t, version: "1.0.0" },
        filePath: `src/my-${t}.${t}.ts`,
      }),
    );

    const result = cellTypeCheck(cells);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.checkName).toBe("Cell Type Check");
  });

  it("fails when cellType is invalid", () => {
    const cell = makeCell({
      filePath: "src/bad-cell.ts",
      identity: { name: "bad-cell", cellType: "service" as any, version: "1.0.0" },
    });

    const result = cellTypeCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain('Invalid cellType "service"');
    expect(result.violations[0].principle).toBe("I");
  });

  it("warns when file name type does not match declared cellType", () => {
    const cell = makeCell({
      filePath: "src/parser.reactor.ts",
      identity: { name: "parser", cellType: "transformer", version: "1.0.0" },
    });

    const result = cellTypeCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain('File name suggests type "reactor"');
    expect(result.violations[0].message).toContain('cell declares type "transformer"');
  });

  it("skips file naming check for app.* and index.* files", () => {
    const appCell = makeCell({ filePath: "src/app.ts" });
    const indexCell = makeCell({ filePath: "src/index.ts" });

    const result = cellTypeCheck([appCell, indexCell]);
    expect(result.passed).toBe(true);
  });

  it("passes when file naming matches declared type", () => {
    const cell = makeCell({
      filePath: "src/parser.transformer.ts",
      identity: { name: "parser", cellType: "transformer", version: "1.0.0" },
    });

    const result = cellTypeCheck([cell]);
    expect(result.passed).toBe(true);
  });

  it("recurses into children", () => {
    const child = makeCell({
      identity: { name: "bad-child", cellType: "widget" as any, version: "1.0.0" },
    });
    const parent = makeCell();
    parent.children = [child];

    const result = cellTypeCheck([parent]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.cell === "bad-child")).toBe(true);
  });
});

// =========================================================================
// 2. contractCheck
// =========================================================================
describe("contractCheck", () => {
  it("passes for a complete contract", () => {
    const cell = makeCell();
    const result = contractCheck([cell]);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe("Contract Check");
  });

  it("fails when identity.name is missing", () => {
    const cell = makeCell({
      identity: { name: "", cellType: "transformer", version: "1.0.0" },
    });

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing identity.name")).toBe(true);
  });

  it("fails when identity.version is not semver", () => {
    const cell = makeCell({
      identity: { name: "test", cellType: "transformer", version: "latest" },
    });

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Invalid identity.version"))).toBe(true);
  });

  it("fails when input is missing", () => {
    const cell = makeCell();
    (cell as any).input = undefined;

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing input declaration")).toBe(true);
  });

  it("fails when input.schema is missing", () => {
    const cell = makeCell();
    (cell.input as any).schema = undefined;

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing input.schema")).toBe(true);
  });

  it("fails when input.description is empty", () => {
    const cell = makeCell();
    cell.input.description = "   ";

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing input.description")).toBe(true);
  });

  it("fails when output is missing", () => {
    const cell = makeCell();
    (cell as any).output = undefined;

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing output declaration")).toBe(true);
  });

  it("fails when output.schema is missing", () => {
    const cell = makeCell();
    (cell.output as any).schema = undefined;

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing output.schema")).toBe(true);
  });

  it("fails when output.description is empty", () => {
    const cell = makeCell();
    cell.output.description = "";

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing output.description")).toBe(true);
  });

  it("fails when health method is missing", () => {
    const cell = makeCell({ hasHealthMethod: false });

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing health() method")).toBe(true);
  });

  it("fails when lineage is missing", () => {
    const cell = makeCell();
    (cell as any).lineage = undefined;

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Missing lineage"))).toBe(true);
  });

  it("fails when signature is missing", () => {
    const cell = makeCell();
    (cell as any).signature = undefined;

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing signature")).toBe(true);
  });

  it("fails when signature.hash is not valid hex", () => {
    const cell = makeCell();
    cell.signature = { hash: "not-a-hash", timestamp: "2026-02-16T00:00:00Z" };

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Invalid signature.hash"))).toBe(true);
  });

  it("fails when signature.timestamp is missing", () => {
    const cell = makeCell();
    cell.signature.timestamp = "";

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing signature.timestamp")).toBe(true);
  });

  it("reports all violations at once for a completely broken cell", () => {
    const cell: DiscoveredCell = {
      filePath: "src/broken.ts",
      identity: { name: "", cellType: "transformer", version: "nope" },
      input: { schema: undefined as any, description: "" },
      output: { schema: undefined as any, description: "" },
      lineage: undefined as any,
      signature: undefined as any,
      contextMap: { identity: { name: "", cellType: "transformer", version: "" }, signature: "" },
      children: [],
      hasHealthMethod: false,
      hasToMapMethod: false,
    };

    const result = contractCheck([cell]);
    expect(result.passed).toBe(false);
    // Should have violations for: name, version, input.schema, input.description,
    // output.schema, output.description, health, lineage, signature
    expect(result.violations.length).toBeGreaterThanOrEqual(7);
  });

  it("recurses into children", () => {
    const child = makeCell({
      identity: { name: "", cellType: "transformer", version: "1.0.0" },
    });
    const parent = makeCell();
    parent.children = [child];

    const result = contractCheck([parent]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing identity.name")).toBe(true);
  });
});

// =========================================================================
// 3. compositionCheck
// =========================================================================
describe("compositionCheck", () => {
  it("passes when siblings communicate through a channel", () => {
    const composed = makeComposedCell();

    const result = compositionCheck([composed]);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe("Composition Check");
  });

  it("fails when multiple non-channel siblings exist without a channel", () => {
    const child1 = makeCell({
      identity: { name: "child-a", cellType: "transformer", version: "1.0.0" },
    });
    const child2 = makeCell({
      identity: { name: "child-b", cellType: "reactor", version: "1.0.0" },
    });

    const parent = makeCell();
    parent.children = [child1, child2];
    parent.contextMap.children = ["child-a", "child-b"];

    const result = compositionCheck([parent]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("no Channel to mediate communication");
    expect(result.violations[0].principle).toBe("III");
  });

  it("passes when there is only one non-channel child (no sibling communication needed)", () => {
    const child = makeCell({
      identity: { name: "solo-child", cellType: "transformer", version: "1.0.0" },
    });

    const parent = makeCell();
    parent.children = [child];
    parent.contextMap.children = ["solo-child"];

    const result = compositionCheck([parent]);
    expect(result.passed).toBe(true);
  });

  it("fails when context map does not list actual children", () => {
    const composed = makeComposedCell();
    // Wipe context map children
    composed.contextMap.children = [];

    const result = compositionCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("not listed in parent's context map"))).toBe(true);
  });

  it("fails when channel children are not listed in context map channels", () => {
    const composed = makeComposedCell();
    // Wipe context map channels
    composed.contextMap.channels = [];

    const result = compositionCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) =>
      v.message.includes("not listed in parent's context map channels"),
    )).toBe(true);
  });

  it("skips leaf cells with no children", () => {
    const leaf = makeCell();
    const result = compositionCheck([leaf]);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("recurses into nested compositions", () => {
    const grandchild1 = makeCell({
      identity: { name: "gc-1", cellType: "transformer", version: "1.0.0" },
    });
    const grandchild2 = makeCell({
      identity: { name: "gc-2", cellType: "reactor", version: "1.0.0" },
    });

    const child = makeCell({
      identity: { name: "mid-cell", cellType: "transformer", version: "1.0.0" },
    });
    child.children = [grandchild1, grandchild2];
    child.contextMap.children = ["gc-1", "gc-2"];
    // No channel between grandchildren -- should fail

    const channel = makeCell({
      identity: { name: "bus", cellType: "channel", version: "1.0.0" },
    });

    const parent = makeCell();
    parent.children = [child, channel];
    parent.contextMap.children = ["mid-cell", "bus"];
    parent.contextMap.channels = ["bus"];

    const result = compositionCheck([parent]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.cell === "mid-cell")).toBe(true);
  });
});

// =========================================================================
// 4. selfSimilarityCheck
// =========================================================================
describe("selfSimilarityCheck", () => {
  it("passes for a composed cell with full contract at every scale", () => {
    const composed = makeComposedCell();

    const result = selfSimilarityCheck([composed]);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe("Self-Similarity Check");
  });

  it("passes for a leaf cell (no children to check)", () => {
    const leaf = makeCell();
    const result = selfSimilarityCheck([leaf]);
    expect(result.passed).toBe(true);
  });

  it("fails when composed cell lacks its own identity.name", () => {
    const composed = makeComposedCell(undefined, {
      identity: { name: "", cellType: "transformer", version: "1.0.0" },
    });

    const result = selfSimilarityCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Composed cell lacks its own identity.name"))).toBe(true);
  });

  it("fails when composed cell lacks its own input declaration", () => {
    const composed = makeComposedCell();
    (composed as any).input = undefined;

    const result = selfSimilarityCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("lacks its own input declaration"))).toBe(true);
  });

  it("fails when composed cell lacks its own output declaration", () => {
    const composed = makeComposedCell();
    (composed as any).output = undefined;

    const result = selfSimilarityCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("lacks its own output declaration"))).toBe(true);
  });

  it("fails when composed cell signature does not include child signatures", () => {
    const composed = makeComposedCell();
    composed.signature.children = [];

    const result = selfSimilarityCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("does not include child signatures"))).toBe(true);
    expect(result.violations[0].principle).toBe("IV");
  });

  it("fails when a child cell lacks lineage (self-similarity requires lineage at every scale)", () => {
    const composed = makeComposedCell([
      { lineage: undefined as any },
    ]);

    const result = selfSimilarityCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("lacks lineage"))).toBe(true);
  });

  it("fails when a child cell lacks identity", () => {
    const composed = makeComposedCell();
    (composed.children[0].identity as any).name = "";

    const result = selfSimilarityCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("lacks identity"))).toBe(true);
  });
});

// =========================================================================
// 5. contextMapCheck
// =========================================================================
describe("contextMapCheck", () => {
  it("passes for a complete context map on a leaf cell", () => {
    const cell = makeCell();
    const result = contextMapCheck([cell]);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe("Context Map Check");
  });

  it("fails when cell lacks toMap() method", () => {
    const cell = makeCell({ hasToMapMethod: false });

    const result = contextMapCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("lacks toMap() method");
    expect(result.violations[0].principle).toBe("V");
  });

  it("fails when context map is missing identity", () => {
    const cell = makeCell();
    (cell.contextMap as any).identity = undefined;

    const result = contextMapCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Context map missing identity"))).toBe(true);
    expect(result.violations.some((v) => v.principle === "IX")).toBe(true);
  });

  it("fails when context map is missing identity.name", () => {
    const cell = makeCell();
    cell.contextMap.identity = { name: "", cellType: "transformer", version: "1.0.0" };

    const result = contextMapCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Context map missing identity"))).toBe(true);
  });

  it("fails when context map is missing signature", () => {
    const cell = makeCell();
    (cell.contextMap as any).signature = "";

    const result = contextMapCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Context map missing signature"))).toBe(true);
  });

  it("fails when composed cell context map does not list children", () => {
    const composed = makeComposedCell();
    composed.contextMap.children = [];

    const result = contextMapCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) =>
      v.message.includes("does not list children"),
    )).toBe(true);
    expect(result.violations.some((v) => v.principle === "IX")).toBe(true);
  });

  it("fails when composed cell has channel children but map does not list channels", () => {
    const composed = makeComposedCell();
    composed.contextMap.channels = [];

    const result = contextMapCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) =>
      v.message.includes("does not list channels"),
    )).toBe(true);
  });

  it("passes for composed cell with complete context map", () => {
    const composed = makeComposedCell();
    const result = contextMapCheck([composed]);
    expect(result.passed).toBe(true);
  });

  it("recurses into children for context map checks", () => {
    const composed = makeComposedCell();
    // Break a child's toMap method
    composed.children[0].hasToMapMethod = false;

    const result = contextMapCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.cell === "child-a")).toBe(true);
  });
});

// =========================================================================
// 6. signatureCheck
// =========================================================================
describe("signatureCheck", () => {
  it("passes for a leaf cell with valid computed signature", () => {
    const cell = makeCell();
    // makeCell computes the hash via computeHash, which mirrors the algorithm

    const result = signatureCheck([cell]);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe("Signature Check");
  });

  it("fails when signature hash format is invalid", () => {
    const cell = makeCell();
    cell.signature = { hash: "not-hex-at-all", timestamp: "2026-02-16T00:00:00Z" };

    const result = signatureCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("Invalid signature hash format");
    expect(result.violations[0].principle).toBe("X");
  });

  it("fails when signature hash does not match recomputed value (tampered)", () => {
    const cell = makeCell();
    // Replace hash with a different valid SHA-256
    cell.signature.hash = "a".repeat(64);

    const result = signatureCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("Signature mismatch");
  });

  it("detects tampering when identity.name changes after signing", () => {
    const cell = makeCell();
    const originalHash = cell.signature.hash;
    // "Tamper" with the name after signing
    cell.identity.name = "tampered-name";

    const result = signatureCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("Signature mismatch"))).toBe(true);
  });

  it("passes for a composed cell with correct parent + child hashes", () => {
    const composed = makeComposedCell();

    const result = signatureCheck([composed]);
    expect(result.passed).toBe(true);
  });

  it("fails when composed cell signature children count mismatches actual children", () => {
    const composed = makeComposedCell();
    // Remove one child hash from signature
    composed.signature.children = composed.signature.children!.slice(0, 1);
    // Also need to fix the main hash to pass format check but fail children check
    // Actually the hash mismatch will also trigger, so let's just check both violations

    const result = signatureCheck([composed]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message.includes("children count mismatch"))).toBe(true);
  });

  it("fails when composed cell signature children hashes don't match sorted order", () => {
    const composed = makeComposedCell();
    // Reverse the children hashes so order is wrong
    const reversed = [...(composed.signature.children ?? [])].reverse();
    // Only swap if they aren't already identical (they might be sorted the same reversed)
    if (reversed[0] !== composed.signature.children![0]) {
      composed.signature.children = reversed;
    } else {
      // Force a mismatch by corrupting one hash
      composed.signature.children = [
        "b".repeat(64),
        ...(composed.signature.children ?? []).slice(1),
      ];
    }

    const result = signatureCheck([composed]);
    expect(result.passed).toBe(false);
    // Either hash mismatch or children hash mismatch
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("fails when signature.timestamp is missing", () => {
    const cell = makeCell();
    cell.signature.timestamp = "";

    const result = signatureCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.message === "Missing signature.timestamp")).toBe(true);
  });

  it("recurses into children for signature validation", () => {
    const composed = makeComposedCell();
    // Tamper with a child's name to break its signature
    composed.children[0].identity.name = "tampered-child";

    const result = signatureCheck([composed]);
    expect(result.passed).toBe(false);
    // The child should have a signature mismatch AND the parent's recomputed hash
    // would also differ (since child's own content changed but hash didn't)
    expect(result.violations.some((v) => v.message.includes("Signature mismatch"))).toBe(true);
  });

  it("correctly computes hash for a leaf cell with known inputs", () => {
    // Manually compute what the hash should be
    const cell = makeCell({
      identity: { name: "known", cellType: "keeper", version: "2.0.0" },
      input: { schema: { type: "string" }, description: "test input" },
      output: { schema: { type: "number" }, description: "test output" },
      lineage: {
        source: "Human-Dev",
        trigger: "PR #42",
        justification: "Needed for state persistence",
        signature: "merkle123",
      },
    });

    const expectedContent =
      "known" +
      "keeper" +
      "2.0.0" +
      JSON.stringify({ type: "string" }) +
      JSON.stringify({ type: "number" }) +
      "Human-Dev" +
      "PR #42" +
      "Needed for state persistence";

    const expectedHash = createHash("sha256").update(expectedContent, "utf8").digest("hex");
    expect(cell.signature.hash).toBe(expectedHash);

    const result = signatureCheck([cell]);
    expect(result.passed).toBe(true);
  });
});

// =========================================================================
// 7. circuitBreakerCheck
// =========================================================================
describe("circuitBreakerCheck", () => {
  it("passes for a transformer with budgetRemaining in health report", () => {
    const cell = makeCell({
      identity: { name: "my-transformer", cellType: "transformer", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "healthy", budgetRemaining: 50 },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe("Circuit Breaker Check");
  });

  it("passes for a reactor with budgetRemaining in health report", () => {
    const cell = makeCell({
      identity: { name: "my-reactor", cellType: "reactor", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "healthy", budgetRemaining: 25 },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(true);
  });

  it("passes for a keeper without budgetRemaining (not required for keepers)", () => {
    const cell = makeCell({
      identity: { name: "my-keeper", cellType: "keeper", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "healthy" },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(true);
  });

  it("passes for a channel without budgetRemaining (not required for channels)", () => {
    const cell = makeCell({
      identity: { name: "my-channel", cellType: "channel", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "healthy" },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(true);
  });

  it("fails when a transformer lacks health() method", () => {
    const cell = makeCell({
      identity: { name: "no-health", cellType: "transformer", version: "1.0.0" },
      hasHealthMethod: false,
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("transformer lacks health() method");
  });

  it("fails when a reactor lacks health() method", () => {
    const cell = makeCell({
      identity: { name: "no-health", cellType: "reactor", version: "1.0.0" },
      hasHealthMethod: false,
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("reactor lacks health() method");
  });

  it("fails when transformer health() does not report budgetRemaining", () => {
    const cell = makeCell({
      identity: { name: "no-budget", cellType: "transformer", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "healthy" },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("does not report budgetRemaining");
  });

  it("fails when reactor health() does not report budgetRemaining", () => {
    const cell = makeCell({
      identity: { name: "no-budget", cellType: "reactor", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "healthy" },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("does not report budgetRemaining");
  });

  it("fails when budgetRemaining is negative", () => {
    const cell = makeCell({
      identity: { name: "negative-budget", cellType: "transformer", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "degraded", budgetRemaining: -5 },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("must be a non-negative number");
  });

  it("passes when budgetRemaining is zero (exhausted but valid)", () => {
    const cell = makeCell({
      identity: { name: "zero-budget", cellType: "transformer", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "safe-mode", budgetRemaining: 0 },
    });

    const result = circuitBreakerCheck([cell]);
    expect(result.passed).toBe(true);
  });

  it("recurses into children", () => {
    const child = makeCell({
      identity: { name: "child-reactor", cellType: "reactor", version: "1.0.0" },
      hasHealthMethod: true,
      healthReport: { status: "healthy" }, // missing budgetRemaining
    });
    const parent = makeCell();
    parent.children = [child];

    const result = circuitBreakerCheck([parent]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.cell === "child-reactor")).toBe(true);
  });
});

// =========================================================================
// 8. lineageCheck
// =========================================================================
describe("lineageCheck", () => {
  it("passes for a full Intent Ledger with all four fields", () => {
    const cell = makeCell();
    // makeCell provides complete lineage by default

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(true);
    expect(result.checkName).toBe("Intent Ledger Check");
  });

  it("fails when lineage is entirely missing", () => {
    const cell = makeCell();
    (cell as any).lineage = undefined;

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("Missing lineage (Intent Ledger) entirely");
  });

  it("fails when lineage.source is missing", () => {
    const cell = makeCell();
    cell.lineage.source = "";

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("lineage.source is required");
  });

  it("fails when lineage.source is only whitespace", () => {
    const cell = makeCell();
    cell.lineage.source = "   ";

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("lineage.source is required");
  });

  it("fails when lineage.trigger is missing", () => {
    const cell = makeCell();
    cell.lineage.trigger = "";

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("lineage.trigger is required");
  });

  it("fails when lineage.justification is missing", () => {
    const cell = makeCell();
    cell.lineage.justification = "";

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("lineage.justification is required");
  });

  it("fails when lineage.signature is missing", () => {
    const cell = makeCell();
    cell.lineage.signature = "";

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].message).toContain("lineage.signature is required");
  });

  it("reports all missing fields at once", () => {
    const cell = makeCell();
    cell.lineage = { source: "", trigger: "", justification: "", signature: "" };

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(4);
    expect(result.violations.some((v) => v.message.includes("source"))).toBe(true);
    expect(result.violations.some((v) => v.message.includes("trigger"))).toBe(true);
    expect(result.violations.some((v) => v.message.includes("justification"))).toBe(true);
    expect(result.violations.some((v) => v.message.includes("lineage.signature is required"))).toBe(true);
  });

  it("recurses into children", () => {
    const child = makeCell({
      identity: { name: "child-missing-lineage", cellType: "transformer", version: "1.0.0" },
    });
    child.lineage.source = "";

    const parent = makeCell();
    parent.children = [child];

    const result = lineageCheck([parent]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.cell === "child-missing-lineage")).toBe(true);
  });

  it("passes with valid but minimal lineage content", () => {
    const cell = makeCell();
    cell.lineage = {
      source: "x",
      trigger: "y",
      justification: "z",
      signature: "w",
    };

    const result = lineageCheck([cell]);
    expect(result.passed).toBe(true);
  });
});

// =========================================================================
// Integration: multiple cells through all checks
// =========================================================================
describe("integration — multiple cells", () => {
  it("all checks pass for an array of valid leaf cells", () => {
    const cells = [
      makeCell({
        filePath: "src/parser.transformer.ts",
        identity: { name: "parser", cellType: "transformer", version: "1.0.0" },
      }),
      makeCell({
        filePath: "src/events.reactor.ts",
        identity: { name: "events", cellType: "reactor", version: "2.1.0" },
      }),
      makeCell({
        filePath: "src/cache.keeper.ts",
        identity: { name: "cache", cellType: "keeper", version: "0.1.0" },
      }),
    ];

    expect(cellTypeCheck(cells).passed).toBe(true);
    expect(contractCheck(cells).passed).toBe(true);
    expect(compositionCheck(cells).passed).toBe(true);
    expect(selfSimilarityCheck(cells).passed).toBe(true);
    expect(contextMapCheck(cells).passed).toBe(true);
    expect(signatureCheck(cells).passed).toBe(true);
    // circuitBreakerCheck requires budgetRemaining for transformers/reactors
    expect(circuitBreakerCheck(cells).passed).toBe(true);
    expect(lineageCheck(cells).passed).toBe(true);
  });

  it("all checks pass for a valid composed cell", () => {
    const composed = makeComposedCell();

    expect(cellTypeCheck([composed]).passed).toBe(true);
    expect(contractCheck([composed]).passed).toBe(true);
    expect(compositionCheck([composed]).passed).toBe(true);
    expect(selfSimilarityCheck([composed]).passed).toBe(true);
    expect(contextMapCheck([composed]).passed).toBe(true);
    expect(signatureCheck([composed]).passed).toBe(true);
    expect(circuitBreakerCheck([composed]).passed).toBe(true);
    expect(lineageCheck([composed]).passed).toBe(true);
  });
});
