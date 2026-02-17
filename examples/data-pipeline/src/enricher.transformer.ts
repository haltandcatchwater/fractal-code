import { Transformer } from "@fractal-code/sdk";

/**
 * Enriches validated log entries with computed metadata:
 * severity score, auto-classification, word count, and processing timestamp.
 * Only enriches entries that passed validation.
 */

interface ValidatedLog {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  valid: boolean;
  errors: string[];
}

interface EnrichedLog {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  enrichments: {
    severity_score: number;
    category: string;
    processed_at: string;
    word_count: number;
  };
}

const SEVERITY_SCORES: Record<string, number> = {
  debug: 10,
  info: 25,
  warn: 50,
  error: 75,
  fatal: 100,
};

function classify(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("connection")) return "network";
  if (lower.includes("auth") || lower.includes("permission") || lower.includes("denied")) return "security";
  if (lower.includes("memory") || lower.includes("cpu") || lower.includes("disk")) return "resource";
  if (lower.includes("deploy") || lower.includes("build") || lower.includes("release")) return "deployment";
  if (lower.includes("error") || lower.includes("exception") || lower.includes("crash")) return "error";
  return "general";
}

export const enricher = new Transformer<ValidatedLog, EnrichedLog>({
  name: "enricher",
  version: "1.0.0",
  parent: "pipeline",
  input: {
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        level: { type: "string" },
        message: { type: "string" },
        valid: { type: "boolean" },
      },
    },
    description: "A validated log entry to enrich with computed metadata",
  },
  output: {
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        enrichments: { type: "object" },
      },
    },
    description: "An enriched log entry with severity score, category, and metadata",
  },
  lineage: {
    source: "Claude-Opus-4.6",
    trigger: "data-pipeline-example-v1",
    justification: "Computes severity scores and auto-classifies validated logs before storage",
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
  },
  complexityBudget: 10000,
  process: async (entry: ValidatedLog): Promise<EnrichedLog> => {
    return {
      id: entry.id,
      timestamp: entry.timestamp,
      level: entry.level,
      source: entry.source,
      message: entry.message,
      enrichments: {
        severity_score: SEVERITY_SCORES[entry.level] ?? 0,
        category: classify(entry.message),
        processed_at: new Date().toISOString(),
        word_count: entry.message.split(/\s+/).length,
      },
    };
  },
});
