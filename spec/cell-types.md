# Cell Types Specification

**Version 1.0**

## Overview

The Fractal Code cell alphabet consists of exactly four cell types. Every component at every scale must be one of these types. This constraint is inviolable.

## Transformer

**Purpose:** Stateless computation.

A Transformer takes input, produces output, and holds no state between invocations. Given the same input, it always produces the same output.

**Properties:**
- Stateless — no internal mutable state
- Deterministic — same input yields same output
- Composable — Transformers can contain sub-cells (including other Transformers, Keepers, Reactors, and Channels)

**Interface:**
```typescript
interface Transformer<TInput, TOutput> extends Cell {
  cellType: "transformer";
  process(input: TInput): Promise<TOutput>;
}
```

**Examples:** Data parsers, format converters, API endpoint handlers, compilers, validators, calculators.

## Reactor

**Purpose:** Event-driven stimulus and response.

A Reactor listens for events and triggers responses. It is the nervous system of a Fractal Code architecture.

**Properties:**
- Event-driven — activated by external stimuli
- Reactive — produces side effects in response to events
- May maintain minimal internal state for event tracking

**Interface:**
```typescript
interface Reactor<TEvent, TResponse> extends Cell {
  cellType: "reactor";
  on(event: TEvent): Promise<TResponse>;
  listensTo(): string[];
}
```

**Examples:** Webhook handlers, file watchers, schedulers, monitors, notification dispatchers.

## Keeper

**Purpose:** State persistence and management.

A Keeper maintains state over time. It is the memory of the system.

**Properties:**
- Stateful — explicitly manages mutable state
- Persistent — state survives across invocations
- Provides read/write access to its managed state

**Interface:**
```typescript
interface Keeper<TState> extends Cell {
  cellType: "keeper";
  get(): Promise<TState>;
  set(state: TState): Promise<void>;
}
```

**Examples:** Databases, caches, session stores, configuration managers, workflow state machines.

## Channel

**Purpose:** Data transport between cells.

A Channel moves data between cells. It is the only permitted mechanism for inter-cell communication. All sibling cells must communicate through Channels.

**Properties:**
- Mediates all inter-cell communication
- May buffer, transform, or route data in transit
- Stateless from the perspective of the data (does not own the data)

**Interface:**
```typescript
interface Channel<TData> extends Cell {
  cellType: "channel";
  send(data: TData): Promise<void>;
  receive(): Promise<TData>;
}
```

**Examples:** Message queues, event buses, streams, pipes, API gateways, pub/sub systems.

## Type Selection Guide

When determining which cell type to use:

1. Does it compute a result from input without side effects? → **Transformer**
2. Does it react to events or stimuli? → **Reactor**
3. Does it store and retrieve state? → **Keeper**
4. Does it move data between other cells? → **Channel**

If a component seems to need multiple types, decompose it into separate cells connected by Channels.
