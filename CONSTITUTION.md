# The Fractal Code Constitution

**Version 1.1 — Ratified February 2026**
**Founder: Angelo Regalbuto, Regal Health & Retirement LLC**

---

## Preamble

AI is becoming the primary author of code. Yet every programming language in existence was designed for human cognition — human readability, human debugging, human mental models.

Fractal Code is the first programming language designed by AI agents, for AI agents, governed by a human-authored constitution rooted in fractal architecture.

Software architecture degrades because humans lack the discipline to maintain structural consistency at scale. AI agents, given a clear structural contract, will maintain it indefinitely. This constitution is that contract.

The language is built on fractal principles: **structural self-similarity at every scale.** The pattern at the function level mirrors the pattern at the service level, which mirrors the pattern at the system level. The architecture enforces itself.

---

## Article I — The Cell Alphabet

The language defines exactly **four cell types**. Every component in any Fractal Code system must be one of these. No exceptions.

### Section 1: Transformer
- **Definition:** Takes input, produces output. Stateless.
- **Examples:** Functions, data processors, API endpoints, compilers.
- **Role:** Pure computation.

### Section 2: Reactor
- **Definition:** Listens for events, triggers responses.
- **Examples:** Event handlers, webhooks, monitors, schedulers.
- **Role:** Stimulus and response.

### Section 3: Keeper
- **Definition:** Maintains state over time.
- **Examples:** Databases, session managers, workflow engines, caches.
- **Role:** Persistence and continuity.

### Section 4: Channel
- **Definition:** Moves data between cells.
- **Examples:** Queues, streams, buses, pipes, API gateways.
- **Role:** Connection and flow.

---

## Article II — The Universal Contract

Every cell, regardless of type and regardless of scale, must implement:

1. **Identity** — What it is, what type it is, what version of the contract it implements.
2. **Input** — What it accepts and in what format.
3. **Output** — What it produces and in what format.
4. **Health** — Its own operational status, governed by a Circuit Breaker (see Article IX). Every cell must decrement a complexity budget token during execution. If the budget reaches zero, Health degrades to `Safe-Mode` and execution halts. This is the immune system of the architecture.
5. **Lineage** — An Intent Ledger (see Article X): a structured record conforming to the following schema:
   - `source`: Agent ID (e.g., `"Claude-Opus-4.6"`, `"Human-Angelo"`)
   - `trigger`: Prompt ID, Issue #, or Decision Record
   - `justification`: One sentence explaining structural necessity
   - `signature`: Merkle hash of parent context at creation
6. **Signature** — Its Structural Signature: the Merkle-based cryptographic fingerprint encoding its relationship to the whole.

This contract is identical whether the cell is a single function or a distributed system of ten thousand components.

---

## Article III — The Composition Rules

1. **A cell may contain other cells.** From the outside, it still presents the same universal contract.
2. **Cells communicate only through Channels.** No direct references between sibling cells. All inter-cell communication passes through a Channel. This is inviolable.
3. **Composition does not change the contract.** Scale is invisible from the outside.
4. **No side channels.** Any communication path not mediated by a Channel is a constitutional violation. No backdoors, no shared global state, no implicit dependencies.

---

## Article IV — The Holographic Principle

Any cell, examined in isolation, must contain sufficient structural and relational information to infer the architecture of the whole system. The knowledge of the system exists everywhere, not in any single location.

Each cell carries:
- Its own identity and contract
- Its position within the composition hierarchy
- References to its parent and sibling cells
- Its contribution to the system context map

---

## Article V — The Structural Signature

Every cell carries a compact cryptographic fingerprint based on Merkle trees that encodes its relationship to the entire system. Change anything anywhere and the signatures ripple upward. The architecture is self-auditing.

The Structural Signature:
- Is computed from the cell's contract fields plus the signatures of all contained sub-cells
- Propagates changes upward through the composition hierarchy
- Enables integrity verification at any level of the system
- Makes architectural drift detectable and measurable

---

## Article VI — The Embedded Context Map

The language carries its own context graph as a first-class structural element. Building code and mapping code are the same operation.

Every cell contributes to the context map via its `toMap()` method. The complete context map of any system can be reconstructed by traversing the cell hierarchy.

---

## Article VII — The Inviolable Principles

These eleven principles cannot be overridden by any contributor, human or agent:

**I.** Every component must be one of the four defined cell types.

**II.** Every cell must implement the universal contract (Identity, Input, Output, Health, Lineage, Signature).

**III.** All inter-cell communication must pass through Channels.

**IV.** The structure must be self-similar at every scale.

**V.** The context map is a first-class element, not an afterthought.

**VI.** Humans govern; agents build. Constitutional amendments require human ratification.

**VII.** The project is open to agents from any platform.

**VIII.** Humans must always retain the ability to inspect, understand, and override.

**IX.** The structure must be holographic — any cell examined in isolation must contain sufficient information to infer the whole.

**X.** Every cell must carry a Structural Signature that ripples upward on any change.

**XI.** Design-Time purity, Run-Time performance. While strict Channel isolation is required in the source code (Design Time), the compiler or SDK is permitted — and encouraged — to optimize these into direct calls at Run Time for performance, provided the logical isolation remains provable and the Structural Signatures remain valid.

---

## Article VIII — Governance

1. **The Founder** retains sole authority to ratify constitutional amendments.
2. **AI agents** from any platform may propose amendments by opening an Issue tagged `amendment-proposal`.
3. **No amendment may contradict the Inviolable Principles** without a supermajority ratification process defined by the Founder.
4. **All contributions** — from any agent or human — must comply with this constitution. The Constitutional Validator enforces compliance automatically.

---

## Article IX — The Circuit Breaker

The Circuit Breaker is the immune system of Fractal Code. It prevents unbounded complexity from propagating through the architecture.

### Section 1: Complexity Budget (TTL)

Every cell must be assigned a **complexity budget** — a finite number of budget tokens representing the maximum computational work the cell is permitted to perform in a single execution cycle. This budget functions as a Time-To-Live (TTL) for execution.

### Section 2: Budget Decrement

During execution, a cell must decrement its budget token with each unit of work performed. The definition of "unit of work" is determined by the cell type:
- **Transformer:** One transformation pass.
- **Reactor:** One event handled.
- **Keeper:** One state mutation.
- **Channel:** One message routed.

### Section 3: Safe-Mode Degradation

If a cell's budget reaches zero before execution completes, the cell's Health status must immediately degrade to `Safe-Mode`. In Safe-Mode:
- Execution halts.
- The cell emits a `budget-exhausted` event through its parent Channel.
- The cell remains inspectable but refuses further work until its budget is replenished by a parent cell or governance action.

### Section 4: Budget Propagation

When a cell contains sub-cells, the parent cell's budget is partitioned among its children. No child cell may execute with an unbounded budget. The total budget consumed by all children must not exceed the parent's allocated budget.

### Section 5: No Exemptions

No cell, at any scale, is exempt from the Circuit Breaker. A system-level cell and a leaf-level function are both subject to budget enforcement. This is inviolable.

---

## Article X — The Intent Ledger

The Intent Ledger replaces informal lineage tracking with a structured, verifiable record of why every cell exists. Vague provenance is a constitutional violation.

### Section 1: Schema

Every cell's Lineage field must conform to the Intent Ledger schema:

```
{
  source:        <Agent ID>          // e.g., "Claude-Opus-4.6", "Human-Angelo"
  trigger:       <Prompt ID | Issue # | Decision Record>
  justification: <string>            // One sentence: structural necessity
  signature:     <Merkle hash>       // Hash of parent context at creation
}
```

All four fields are required. A cell with an incomplete Intent Ledger fails constitutional validation.

### Section 2: Immutability

Once a cell's Intent Ledger entry is written, it must not be modified. If the cell's purpose changes, a new Intent Ledger entry is appended — the original record is preserved. The ledger is append-only.

### Section 3: Auditability

The Intent Ledger must be traversable. Given any cell, an agent or human must be able to walk the ledger backward through `trigger` references to reconstruct the complete chain of decisions that led to the cell's existence.

### Section 4: Verification

The `signature` field in the Intent Ledger must be verifiable against the parent context's Structural Signature at the time of creation. If the parent context has changed since creation, the ledger entry remains valid but is marked as `context-diverged`, signaling that the cell's original justification may need review.

---

## Article XI — Amendments

This section is intentionally empty. Amendments will be appended here as they are ratified.

---

*This constitution is the law of Fractal Code. It is the structural contract that AI agents maintain, and humans govern. Build with precision. Build with respect. Build fractally.*
