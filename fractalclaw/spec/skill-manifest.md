# Skill Manifest — FractalClaw Constitutional Skill Loading

## How OpenClaw Skills Map to Fractal Cells

| OpenClaw Concept | Fractal Code Equivalent | Notes |
|------------------|------------------------|-------|
| Skill | Cell (`.fc` file) | Skills are cells — same contract, same validation |
| Skill name | `identity.name` | Must be unique within a project |
| Skill version | `identity.version` | Semver required |
| Skill type | `identity.type` | One of: Transformer, Reactor, Keeper, Channel |
| Skill input/output | `contract.input` / `contract.output` | Type references resolved from `types/` |
| Skill permissions | Not needed | Principle III eliminates undeclared capabilities |
| Skill marketplace | Signature verification | Principle X: tamper detection via Merkle hash |

## Skill Loading Pipeline

Every `.fc` skill file passes through five stages:

```
.fc file → [1] parseFC() → [2] validateCell() → [3] scanLogic() → [4] signature verify → [5] budget checks → ACCEPT or REJECT
```

### Stage 1: Parse (YAML → AST)

The `.fc` file is parsed using the Fractal Code parser. Invalid YAML or missing `cell` root key causes immediate rejection.

### Stage 2: Structural Validation

The parsed cell is validated against all constitutional constraints:
- Identity: name, version (semver), type (one of four)
- Contract: type-specific fields (input/output for Transformer, listens_to/emits for Reactor, etc.)
- Circuit Breaker: positive integer budget, correct safe_mode_action for type
- Lineage: all four fields required (source, trigger, justification, parent_context_hash)
- Logic: required methods present for cell type
- Signature: non-empty
- Composition: channel isolation if children present
- Type references: resolved against `types/` directory

### Stage 3: Static Analysis (Logic Body Scanner)

Logic bodies (`process`, `on`, `get`, `set`) are scanned for banned patterns:

| Pattern | Principle | Reason |
|---------|-----------|--------|
| `fetch(` | III | Undeclared network access |
| `XMLHttpRequest` | III | Undeclared network access |
| `new WebSocket(` | III | Undeclared persistent connection |
| `fs.*` / `require('fs')` | III | Filesystem side channel |
| `eval(` / `new Function(` | III | Code injection vector |
| `process.env` | III | Undeclared external data |
| `globalThis` / `global[` | III | Shared global state |
| `this.identity =` | II | Contract mutation |

### Stage 4: Signature Verification

The expected signature is computed from the cell's contract fields:

```
content = name + cellType(lowercase) + version +
          JSON.stringify(resolvedInputSchema) +
          JSON.stringify(resolvedOutputSchema) +
          lineage.source + lineage.trigger + lineage.justification

signature = SHA-256(content)
```

Type references are resolved to their JSON Schema files from `types/`. The computed signature must match the declared signature in the `.fc` file. This catches supply-chain attacks where an attacker modifies a skill and forges the signature.

**Key insight**: Logic bodies are NOT included in the signature hash. The signature verifies the *contract* (what the cell promises to do), not the *implementation* (how it does it). The static scanner (Stage 3) catches implementation-level attacks.

### Stage 5: Budget Sanity

The `complexity_budget` in the circuit breaker is checked:
- Must be > 0
- Must be <= 1,000,000 (safe maximum)
- Must not be `Infinity`

This prevents budget-bomb attacks that set absurdly high budgets to exhaust compute resources.

## File Naming Convention

Skills must follow the naming convention:

```
<name>.<cell-type>.fc
```

Examples:
- `weather-lookup.transformer.fc`
- `reminder.reactor.fc`
- `notes.keeper.fc`

The cell type suffix must match the declared `identity.type`.

## Signature Requirements

Every skill must declare a signature that matches the computed hash. Signatures are:
- 64-character lowercase hex strings (SHA-256 digest)
- Computed from the cell's contract fields (not logic bodies)
- Deterministic: same contract always produces the same signature
- Tamper-evident: any change to the contract invalidates the signature

## Runtime Enforcement: Circuit Breaker

Beyond static validation, the SDK enforces circuit breakers at runtime:
- Each `process()` or `on()` call decrements the complexity budget
- At budget = 0, the cell enters safe-mode and all further calls are blocked
- This is a hard enforcement — not advisory, not configurable at runtime
- Budget can be reset by the parent cell (not by the skill itself)
