# Fractal Code SDK

Base classes for building Fractal Code cells with universal contract enforcement.

## Installation

```bash
npm install @fractal-code/sdk
```

## Usage

```typescript
import { Transformer, Reactor, Keeper, Channel } from "@fractal-code/sdk";

// Create a Transformer
const greeter = new Transformer({
  name: "greeter",
  version: "1.0.0",
  input: { schema: { type: "string" }, description: "A name to greet" },
  output: { schema: { type: "string" }, description: "A greeting message" },
  lineage: {
    reason: "Demonstrates basic Transformer usage",
    creator: "agent/claude",
    createdAt: new Date().toISOString(),
  },
  process: async (name: string) => `Hello, ${name}!`,
});
```

## Cell Types

- **Transformer** — Stateless computation (input → output)
- **Reactor** — Event-driven (listens → responds)
- **Keeper** — State management (get/set persistent state)
- **Channel** — Data transport (send/receive between cells)

## Universal Contract

Every cell automatically enforces:
- Identity, Input, Output, Health, Lineage, Signature
- Structural Signatures auto-compute on creation
- Health reporting built in
- Context map via `toMap()`

## Composition

```typescript
const app = new Transformer({
  name: "app",
  // ... contract fields ...
  children: [greeter, logger, pipe],
  process: async (input) => { /* orchestrate children */ },
});
```

Children are wired through Channels. The parent's signature incorporates all child signatures.
