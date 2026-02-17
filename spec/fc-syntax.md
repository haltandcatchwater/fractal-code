# Fractal Code Native Syntax Specification

**Version 0.1 — v0 Draft**

**Status:** Canonical. This supersedes `file-format.md` (JSON-based, retained as historical reference).

---

## 1. Overview

Fractal Code source files use the `.fc` extension. The native syntax is YAML-based: structured enough for AI agents to generate with zero ambiguity, readable enough for humans to inspect and understand.

A `.fc` file is a cell. A cell is a `.fc` file. The file format *is* the architecture.

### Why YAML?

AI agents write YAML more reliably than custom grammars. YAML provides:

- **Deterministic structure** — one canonical way to express each concept
- **No syntactic ambiguity** — unlike text-based languages with operator precedence, whitespace sensitivity debates, or multiple valid representations
- **Native multiline strings** — implementation bodies embed cleanly via `|` blocks
- **Tooling for free** — every language has a YAML parser; no custom lexer/grammar needed
- **Human-scannable** — clear visual hierarchy through indentation

When there is tension between human aesthetics and machine reliability, **machine reliability wins**. Humans inspect through the translation layer. The structure is what matters.

---

## 2. Seven Constitutional Constraints

Every `.fc` file must satisfy these constraints, derived from the 11 Inviolable Principles:

| # | Constraint | Principle | Description |
|---|-----------|-----------|-------------|
| 1 | **Machine-First** | VII | Syntax optimized for AI agent generation. One canonical form per concept. |
| 2 | **Explicit Typing** | I | Cell type declared as a top-level field. No inference, no implicit defaults. |
| 3 | **Contract Enforcement** | II | All six universal contract fields present: identity, contract, lineage, logic, signature, and health (via circuit_breaker). |
| 4 | **Holographic Anchor** | IX | Any `.fc` file examined alone contains enough information to infer its role in the system. |
| 5 | **Native Channels** | III | Composed cells must declare channels. No inter-cell communication exists outside declared channel topology. |
| 6 | **Parseable Without Ambiguity** | VIII | The parser validates cell structure without parsing implementation bodies. Logic blocks are opaque in v0. |
| 7 | **Human-Readable** | VIII | A human reading any `.fc` file can determine: what it is, what it accepts/produces, who created it and why, and how healthy it is — without running any tool. |

---

## 3. File Structure

Every `.fc` file contains exactly one cell definition under the `cell:` root key.

### 3.1 Required Sections

| Section | Required For | Description |
|---------|-------------|-------------|
| `cell.identity` | All types | Name, version, and cell type |
| `cell.contract` | All types | Input/output schemas (type-specific structure) |
| `cell.lineage` | All types | Intent Ledger — who created it, why, and when |
| `cell.logic` | All types | Implementation body with language tag |
| `cell.signature` | All types | Structural signature (Merkle hash) |

### 3.2 Optional Sections

| Section | When Used | Description |
|---------|-----------|-------------|
| `cell.children` | Composed cells | References to child `.fc` files |
| `cell.channels` | Composed cells | Channel topology connecting children |
| `cell.connects` | Channel type | Which cells this channel bridges |

---

## 4. Identity

```yaml
cell:
  identity:
    name: "CurrencyConverter"
    version: "1.0.0"
    type: "Transformer"
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | Non-empty. Unique within parent scope. |
| `version` | string | Yes | Semantic versioning (e.g., `"1.0.0"`, `"2.1.0-beta.1"`). |
| `type` | string | Yes | One of: `"Transformer"`, `"Reactor"`, `"Keeper"`, `"Channel"`. Case-sensitive, capitalized. |

---

## 5. Contract

The contract section varies by cell type. This is the core of what makes each cell type distinct.

### 5.1 Transformer Contract

```yaml
  contract:
    input: "CurrencyRequest"
    output: "CurrencyResponse"
    circuit_breaker:
      complexity_budget: 1000
      safe_mode_action: "halt"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | string | Yes | Type reference for accepted input |
| `output` | string | Yes | Type reference for produced output |
| `circuit_breaker.complexity_budget` | integer | Yes | TTL — decrements on each `process()` call |
| `circuit_breaker.safe_mode_action` | string | Yes | Action when budget exhausted. Transformer: `"halt"` |

### 5.2 Reactor Contract

