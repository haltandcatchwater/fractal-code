# Composition Rules Specification

**Version 1.0**

## Overview

Cells compose fractally. A cell may contain other cells, and from the outside, the composed cell presents the same universal contract as a simple cell. Scale is invisible.

## Rule 1: Cells May Contain Other Cells

Any cell may contain sub-cells of any type. A Transformer may contain Transformers, Reactors, Keepers, and Channels. The same applies to all cell types.

The parent cell is responsible for:
- Wiring its sub-cells together through Channels
- Aggregating health from sub-cells
- Computing its Structural Signature from its own fields plus its children's signatures
- Contributing its sub-cell topology to the context map

## Rule 2: Communication Only Through Channels

**This is inviolable.**

Sibling cells (cells that share the same parent) may ONLY communicate through Channels. No direct references. No shared state. No function calls between siblings.

```
VALID:
  [Transformer A] → [Channel] → [Transformer B]

INVALID:
  [Transformer A] → [Transformer B]  (direct reference)
```

A parent cell may read from its children (to aggregate health, signatures, or context maps), but sibling-to-sibling communication is always mediated by a Channel.

## Rule 3: Composition Does Not Change the Contract

From the outside, a composed cell is indistinguishable from a simple cell. It presents the same universal contract:
- Identity (with its own name and type)
- Input (what the composed system accepts)
- Output (what the composed system produces)
- Health (aggregated from sub-cells)
- Lineage (why the composed system exists)
- Signature (computed from its fields + children's signatures)

## Rule 4: No Side Channels

Any communication path not mediated by a Channel is a constitutional violation:

- No shared global variables
- No shared mutable state between siblings
- No implicit dependencies
- No event systems that bypass Channel mediation
- No direct file system sharing between sibling cells
- No environment variable coupling between siblings

## Validation

The composition check validates:

1. Every sub-cell is registered in its parent's children list
2. Every inter-cell data flow passes through a Channel cell
3. No sibling cell holds a direct reference to another sibling
4. The parent cell's contract is complete and valid regardless of internal composition
5. Health aggregation correctly reflects sub-cell status
