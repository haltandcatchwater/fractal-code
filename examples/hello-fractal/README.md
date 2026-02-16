# Hello Fractal

A minimal reference application demonstrating the Fractal Code architecture.

## What It Does

A simple greeting system that demonstrates all four cell types:

1. **request.reactor** — Listens for incoming greeting requests
2. **greeter.transformer** — Transforms a name into a greeting message (stateless)
3. **memory.keeper** — Stores a history of all greetings produced
4. **pipe.channel** — Mediates all communication between sibling cells

The **app** root cell composes these four cells and orchestrates the flow:
`Request → Channel → Greeter → Channel → Memory`

## Running

```bash
# Build the SDK first
cd ../../sdk && npm install && npm run build && cd -

# Build and run
npm install && npm run build && npm start
```

## Architecture

```
app (Transformer — root cell)
├── request (Reactor — listens for greeting events)
├── pipe (Channel — mediates all sibling communication)
├── greeter (Transformer — pure computation)
└── memory (Keeper — stores greeting history)
```

Every cell implements the full universal contract. The context map can be printed to show the complete topology.
