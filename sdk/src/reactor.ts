import type {
  CellConfig,
  CellHealth,
  CellIdentity,
  CellInput,
  CellOutput,
  CellLineage,
  CellSignature,
  ContextMapEntry,
  UniversalContract,
} from "./contract";
import { DEFAULT_COMPLEXITY_BUDGET } from "./contract";
import { computeLeafSignature, computeComposedSignature } from "./signature";

export interface ReactorConfig<TEvent, TResponse> extends CellConfig {
  on: (event: TEvent) => Promise<TResponse>;
  listensTo: string[];
  children?: UniversalContract[];
  complexityBudget?: number;
}

export class Reactor<TEvent = unknown, TResponse = unknown> implements UniversalContract {
  readonly identity: CellIdentity;
  readonly input: CellInput;
  readonly output: CellOutput;
  readonly lineage: CellLineage;
  signature: CellSignature;

  private readonly _on: (event: TEvent) => Promise<TResponse>;
  private readonly _listensTo: string[];
  private readonly _children: UniversalContract[];
  private readonly _parent?: string;
  private _complexityBudget: number;
  private readonly _maxBudget: number;

  constructor(config: ReactorConfig<TEvent, TResponse>) {
    this.identity = { name: config.name, cellType: "reactor", version: config.version };
    this.input = config.input;
    this.output = config.output;
    this.lineage = config.lineage;
    this._on = config.on;
    this._listensTo = config.listensTo;
    this._children = config.children ?? [];
    this._parent = config.parent;
    this._maxBudget = config.complexityBudget ?? DEFAULT_COMPLEXITY_BUDGET;
    this._complexityBudget = this._maxBudget;

    this.signature = { hash: "0".repeat(64), timestamp: new Date().toISOString() };
    this.signature = this.computeSignature();
  }

  /** Handle an event. Decrements complexity budget; enters Safe-Mode at zero. */
  async on(event: TEvent): Promise<TResponse> {
    if (this._complexityBudget <= 0) {
      throw new Error(`[Circuit Breaker] Reactor "${this.identity.name}" is in Safe-Mode — complexity budget exhausted`);
    }
    this._complexityBudget--;
    return this._on(event);
  }

  listensTo(): string[] {
    return this._listensTo;
  }

  /** Reset the circuit breaker budget to its initial value. */
  resetBudget(): void {
    this._complexityBudget = this._maxBudget;
  }

  get budgetRemaining(): number {
    return this._complexityBudget;
  }

  health(): CellHealth {
    const inSafeMode = this._complexityBudget <= 0;
    if (this._children.length === 0) {
      return {
        status: inSafeMode ? "safe-mode" : "healthy",
        budgetRemaining: this._complexityBudget,
      };
    }
    const childHealth: Record<string, CellHealth> = {};
    for (const child of this._children) {
      childHealth[child.identity.name] = child.health();
    }
    const statuses = Object.values(childHealth).map((h) => h.status);
    const status = inSafeMode
      ? "safe-mode"
      : statuses.includes("unhealthy")
        ? "unhealthy"
        : statuses.includes("degraded") || statuses.includes("safe-mode")
          ? "degraded"
          : "healthy";
    return { status, budgetRemaining: this._complexityBudget, children: childHealth };
  }

  toMap(): ContextMapEntry {
    return {
      identity: this.identity,
      parent: this._parent,
      children: this._children.map((c) => c.identity.name),
      channels: this._children
        .filter((c) => c.identity.cellType === "channel")
        .map((c) => c.identity.name),
      signature: this.signature.hash,
    };
  }

  getChildren(): UniversalContract[] {
    return this._children;
  }

  private computeSignature(): CellSignature {
    if (this._children.length === 0) {
      return computeLeafSignature(this);
    }
    return computeComposedSignature(
      this,
      this._children.map((c) => c.signature),
    );
  }
}
