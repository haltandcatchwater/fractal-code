import { Transformer } from "@fractal-code/sdk";

/**
 * Validates raw log entries — checks required fields, normalizes levels,
 * and assigns a unique ID. Invalid entries are flagged but still passed
 * through so the pipeline can track rejection rates.
 */

interface RawLogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface ValidatedLog {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  valid: boolean;
  errors: string[];
}

const VALID_LEVELS = ["debug", "info", "warn", "error", "fatal"];

let idCounter = 0;

export const validator = new Transformer<RawLogEntry, ValidatedLog>({
  name: "validator",
  version: "1.0.0",
  parent: "pipeline",
  input: {
    schema: {
      type: "object",
      properties: {
        timestamp: { type: "string" },
        level: { type: "string" },
        source: { type: "string" },
        message: { type: "string" },
      },
    },
    description: "A raw log entry to validate",
  },
  output: {
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        timestamp: { type: "string" },
        level: { type: "string" },
        source: { type: "string" },
        message: { type: "string" },
        valid: { type: "boolean" },
        errors: { type: "array" },
      },
    },
    description: "A validated log entry with ID and validation status",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "data-pipeline-example-v1",
    justification: "Validates and normalizes raw log entries before enrichment",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  complexityBudget: 10000,
  process: async (entry: RawLogEntry): Promise<ValidatedLog> => {
    const errors: string[] = [];

    // Validate timestamp
    const date = new Date(entry.timestamp);
    if (isNaN(date.getTime())) {
      errors.push(`Invalid timestamp: "${entry.timestamp}"`);
    }

    // Normalize and validate level
    const normalizedLevel = entry.level.toLowerCase().trim();
    if (!VALID_LEVELS.includes(normalizedLevel)) {
      errors.push(`Invalid level: "${entry.level}". Must be one of: ${VALID_LEVELS.join(", ")}`);
    }

    // Validate source
    if (!entry.source || entry.source.trim().length === 0) {
      errors.push("Empty source field");
    }

    // Validate message
    if (!entry.message || entry.message.trim().length === 0) {
      errors.push("Empty message field");
    }

    // Assign unique ID
    idCounter++;
    const id = `log-${idCounter.toString().padStart(6, "0")}`;

    return {
      id,
      timestamp: isNaN(date.getTime()) ? entry.timestamp : date.toISOString(),
      level: normalizedLevel,
      source: entry.source.trim(),
      message: entry.message.trim(),
      valid: errors.length === 0,
      errors,
    };
  },
});
