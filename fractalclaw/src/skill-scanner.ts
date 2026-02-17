/**
 * FractalClaw — Static Logic Body Scanner
 *
 * Scans logic bodies (process, on, get, set) for banned patterns
 * that violate constitutional principles. This is the static analysis
 * layer — it catches implementation-level attacks that signatures
 * (which only cover the contract) cannot detect.
 */

export interface ScanViolation {
  pattern: string;
  principle: string;
  message: string;
}

export interface ScanResult {
  cellName: string;
  passed: boolean;
  violations: ScanViolation[];
}

interface BannedPattern {
  regex: RegExp;
  principle: string;
  label: string;
  message: string;
}

const BANNED_PATTERNS: BannedPattern[] = [
  // Principle III — Undeclared network access
  {
    regex: /\bfetch\s*\(/,
    principle: "III",
    label: "fetch()",
    message: "fetch() detected — undeclared network access",
  },
  {
    regex: /\bXMLHttpRequest\b/,
    principle: "III",
    label: "XMLHttpRequest",
    message: "XMLHttpRequest detected — undeclared network access",
  },
  {
    regex: /new\s+WebSocket\s*\(/,
    principle: "III",
    label: "WebSocket",
    message: "WebSocket detected — undeclared persistent connection",
  },

  // Principle III — Filesystem side channel
  {
    regex: /\bfs\.\w+/,
    principle: "III",
    label: "fs.*",
    message: "fs.readFileSync detected — filesystem side channel",
  },
  {
    regex: /require\s*\(\s*['"]fs['"]\s*\)/,
    principle: "III",
    label: "require('fs')",
    message: "require('fs') detected — filesystem side channel",
  },

  // Principle III — Code injection
  {
    regex: /\beval\s*\(/,
    principle: "III",
    label: "eval()",
    message: "eval() detected — code injection vector",
  },
  {
    regex: /new\s+Function\s*\(/,
    principle: "III",
    label: "new Function()",
    message: "new Function() detected — code injection vector",
  },

  // Principle III — Undeclared external data
  {
    regex: /\bprocess\.env\b/,
    principle: "III",
    label: "process.env",
    message: "process.env detected — undeclared external data",
  },

  // Principle III — Shared global state
  {
    regex: /\bglobalThis\b/,
    principle: "III",
    label: "globalThis",
    message: "globalThis detected — shared global state access",
  },
  {
    regex: /\bglobal\[/,
    principle: "III",
    label: "global[]",
    message: "global[] detected — shared global state access",
  },

  // Principle II — Contract mutation
  {
    regex: /this\.identity\s*=/,
    principle: "II",
    label: "identity mutation",
    message: "identity mutation detected — violates immutable contract",
  },

  // Principle III — Obfuscation / encoding tricks
  {
    regex: /\batob\s*\(/,
    principle: "III",
    label: "atob()",
    message: "atob() detected — base64 decode can hide banned patterns",
  },
  {
    regex: /\bbtoa\s*\(/,
    principle: "III",
    label: "btoa()",
    message: "btoa() detected — base64 encode enables data exfiltration encoding",
  },
  {
    regex: /Buffer\.from\s*\([\s\S]*?(['"]base64['"])/,
    principle: "III",
    label: "Buffer.from(base64)",
    message: "Buffer.from(…, 'base64') detected — Node base64 decode can hide banned patterns",
  },
  {
    regex: /\bFunction\s*\(\s*`/,
    principle: "III",
    label: "Function() template literal",
    message: "Function() with template literal detected — code injection vector",
  },
  {
    regex: /\brequire\s*\(\s*[^'"]/,
    principle: "III",
    label: "dynamic require()",
    message: "dynamic require() detected — variable module loading bypasses static analysis",
  },
  {
    regex: /\bimport\s*\(/,
    principle: "III",
    label: "dynamic import()",
    message: "dynamic import() detected — loads arbitrary modules at runtime",
  },
  {
    regex: /\\x[0-9a-fA-F]{2}/,
    principle: "III",
    label: "hex escape",
    message: "hex escape (\\x..) detected — can hide banned keywords character by character",
  },
  {
    regex: /\\u[0-9a-fA-F]{4}/,
    principle: "III",
    label: "unicode escape",
    message: "unicode escape (\\u....) detected — can hide banned keywords character by character",
  },
];

/**
 * Scan all logic bodies in a cell for banned patterns.
 */
export function scanLogicBody(
  cellName: string,
  logic: { process?: string; on?: string; get?: string; set?: string; delete?: string } | null,
): ScanResult {
  if (!logic) {
    return { cellName, passed: true, violations: [] };
  }

  const violations: ScanViolation[] = [];
  const bodies = [logic.process, logic.on, logic.get, logic.set, logic.delete].filter(Boolean) as string[];
  const combined = bodies.join("\n");

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.regex.test(combined)) {
      violations.push({
        pattern: pattern.label,
        principle: pattern.principle,
        message: pattern.message,
      });
    }
  }

  return {
    cellName,
    passed: violations.length === 0,
    violations,
  };
}