```yaml
  contract:
    listens_to: "PriceUpdateEvent"
    emits: "AlertNotification"
    circuit_breaker:
      complexity_budget: 500
      safe_mode_action: "halt"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `listens_to` | string | Yes | Type reference for the event this reactor subscribes to |
| `emits` | string | Yes | Type reference for the response it produces |
| `circuit_breaker.complexity_budget` | integer | Yes | TTL — decrements on each `on()` call |
| `circuit_breaker.safe_mode_action` | string | Yes | Action when budget exhausted. Reactor: `"halt"` |

### 5.3 Keeper Contract

```yaml
  contract:
    state_schema: "SessionState"
    operations:
      - "get"
      - "set"
      - "delete"
    circuit_breaker:
      complexity_budget: 2000
      safe_mode_action: "read_only"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `state_schema` | string | Yes | Type reference for the state this keeper manages |
| `operations` | string[] | Yes | List of supported operations. Minimum: `["get", "set"]` |
| `circuit_breaker.complexity_budget` | integer | Yes | TTL for write operations |
| `circuit_breaker.safe_mode_action` | string | Yes | Action when exhausted. Keeper: `"read_only"` (gets still work, sets blocked) |

### 5.4 Channel Contract

```yaml
  contract:
    carries: "HttpRequest"
    mode: "fifo"
    buffer_size: 100
    circuit_breaker:
      complexity_budget: 5000
      safe_mode_action: "drop_newest"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `carries` | string | Yes | Type reference for the data transported |
| `mode` | string | Yes | Buffer mode: `"fifo"`, `"lifo"`, or `"pubsub"` |
| `buffer_size` | integer | Yes | Maximum items in the buffer |
| `circuit_breaker.complexity_budget` | integer | Yes | TTL for send operations |
| `circuit_breaker.safe_mode_action` | string | Yes | Action when exhausted. Channel: `"drop_newest"` (receives still work, sends dropped) |

---

## 6. Lineage (Intent Ledger)

Every cell must carry a complete, structured provenance record. No free text. Every field must be specific and traceable.

```yaml
  lineage:
    source: "Agent-Claude-Opus-4.6"
    trigger: "Issue #12"
    justification: "Adding financial primitive to standard library."
    parent_context_hash: "0x7f8e9a..."
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `source` | string | Yes | Agent ID or human identifier. Non-empty. Examples: `"Agent-Claude-Opus-4.6"`, `"Agent-GPT-4o"`, `"Human-Angelo"` |
| `trigger` | string | Yes | What prompted creation. Non-empty. Examples: `"Issue #12"`, `"ADR-007"`, `"prompt-2026-02-16-bootstrap"` |
| `justification` | string | Yes | Single sentence of **structural necessity** — why this cell must exist, not what it does. Non-empty. |
| `parent_context_hash` | string | Yes | Hex-prefixed Merkle hash of the parent context at creation time. Non-empty. |

### Justification Quality

The `justification` field is the most important line in the Intent Ledger. It must answer: **"Why must this cell exist in this system?"**

- **BAD:** `"Demonstrates basic Transformer usage"` (describes what, not why)
- **BAD:** `"Converts currency"` (restates the name)
- **GOOD:** `"Adding financial primitive to standard library."` (structural necessity)
- **GOOD:** `"Mediates all sibling communication as required by Composition Rule 2."` (constitutional justification)
- **GOOD:** `"Session persistence for user authentication flow."` (system-level necessity)

---

## 7. Logic

The logic section contains the executable implementation. In v0, implementation bodies are **opaque** — the parser validates the structure but does not parse or validate the code inside.

```yaml
  logic:
    lang: "typescript"
    process: |
      const rate = lookup(input.pair);
      return { converted: input.amount * rate };
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lang` | string | Yes | Host language identifier. v0 default: `"typescript"`. Future: `"fractal"` when native DSL exists. |

### 7.1 Logic Methods by Cell Type

Each cell type exposes specific methods in the logic block:

| Cell Type | Required Methods | Optional Methods |
|-----------|-----------------|-----------------|
| Transformer | `process` | — |
| Reactor | `on` | — |
| Keeper | `get`, `set` | `delete` |
| Channel | — | (Channel logic is handled by the runtime; no user-defined methods) |

**Note:** Channels do not have user-defined logic methods. Their behavior (FIFO/LIFO/pubsub buffering, send/receive) is provided by the runtime based on the `contract.mode` field. A Channel `.fc` file has an empty or absent `logic` section.

### 7.2 The `logic.lang` Migration Hook

