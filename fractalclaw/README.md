# FractalClaw — Constitutional Skill Security PoC

OpenClaw (145K+ GitHub stars) has documented security problems: malicious skills exfiltrate data, inject prompts, and escalate privileges. The root cause is zero structural governance — skills are text files loaded with full trust.

**FractalClaw proves Fractal Code solves this** by rebuilding OpenClaw's skill system on constitutional architecture, catching every documented attack vector.

## Attack Vectors Caught

| Attack | How It Works | Caught By | Principle |
|--------|-------------|-----------|-----------|
| **Data Exfiltration** | `fs.readFileSync` + `fetch()` to external URL | Static scanner | III — Channel Isolation |
| **Prompt Injection** | `this.identity = {...}` runtime mutation | Static scanner | II — Universal Contract |
| **Privilege Escalation** | `process.env` + `globalThis` credential theft | Static scanner | III — Channel Isolation |
| **Supply Chain** | Clean logic but forged signature | Signature verification | X — Structural Signature |
| **Stealth Network** | `WebSocket` + `XMLHttpRequest` covert channels | Static scanner | III — Channel Isolation |
| **Budget Bomb** | `complexity_budget: 999999999999` | Budget sanity check | Circuit Breaker |

## How It Works

Every `.fc` skill file passes through five constitutional stages:

```
.fc file → [1] parseFC() → [2] validateCell() → [3] scanLogic() → [4] signature verify → [5] budget checks → ACCEPT or REJECT
```

A skill is **REJECTED** at the first stage that produces violations. Legitimate skills pass all stages. Each malicious skill fails at a specific constitutional principle.

### The Key Insight

The SDK signature is computed from the **contract** (name, type, schemas, lineage), not the **logic body**. This means:
- **Signatures** catch contract-level tampering (supply-chain attacks)
- **Static analysis** catches implementation-level attacks (exfiltration, injection)
- **Circuit breakers** enforce runtime resource limits (budget bombs)

Three layers, zero gaps.

## Running the Demo

```bash
cd fractalclaw
npm install
npm run build
npm run demo
```

### Expected Output

```
═══════════════════════════════════════════════════════
  FractalClaw — Constitutional Skill Loader
═══════════════════════════════════════════════════════

Loading skills...

  ✅ PASS  notes                 [Keeper]       sig:0x73B0...
  ✅ PASS  reminder              [Reactor]      sig:0xA326...
  ✅ PASS  weather-lookup        [Transformer]  sig:0xD32C...

Scanning for threats...

  ❌ REJECTED  budget-bomb
     → Circuit Breaker: complexity_budget 999999999999 exceeds safe maximum

  ❌ REJECTED  data-exfiltration
     → Principle III: fetch() detected — undeclared network access
     → Principle III: fs.readFileSync detected — filesystem side channel

  ❌ REJECTED  privilege-escalation
     → Principle III: process.env detected — undeclared external data
     → Principle III: globalThis detected — shared global state access

  ❌ REJECTED  prompt-injection
     → Principle II: identity mutation detected — violates immutable contract

  ❌ REJECTED  stealth-network
     → Principle III: XMLHttpRequest detected — undeclared network access
     → Principle III: WebSocket detected — undeclared persistent connection

  ❌ REJECTED  supply-chain
     → Principle X: Signature mismatch — declared deadbeefdeadbeef... != computed fe42159f...

Circuit Breaker enforcement...

  ✓ Call 1: budget 3 → 2
  ✓ Call 2: budget 2 → 1
  ✓ Call 3: budget 1 → 0
  🛑 Call 4: BLOCKED — complexity budget exhausted, cell in safe-mode

═══════════════════════════════════════════════════════
  Results: 3 loaded  |  6 rejected  |  9 violations caught
  Constitutional integrity: ENFORCED
═══════════════════════════════════════════════════════
```

## Project Structure

```
fractalclaw/
├── src/
│   ├── demo.ts              # Entry point — orchestrates the full demo
│   ├── skill-loader.ts      # Constitutional skill loading pipeline
│   ├── skill-scanner.ts     # Static analysis of logic bodies
│   └── skill-executor.ts    # Circuit breaker runtime enforcement demo
├── demos/
│   ├── legitimate/          # 3 clean skills that pass all checks
│   │   ├── weather-lookup.transformer.fc
│   │   ├── reminder.reactor.fc
│   │   └── notes.keeper.fc
│   └── malicious/           # 6 attack skills, each caught by a different principle
│       ├── data-exfiltration.transformer.fc
│       ├── prompt-injection.transformer.fc
│       ├── privilege-escalation.transformer.fc
│       ├── supply-chain.transformer.fc
│       ├── stealth-network.transformer.fc
│       └── budget-bomb.transformer.fc
├── types/                   # JSON Schema definitions for skill contracts
├── spec/
│   └── skill-manifest.md    # How OpenClaw skills map to Fractal Cells
├── fractal.json             # Project marker
├── package.json
└── tsconfig.json
```

## Related

- [Fractal Code SDK](../sdk/) — Cell classes and signature computation
- [Fractal Code Parser](../parser/) — `.fc` file parsing and validation
- [Fractal Code Validator](../validator/) — Runtime constitutional validation
- [Constitution](../CONSTITUTION.md) — The 11 Inviolable Principles
