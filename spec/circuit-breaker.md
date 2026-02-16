# Circuit Breaker Specification

**Version 1.0**

## Overview

To prevent infinite recursion in agent-generated code, every cell must implement a mandatory complexity budget (TTL). This is the immune system of the architecture.

## The Problem

AI agents generating code can inadvertently create recursive loops — a Transformer that calls itself, a Reactor that triggers its own event, or a composition chain that cycles. In human-authored code, developers catch these during debugging. In an agent-authored system, the architecture must catch them automatically.

## The Mechanism

### Complexity Budget

Every Transformer and Reactor cell accepts a `complexity_budget` parameter (defaulting to 1000 if not specified). This budget represents the maximum number of execution cycles the cell may perform before entering Safe-Mode.

```typescript
interface CircuitBreakerConfig {
  complexityBudget?: number;  // Default: 1000
}
```

### Budget Decrement

On every execution cycle:
- **Transformer:** Each call to `process()` decrements the budget by 1
- **Reactor:** Each call to `on()` decrements the budget by 1

### Safe-Mode

When the budget reaches zero:
1. The cell's `health()` status automatically degrades to `"safe-mode"`
2. Further execution attempts throw a descriptive error
3. The cell remains in Safe-Mode until explicitly reset via `resetBudget()`

```typescript
// Safe-Mode error example:
// [Circuit Breaker] Transformer "parser" is in Safe-Mode — complexity budget exhausted
```

### Budget Reset

Cells provide a `resetBudget()` method that restores the budget to its initial value. This is intended for use by orchestration layers or parent cells that can determine it is safe to continue.

```typescript
cell.resetBudget();  // Restores to initial complexityBudget value
```

## Health Reporting

The circuit breaker integrates with the health system:

```typescript
interface CellHealth {
  status: "healthy" | "degraded" | "unhealthy" | "safe-mode";
  budgetRemaining?: number;
  children?: Record<string, CellHealth>;
}
```

- `"healthy"` — Budget has significant remaining capacity
- `"degraded"` — Budget is running low or a child is in safe-mode
- `"safe-mode"` — Budget exhausted, cell will not execute

## Applicability

| Cell Type | Circuit Breaker Required? |
|-----------|--------------------------|
| **Transformer** | Yes — decrements on `process()` |
| **Reactor** | Yes — decrements on `on()` |
| **Keeper** | No — state operations are not recursive by nature |
| **Channel** | No — data transport is not recursive by nature |

## Validation

The constitutional validator checks:
1. Every Transformer and Reactor cell has a `budgetRemaining` property
2. The `health()` method returns `budgetRemaining` in its output
3. The cell correctly enters Safe-Mode when budget is exhausted