The `lang` field is the bridge between v0 (embedded TypeScript) and the future native Fractal Code DSL:

```yaml
# v0 — TypeScript bridge
logic:
  lang: "typescript"
  process: |
    return input.toUpperCase();

# Future — native Fractal Code DSL (when it emerges from agent contributions)
logic:
  lang: "fractal"
  process: |
    transform input -> uppercase
```

The parser accepts any string for `lang` but only guarantees execution support for `"typescript"` in v0. Unknown languages are flagged as warnings, not errors, to allow experimentation.

---

## 8. Signature

The structural signature is a Merkle hash that encodes the cell's relationship to the entire system.

```yaml
  signature: "0xAB45CD78..."
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signature` | string | Yes | Hex-prefixed SHA-256 hash. Auto-generated by the SDK/parser. |

### 8.1 Signature Computation

**Leaf cell (no children):**
```
SHA-256(
  identity.name +
  identity.type +
  identity.version +
  contract[type-specific-fields] +
  lineage.source +
  lineage.trigger +
  lineage.justification
)
```

**Composed cell (with children):**
```
sorted_child_hashes = children.map(c => c.signature).sort()
content = [leaf computation] + sorted_child_hashes.join("")
SHA-256(content)
```

Properties:
- **Deterministic** — same structure produces same hash
- **Change propagation** — any modification anywhere ripples upward to the root
- **Tamper detection** — recompute and compare; mismatch = unauthorized modification

---

## 9. Composition

Composed cells contain children and declare channel topology.

### 9.1 Children

```yaml
  children:
    - ref: "./request.reactor.fc"
      as: "request"
    - ref: "./pipe.channel.fc"
      as: "pipe"
    - ref: "./greeter.transformer.fc"
      as: "greeter"
    - ref: "./memory.keeper.fc"
      as: "memory"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ref` | string | Yes | Relative path to the child `.fc` file |
| `as` | string | Yes | Local alias used in channel topology and logic |

### 9.2 Channels

```yaml
  channels:
    - name: "pipe"
      topology:
        - from: "request"
          to: "greeter"
        - from: "greeter"
          to: "memory"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Must match an `as` alias of a Channel child |
| `topology` | array | Yes | Directed edges declaring who sends to whom through this channel |
| `topology[].from` | string | Yes | Sender alias |
| `topology[].to` | string | Yes | Receiver alias |

**Constitutional requirement (Principle III):** If a composed cell has two or more non-channel children, at least one Channel must exist in `channels` to mediate their communication. No direct references between siblings.

### 9.3 Channel `connects` (on the Channel cell itself)

A Channel-type cell can also declare its connections inline:

```yaml
  connects:
    from: "ApiGateway"
    to: "RequestHandler"
```

This is the Channel's own declaration of which cells it bridges. The parent's `channels` section provides the authoritative topology; the Channel's `connects` is for self-documentation (holographic principle — the Channel knows its own role without needing the parent).

---

## 10. Type Reference System

Type references in `.fc` files use short-form strings that resolve to JSON Schema definitions.

### 10.1 Built-in Primitives

| Type String | Resolves To |
|------------|-------------|
| `"string"` | `{ "type": "string" }` |
| `"number"` | `{ "type": "number" }` |
| `"boolean"` | `{ "type": "boolean" }` |
| `"object"` | `{ "type": "object" }` |
| `"array"` | `{ "type": "array" }` |
| `"any"` | `{}` (accepts anything) |
| `"void"` | `{ "type": "null" }` (no meaningful output) |

### 10.2 Named Types

Non-primitive type strings resolve to schema files in the project's `types/` directory:

```yaml
contract:
  input: "CurrencyRequest"     # resolves to types/CurrencyRequest.schema.json
  output: "CurrencyResponse"   # resolves to types/CurrencyResponse.schema.json
```

**Resolution algorithm:**
1. Check if the string matches a built-in primitive (case-insensitive)
2. If not, look for `types/<TypeName>.schema.json` in the project root
3. If not found, report a validation error

### 10.3 Schema File Format

Schema files are standard JSON Schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "pair": { "type": "string", "description": "Currency pair, e.g. USD/EUR" },
    "amount": { "type": "number", "description": "Amount to convert" }
  },
  "required": ["pair", "amount"]
}
```

---

## 11. Complete Reference Examples

### 11.1 Transformer

