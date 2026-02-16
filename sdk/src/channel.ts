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

export interface ChannelConfig<TData> extends CellConfig {
  bufferSize?: number;
  children?: UniversalContract[];
}

export class Channel<TData = unknown> implements UniversalContract {
  readonly identity: CellIdentity;
  readonly input: CellInput;
  readonly output: CellOutput;
  readonly lineage: CellLineage;
  signature: CellSignature;

  private readonly _buffer: TData[];
  private readonly _bufferSize: number;
  private readonly _children: UniversalContract[];
  private readonly _parent?: string;

  constructor(config: ChannelConfig<TData>) {
    this.identity = { name: config.name, cellType: "channel", version: config.version };
    this.input = config.input;
    this.output = config.output;
    this.lineage = config.lineage;
    this._buffer = [];
    this._bufferSize = config.bufferSize ?? 100;
    this._children = config.children ?? [];
    this._parent = config.parent;

    this.signature = { hash: "0".repeat(64), timestamp: new Date().toISOString() };
    this.signature = this.computeSignature();
  }

  async send(data: TData): Promise<void> {
    if (this._buffer.length >= this._bufferSize) {
      throw new Error(`Channel "${this.identity.name}" buffer full (max ${this._bufferSize})`);
    }
    this._buffer.push(data);
  }

  async receive(): Promise<TData> {
    const item = this._buffer.shift();
    if (item === undefined) {
      throw new Error(`Channel "${this.identity.name}" buffer empty`);
    }
    return item;
  }

  peek(): TData | undefined {
    return this._buffer[0];
  }

  get length(): number {
    return this._buffer.length;
  }

  health(): CellHealth {
    const utilization = this._buffer.length / this._bufferSize;
    if (this._children.length === 0) {
      return {
        status: utilization > 0.9 ? "degraded" : "healthy",
        message: `Buffer: ${this._buffer.length}/${this._bufferSize}`,
      };
    }
    const childHealth: Record<string, CellHealth> = {};
    for (const child of this._children) {
      childHealth[child.identity.name] = child.health();
    }
    const statuses = Object.values(childHealth).map((h) => h.status);
    const status = statuses.includes("unhealthy")
      ? "unhealthy"
      : statuses.includes("degraded") || utilization > 0.9
        ? "degraded"
        : "healthy";
    return { status, message: `Buffer: ${this._buffer.length}/${this._bufferSize}`, children: childHealth };
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
