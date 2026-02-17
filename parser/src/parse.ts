/**
 * Fractal Code .fc Parser — YAML Parsing & Structural Extraction
 *
 * Reads a .fc file (YAML) and extracts the cell structure.
 * Does NOT validate — that's handled by validate.ts.
 * Does NOT parse implementation bodies — they are opaque strings in v0.
 */

import * as yaml from "js-yaml";
import type {
  ParsedCell,
  CellIdentity,
  CellLineage,
  CellLogic,
  CellContract,
  TransformerContract,
  ReactorContract,
  KeeperContract,
  ChannelContract,
  ChildRef,
  ChannelDeclaration,
  ChannelConnects,
  CellType,
} from "./types";

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Parse a .fc file from its YAML string content.
 * Returns the extracted ParsedCell or throws on YAML syntax errors.
 */
export function parseFC(content: string): ParsedCell {
  const doc = yaml.load(content) as Record<string, unknown>;

  if (!doc || typeof doc !== "object") {
    throw new ParseError("File is not a valid YAML document");
  }

  const cell = (doc as any).cell;
  if (!cell || typeof cell !== "object") {
    throw new ParseError('Missing root "cell" key');
  }

  return extractCell(cell);
}

// ── Extraction ──────────────────────────────────────────────────────────

function extractCell(raw: Record<string, unknown>): ParsedCell {
  const identity = extractIdentity(raw.identity);
  const contract = extractContract(identity?.type as CellType, raw.contract);
  const lineage = extractLineage(raw.lineage);
  const logic = extractLogic(raw.logic);
  const signature = extractSignature(raw.signature);
  const children = extractChildren(raw.children);
  const channels = extractChannels(raw.channels);
  const connects = extractConnects(raw.connects);

  const result: ParsedCell = {
    identity,
    contract,
    lineage,
    logic,
    signature,
  };

  if (children) result.children = children;
  if (channels) result.channels = channels;
  if (connects) result.connects = connects;

  return result;
}

function extractIdentity(raw: unknown): CellIdentity {
  if (!raw || typeof raw !== "object") {
    return { name: "", version: "", type: "Transformer" as CellType };
  }
  const obj = raw as Record<string, unknown>;
  return {
    name: String(obj.name ?? ""),
    version: String(obj.version ?? ""),
    type: String(obj.type ?? "") as CellType,
  };
}

function extractLineage(raw: unknown): CellLineage {
  if (!raw || typeof raw !== "object") {
    return { source: "", trigger: "", justification: "", parent_context_hash: "" };
  }
  const obj = raw as Record<string, unknown>;
  return {
    source: String(obj.source ?? ""),
    trigger: String(obj.trigger ?? ""),
    justification: String(obj.justification ?? ""),
    parent_context_hash: String(obj.parent_context_hash ?? ""),
  };
}

function extractLogic(raw: unknown): CellLogic | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const logic: CellLogic = {
    lang: String(obj.lang ?? ""),
  };
  if (obj.process !== undefined) logic.process = String(obj.process);
  if (obj.on !== undefined) logic.on = String(obj.on);
  if (obj.get !== undefined) logic.get = String(obj.get);
  if (obj.set !== undefined) logic.set = String(obj.set);
  if (obj.delete !== undefined) logic.delete = String(obj.delete);
  return logic;
}

function extractSignature(raw: unknown): string {
  if (typeof raw === "string") return raw;
  return "";
}

function extractContract(cellType: CellType, raw: unknown): CellContract {
  if (!raw || typeof raw !== "object") {
    // Return a minimal contract so validation can report the missing fields
    return { input: "", output: "", circuit_breaker: { complexity_budget: 0, safe_mode_action: "halt" } } as TransformerContract;
  }

  const obj = raw as Record<string, unknown>;
  const cb = extractCircuitBreaker(obj.circuit_breaker);

  switch (cellType) {
    case "Transformer":
      return {
        input: String(obj.input ?? ""),
        output: String(obj.output ?? ""),
        circuit_breaker: cb,
      } as TransformerContract;

    case "Reactor":
      return {
        listens_to: String(obj.listens_to ?? ""),
        emits: String(obj.emits ?? ""),
        circuit_breaker: cb,
      } as ReactorContract;

    case "Keeper":
      return {
        state_schema: String(obj.state_schema ?? ""),
        operations: Array.isArray(obj.operations) ? obj.operations.map(String) : [],
        circuit_breaker: cb,
      } as KeeperContract;

    case "Channel":
      return {
        carries: String(obj.carries ?? ""),
        mode: String(obj.mode ?? "") as any,
        buffer_size: typeof obj.buffer_size === "number" ? obj.buffer_size : 0,
        circuit_breaker: cb,
      } as ChannelContract;

    default:
      // Unknown type — return a generic contract for validation to flag
      return {
        input: String(obj.input ?? ""),
        output: String(obj.output ?? ""),
        circuit_breaker: cb,
      } as TransformerContract;
  }
}

function extractCircuitBreaker(raw: unknown): { complexity_budget: number; safe_mode_action: string } {
  if (!raw || typeof raw !== "object") {
    return { complexity_budget: 0, safe_mode_action: "" };
  }
  const obj = raw as Record<string, unknown>;
  return {
    complexity_budget: typeof obj.complexity_budget === "number" ? obj.complexity_budget : 0,
    safe_mode_action: String(obj.safe_mode_action ?? ""),
  };
}

function extractChildren(raw: unknown): ChildRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item: any) => ({
    ref: String(item?.ref ?? ""),
    as: String(item?.as ?? ""),
  }));
}

function extractChannels(raw: unknown): ChannelDeclaration[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((item: any) => ({
    name: String(item?.name ?? ""),
    topology: Array.isArray(item?.topology)
      ? item.topology.map((edge: any) => ({
          from: String(edge?.from ?? ""),
          to: String(edge?.to ?? ""),
        }))
      : [],
  }));
}

function extractConnects(raw: unknown): ChannelConnects | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    from: String(obj.from ?? ""),
    to: String(obj.to ?? ""),
  };
}

// ── Error ───────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}