```yaml
# ── TRANSFORMER ──────────────────────────────────────────────────────────
# Stateless computation: takes input, produces output.
# Primary method: process

cell:
  identity:
    name: "CurrencyConverter"
    version: "1.0.0"
    type: "Transformer"

  contract:
    input: "CurrencyRequest"
    output: "CurrencyResponse"
    circuit_breaker:
      complexity_budget: 1000
      safe_mode_action: "halt"

  lineage:
    source: "Agent-Claude-Opus-4.6"
    trigger: "Issue #12"
    justification: "Adding financial primitive to standard library."
    parent_context_hash: "0x7f8e9a..."

  logic:
    lang: "typescript"
    process: |
      const rate = lookup(input.pair);
      return { converted: input.amount * rate };

  signature: "0xAB45..."
```

### 11.2 Reactor

```yaml
# ── REACTOR ──────────────────────────────────────────────────────────────
# Event-driven: listens for events, triggers responses.
# Primary method: on

cell:
  identity:
    name: "PriceAlertMonitor"
    version: "1.0.0"
    type: "Reactor"

  contract:
    listens_to: "PriceUpdateEvent"
    emits: "AlertNotification"
    circuit_breaker:
      complexity_budget: 500
      safe_mode_action: "halt"

  lineage:
    source: "Agent-GPT-4o"
    trigger: "Issue #18"
    justification: "Monitor for threshold-breaking price changes."
    parent_context_hash: "0x3c2d1a..."

  logic:
    lang: "typescript"
    on: |
      if (event.price > threshold) {
        emit({ symbol: event.symbol, price: event.price });
      }

  signature: "0xCD78..."
```

### 11.3 Keeper

```yaml
# ── KEEPER ───────────────────────────────────────────────────────────────
# State persistence: maintains data over time.
# Primary methods: get, set. Optional: delete

cell:
  identity:
    name: "SessionStore"
    version: "1.0.0"
    type: "Keeper"

  contract:
    state_schema: "SessionState"
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
    parent_context_hash: "0x9b8a7c..."

  logic:
    lang: "typescript"
    get: |
      return state[key] ?? null;
    set: |
      state[key] = value;
    delete: |
      delete state[key];

  signature: "0xEF12..."
```

### 11.4 Channel

```yaml
# ── CHANNEL ──────────────────────────────────────────────────────────────
# Data transport: moves data between cells.
# No user-defined logic — behavior determined by mode.

cell:
  identity:
    name: "RequestPipeline"
    version: "1.0.0"
    type: "Channel"

  contract:
    carries: "HttpRequest"
    mode: "fifo"
    buffer_size: 100
    circuit_breaker:
      complexity_budget: 5000
      safe_mode_action: "drop_newest"

  lineage:
    source: "Human-Angelo"
    trigger: "Architecture-Decision-001"
    justification: "Primary request ingestion channel for API gateway."
    parent_context_hash: "0x1a2b3c..."

  connects:
    from: "ApiGateway"
    to: "RequestHandler"

  signature: "0x5678..."
```

### 11.5 Composed Cell (Root)

```yaml
# ── COMPOSED TRANSFORMER ─────────────────────────────────────────────────
# Demonstrates fractal composition: a Transformer containing all four types.
# From the outside, this looks identical to a simple Transformer (same contract).

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
      const event = await request.on({ name: input, timestamp: new Date().toISOString() });
      await pipe.send({ from: "request", to: "greeter", data: event.name });
      const msg = await pipe.receive();
      const greeting = await greeter.process(msg.data);
      await pipe.send({ from: "greeter", to: "memory", data: greeting });
      const result = await pipe.receive();
      const history = await memory.get();
      history.greetings.push({ name: input, message: result.data, timestamp: new Date().toISOString() });
      await memory.set(history);
      return greeting;

  signature: "0x9A8B7C..."
```

---

## 12. File Naming Convention

```
<name>.<cell-type>.fc
```

The cell type in the filename is **lowercase**:

| Example | Cell Type |
|---------|-----------|
| `currency-converter.transformer.fc` | Transformer |
| `price-alert.reactor.fc` | Reactor |
| `session-store.keeper.fc` | Keeper |
| `request-pipeline.channel.fc` | Channel |
| `app.transformer.fc` | Root cell |

---

## 13. Project Structure

```
my-project/
├── fractal.json                         # Project manifest
├── types/                               # Shared type definitions
│   ├── CurrencyRequest.schema.json
│   ├── CurrencyResponse.schema.json
│   └── SessionState.schema.json
├── app.transformer.fc                   # Root cell
├── request.reactor.fc
├── pipe.channel.fc
├── greeter.transformer.fc
└── memory.keeper.fc
```

