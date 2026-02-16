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
import { computeLeafSignature, computeComposedSignature } from "./signature";

export interface KeeperConfig<TState> extends CellConfig {
  initialState: TState;
  children?: UniversalContract[];
}

export class Keeper<TState = unknown> implements UniversalContract {
  readonly identity: CellIdentity;
  readonly input: CellInput;
  readonly output: CellOutput;
  readonly lineage: CellLineage;
  signature: CellSignature;

  private _state: TState;
  private readonly _children: UniversalContract[];
  private readonly _parent?: string;

  constructor(config: KeeperConfig<TState>) {
    this.identity = { name: config.name, cellType: "keeper", version: config.version };
    this.input = config.input;
    this.output = config.output;
    this.lineage = config.lineage;
    this._state = config.initialState;
    this._children = config.children ?? [];
    this._parent = config.parent;

    this.signature = { hash: "0".repeat(64), timestamp: new Date().toISOString() };
    this.signature = this.computeSignature();
  }

  async get(): Promise<TState> {
    return this._state;
  }

  async set(state: TState): Promise<void> {
    this._state = state;
  }

  health(): CellHealth {
    if (this._children.length === 0) {
      return { status: "healthy" };
    }
    const childHealth: Record<string, CellHealth> = {};
    for (const child of this._children) {
      childHealth[child.identity.name] = child.health();
    }
    const statuses = Object.values(childHealth).map((h) => h.status);
    const status = statuses.includes("unhealthy")
      ? "unhealthy"
      : statuses.includes("degraded")
        ? "degraded"
        : "healthy";
    return { status, children: childHealth };
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
