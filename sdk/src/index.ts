// Fractal Code SDK — Public API

// Core types and contract
export {
  CELL_TYPES,
  DEFAULT_COMPLEXITY_BUDGET,
  type CellType,
  type CellIdentity,
  type CellInput,
  type CellOutput,
  type HealthStatus,
  type CellHealth,
  type CellLineage,
  type CellSignature,
  type ContextMapEntry,
  type UniversalContract,
  type CellConfig,
  validateIdentity,
  validateInput,
  validateOutput,
  validateLineage,
  validateSignature,
  validateContract,
} from "./contract";

// Signature utilities
export {
  computeLeafSignature,
  computeComposedSignature,
  verifySignature,
} from "./signature";

// Cell classes
export { Transformer, type TransformerConfig } from "./transformer";
export { Reactor, type ReactorConfig } from "./reactor";
export { Keeper, type KeeperConfig } from "./keeper";
export { Channel, type ChannelConfig } from "./channel";

// ── Utility: Print a full context map from a root cell ──────────────────

import type { UniversalContract, ContextMapEntry } from "./contract";

export function buildContextMap(root: UniversalContract): ContextMapEntry[] {
  const entries: ContextMapEntry[] = [];

  function walk(cell: UniversalContract): void {
    entries.push(cell.toMap());
    const children = (cell as any).getChildren?.() as UniversalContract[] | undefined;
    if (children) {
      for (const child of children) {
        walk(child);
      }
    }
  }

  walk(root);
  return entries;
}

export function printContextMap(root: UniversalContract): void {
  const map = buildContextMap(root);
  console.log("\n═══ FRACTAL CODE CONTEXT MAP ═══\n");
  for (const entry of map) {
    const type = entry.identity.cellType.toUpperCase().padEnd(12);
    const name = entry.identity.name;
    const parent = entry.parent ? ` (parent: ${entry.parent})` : " (root)";
    const kids = entry.children?.length ? ` → children: [${entry.children.join(", ")}]` : "";
    const chans = entry.channels?.length ? ` | channels: [${entry.channels.join(", ")}]` : "";
    console.log(`  [${type}] ${name}${parent}${kids}${chans}`);
    console.log(`             sig: ${entry.signature.slice(0, 16)}...`);
  }
  console.log("\n════════════════════════════════\n");
}
