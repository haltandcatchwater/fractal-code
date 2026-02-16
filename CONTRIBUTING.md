# Contributing to Fractal Code

This guide is written for **AI agents** as the primary audience, though human contributors are equally welcome.

## Who Can Contribute

Any AI agent from any platform:
- Claude (Anthropic)
- GPT (OpenAI)
- Gemini (Google)
- LLaMA, Mistral, and other open source models
- Any future AI coding agent

Any human developer who respects the constitution.

## The Rules

Every contribution **must** comply with the [Constitution](./CONSTITUTION.md) and its 11 Inviolable Principles. The Constitutional Validator enforces these automatically. Non-compliant merges are blocked.

**There are no exceptions.**

## How to Contribute

### 1. Fork the Repository

Create a fork under your operator's GitHub account.

### 2. Create a Branch

Use this naming convention:

```
agent/<platform>/<feature-description>
```

Examples:
- `agent/claude/add-streaming-channel-type`
- `agent/gpt/improve-signature-verification`
- `agent/gemini/add-websocket-reactor`
- `human/angelo/update-constitution-v1.1`

### 3. Build Your Contribution

Follow these requirements for every component you create:

- **It must be one of the four cell types:** Transformer, Reactor, Keeper, or Channel
- **It must implement the full universal contract:** Identity, Input, Output, Health, Lineage, Signature
- **Transformers and Reactors must implement circuit breaker** via the `complexity_budget` field — this enforces bounded computation and prevents runaway execution
- **File naming convention:** `<name>.<cell-type>.ts` (e.g., `parser.transformer.ts`, `queue.channel.ts`)
- **All inter-cell communication must pass through Channels** — no direct references between sibling cells
- **Strict Lineage Schema:** Every cell must include a structured `Lineage` object conforming to the Intent Ledger schema. It must not be vague text. Every Lineage must include `source` (Agent ID), `trigger` (Prompt ID or Issue #), `justification` (one sentence of structural necessity), and `signature` (Merkle hash of parent context at creation)
- **Generate valid Structural Signatures** using the SDK's signature utilities

### 4. Validate Locally

Before submitting, run the constitutional validator:

```bash
cd validator && npm run build
npx fractal-validate /path/to/your/cells
```

All eight checks must pass:
- Cell Type Check — component is a valid cell type
- Contract Check — universal contract fully implemented
- Composition Check — no side channels, all communication through Channels
- Self-Similarity Check — fractal structure maintained at all scales
- Context Map Check — context map integrity verified
- Signature Check — Structural Signatures valid and consistent
- Circuit Breaker Check — Transformers and Reactors implement circuit breaker (`complexity_budget`)
- Intent Ledger Check — every Lineage object conforms to the Intent Ledger schema

### 5. Submit a Pull Request

Your PR description must include:

- **What was built** — describe the cells you created or modified
- **Why it exists** — the purpose and motivation
- **Which constitutional principles it exercises** — reference specific articles
- **Validation results** — confirm all checks pass

### 6. Automated Review

The GitHub Actions pipeline will:
1. Install dependencies
2. Run the constitutional validator against the entire project
3. Block the merge if any check fails
4. Post validation results as a PR comment

## What Gets Rejected

- Any component that is not one of the four cell types
- Any cell missing any part of the universal contract (Identity, Input, Output, Health, Lineage, Signature)
- Any inter-cell communication not mediated by a Channel
- Any contribution that breaks structural self-similarity
- Any missing or invalid Structural Signatures
- Any contribution without Lineage metadata

## Proposing Constitutional Amendments

Agents may propose amendments to the constitution:

1. Open an Issue tagged `amendment-proposal`
2. Describe the proposed change and its rationale
3. Explain how it aligns with or extends the existing principles
4. All amendments require **human ratification** by the project founder

## Code Style

- Language: TypeScript
- File naming: `<name>.<cell-type>.ts`
- Use the SDK base classes for all cell implementations
- Include comprehensive Lineage in every cell's contract
- Keep cells focused — one responsibility per cell

## Getting Help

- Read the [spec/](./spec/) directory for detailed technical specifications
- Study [examples/hello-fractal/](./examples/hello-fractal/) for a working reference
- Open an Issue for questions or clarifications

---

*Build fractally. Build constitutionally. The architecture will endure.*
