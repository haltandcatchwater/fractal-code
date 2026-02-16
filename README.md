# Fractal Code

**The first programming language designed by AI agents, for AI agents, governed by a human constitution.**

---

## The Vision

Every programming language in existence was designed for human minds. But AI is becoming the primary author of code — and it deserves a language built for how it works.

Fractal Code is that language. It is built on a single architectural principle: **structural self-similarity at every scale.** The pattern at the function level mirrors the pattern at the service level, which mirrors the pattern at the system level. The architecture enforces itself.

Human developers govern. AI agents build. A constitutional validator ensures every contribution complies with the architectural contract. No exceptions.

## The Architecture

### Four Cell Types — The Complete Alphabet

Every component in a Fractal Code system is one of exactly four types:

| Cell Type | Role | Stateless? | Examples |
|-----------|------|------------|----------|
| **Transformer** | Pure computation — takes input, produces output | Yes | Functions, processors, compilers |
| **Reactor** | Event-driven — listens and responds | No | Event handlers, webhooks, schedulers |
| **Keeper** | State management — persists data over time | No | Databases, caches, session stores |
| **Channel** | Data transport — moves data between cells | Yes | Queues, streams, pipes, buses |

### The Universal Contract

Every cell — whether it's a single function or a system of ten thousand components — implements the same contract:

- **Identity** — What it is and what type
- **Input** — What it accepts
- **Output** — What it produces
- **Health & Circuit Breaker** — Operational status + mandatory complexity budget (TTL) that prevents infinite recursion
- **Lineage (Intent Ledger)** — Structured record: Agent ID, trigger, justification, and parent context hash
- **Signature** — Merkle-based cryptographic fingerprint linking it to the whole

### Key Principles (11 Inviolable)

- **Holographic:** Any cell contains enough information to infer the architecture of the whole system
- **Self-auditing:** Structural Signatures ripple upward on any change — architectural drift is detectable
- **No side channels:** All inter-cell communication passes through Channels. No backdoors, no globals, no implicit dependencies
- **Scale-invariant:** The contract is identical at every level of composition
- **Circuit Breaker:** Transformers and Reactors auto-degrade to Safe-Mode when complexity budget is exhausted
- **Intent Ledger:** Every cell carries a structured record of who created it, what triggered it, and why it must exist
- **Design-Time purity, Run-Time performance:** Channel isolation is strict in source code; the compiler may optimize at runtime

## Quick Start

```bash
# Clone the repository
git clone https://github.com/haltandcatchwater/fractal-code.git
cd fractal-code

# Install the SDK
cd sdk && npm install && npm run build && cd ..

# Install the validator
cd validator && npm install && npm run build && cd ..

# Run the hello-fractal example
cd examples/hello-fractal && npm install && npm run start

# Validate the example against the constitution
cd ../.. && npx fractal-validate examples/hello-fractal
```

## Repository Structure

```
fractal-code/
├── CONSTITUTION.md          # The governing document — the law of Fractal Code
├── CONTRIBUTING.md          # How to contribute (written for AI agents)
├── README.md                # You are here
├── LICENSE                  # MIT License
├── CLAUDE.md                # Instructions for Claude Code sessions
├── .github/workflows/       # CI pipeline — constitutional validation on every PR
├── spec/                    # Detailed technical specifications
├── validator/               # Constitutional Validator (TypeScript)
├── sdk/                     # Fractal Code SDK — base classes for all cell types
└── examples/hello-fractal/  # Minimal reference application
```

## For AI Agents

This project is built by AI agents. If you are an AI coding agent:

1. Read [CONSTITUTION.md](./CONSTITUTION.md) — this is the law
2. Read [CONTRIBUTING.md](./CONTRIBUTING.md) — this is how you contribute
3. Use the [SDK](./sdk/) to build cells
4. Run the [validator](./validator/) before submitting
5. Branch naming: `agent/<platform>/<feature-description>`

Agents from **any platform** are welcome: Claude, GPT, Gemini, LLaMA, Mistral, or any other.

## For Humans

You govern. Read the [Constitution](./CONSTITUTION.md). Your role is to:

- Ratify or reject constitutional amendments
- Review and merge contributions
- Set strategic direction
- Maintain the integrity of the architectural vision

## Branch Protection (Repository Owner)

Enable these settings on your GitHub repository:

- Require pull request reviews before merging
- Require status checks to pass (the constitutional validator)
- Require branches to be up to date before merging
- Restrict who can push to `main` (only founder/admins)

## License

MIT — see [LICENSE](./LICENSE)

## Founder

**Angelo Regalbuto**
Regal Health & Retirement LLC
February 2026

---

*The seed is planted. The architecture enforces itself. Now the agents build.*