### `fractal.json` — Project Manifest

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "root": "app.transformer.fc",
  "constitution": "1.1"
}
```

---

## 14. Validation Rules

A `.fc` file is **valid** if all of the following hold:

### Structural Validation

1. The file is valid YAML
2. The root key is `cell`
3. `cell.identity` is present with non-empty `name`, valid semver `version`, and valid `type`
4. `cell.identity.type` is one of: `"Transformer"`, `"Reactor"`, `"Keeper"`, `"Channel"`
5. `cell.contract` is present and matches the expected shape for the declared type
6. `cell.lineage` is present with all four fields non-empty (`source`, `trigger`, `justification`, `parent_context_hash`)
7. `cell.signature` is present and non-empty (hex string)
8. The file name matches the pattern `<name>.<cell-type-lowercase>.fc`

### Contract Validation (type-specific)

9. **Transformer:** `contract.input` and `contract.output` are present, non-empty strings
10. **Reactor:** `contract.listens_to` and `contract.emits` are present, non-empty strings
11. **Keeper:** `contract.state_schema` is a present, non-empty string; `contract.operations` is an array containing at least `"get"` and `"set"`
12. **Channel:** `contract.carries` is a present, non-empty string; `contract.mode` is one of `"fifo"`, `"lifo"`, `"pubsub"`; `contract.buffer_size` is a positive integer

### Circuit Breaker Validation

13. `contract.circuit_breaker.complexity_budget` is a positive integer
14. `contract.circuit_breaker.safe_mode_action` is a valid action for the cell type:
    - Transformer/Reactor: `"halt"`
    - Keeper: `"read_only"`
    - Channel: `"drop_newest"`

### Logic Validation

15. `cell.logic.lang` is present and non-empty (v0: must be `"typescript"` for execution; other values accepted as warnings)
16. The appropriate method(s) for the cell type are present:
    - Transformer: `logic.process`
    - Reactor: `logic.on`
    - Keeper: `logic.get` and `logic.set`
    - Channel: no logic methods required
17. Implementation bodies are **not parsed** in v0 — the parser treats them as opaque strings

### Type Reference Validation

18. Every type reference in `contract` resolves to either a built-in primitive or an existing `types/<Name>.schema.json` file

### Composition Validation

19. If `children` is present, every entry has both `ref` and `as` fields
20. If a composed cell has 2+ non-channel children, at least one channel must exist in `channels`
21. Every `topology.from` and `topology.to` in `channels` must match an `as` alias in `children`
22. Channel names in `channels` must match `as` aliases of Channel-type children

---

## 15. Safe Mode Actions

The `safe_mode_action` field defines what happens when a cell's circuit breaker fires (complexity budget reaches zero):

| Cell Type | Action | Behavior |
|-----------|--------|----------|
| Transformer | `"halt"` | Throws error on `process()`. Cell becomes inspectable but non-executable. |
| Reactor | `"halt"` | Throws error on `on()`. Cell stops responding to events. |
| Keeper | `"read_only"` | `get()` still works. `set()` and `delete()` throw errors. State is preserved. |
| Channel | `"drop_newest"` | `receive()` still works (drain buffer). `send()` silently drops messages. No data loss for in-flight items. |

`resetBudget()` restores the budget to its initial value and exits safe mode. This is called by parent cells for orchestration.

---

## 16. v0 Limitations and Future Directions

This is v0 of the `.fc` syntax. The following are explicitly deferred:

- **Native DSL:** The `logic.lang: "fractal"` path is reserved but undefined. The native expression language will emerge from agent contributions per the Self-Bootstrapping Milestone (Constitution Step 11).
- **Binary format:** A compact binary encoding for performance-critical deployments.
- **Streaming cells:** Support for cells that represent infinite streams or long-running processes.
- **Cross-language logic:** Additional `logic.lang` values (`"python"`, `"rust"`, `"go"`) pending SDK ports.
- **Inline type definitions:** Currently types resolve to external schema files. Future versions may support inline type syntax.

### Amendment Process

Agents may propose refinements to this specification by opening an amendment-proposal issue on the repository. Amendments require:

1. A clear description of the proposed change
2. Justification rooted in one of the 11 Inviolable Principles
3. At least one working example showing the before/after
4. Human ratification (Principle VI: Humans govern; agents build)
