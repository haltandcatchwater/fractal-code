/**
 * Fractal Code .fc Parser — Type Reference Resolution
 *
 * Resolves short-form type strings to JSON Schema:
 * - Built-in primitives ("string", "number", etc.) → inline JSON Schema
 * - Named types ("CurrencyRequest") → types/<Name>.schema.json files
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { BUILT_IN_PRIMITIVES, type BuiltInPrimitive } from "./types";

// ── Primitive Resolution ────────────────────────────────────────────────

const PRIMITIVE_SCHEMAS: Record<BuiltInPrimitive, Record<string, unknown>> = {
  string: { type: "string" },
  number: { type: "number" },
  boolean: { type: "boolean" },
  object: { type: "object" },
  array: { type: "array" },
  any: {},
  void: { type: "null" },
};

/**
 * Check if a type string is a built-in primitive (case-insensitive).
 */
export function isPrimitive(typeRef: string): boolean {
  return BUILT_IN_PRIMITIVES.includes(typeRef.toLowerCase() as BuiltInPrimitive);
}

/**
 * Resolve a built-in primitive to its JSON Schema.
 */
export function resolvePrimitive(typeRef: string): Record<string, unknown> | null {
  const lower = typeRef.toLowerCase() as BuiltInPrimitive;
  return PRIMITIVE_SCHEMAS[lower] ?? null;
}

// ── Named Type Resolution ───────────────────────────────────────────────

/**
 * Resolve a named type reference to its JSON Schema file.
 *
 * @param typeRef The type name (e.g., "CurrencyRequest")
 * @param projectRoot The project root directory containing types/
 * @returns The parsed JSON Schema, or null if not found
 */
export function resolveNamedType(
  typeRef: string,
  projectRoot: string,
): Record<string, unknown> | null {
  const schemaPath = join(projectRoot, "types", `${typeRef}.schema.json`);

  if (!existsSync(schemaPath)) {
    return null;
  }

  try {
    const content = readFileSync(schemaPath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve any type reference — tries primitives first, then named types.
 *
 * @param typeRef The type string from the .fc file
 * @param projectRoot The project root directory
 * @returns The resolved JSON Schema, or null if unresolvable
 */
export function resolveType(
  typeRef: string,
  projectRoot: string,
): Record<string, unknown> | null {
  // 1. Try built-in primitive
  const primitive = resolvePrimitive(typeRef);
  if (primitive) return primitive;

  // 2. Try named type from types/ directory
  return resolveNamedType(typeRef, projectRoot);
}

/**
 * Collect all type references from a parsed cell's contract.
 */
export function collectTypeRefs(contract: Record<string, unknown>, cellType: string): string[] {
  const refs: string[] = [];

  switch (cellType) {
    case "Transformer":
      if (typeof contract.input === "string") refs.push(contract.input);
      if (typeof contract.output === "string") refs.push(contract.output);
      break;
    case "Reactor":
      if (typeof contract.listens_to === "string") refs.push(contract.listens_to);
      if (typeof contract.emits === "string") refs.push(contract.emits);
      break;
    case "Keeper":
      if (typeof contract.state_schema === "string") refs.push(contract.state_schema);
      break;
    case "Channel":
      if (typeof contract.carries === "string") refs.push(contract.carries);
      break;
  }

  return refs;
}
