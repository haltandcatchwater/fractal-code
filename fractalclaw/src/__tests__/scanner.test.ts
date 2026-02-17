import { describe, it, expect } from "vitest";
import { scanLogicBody } from "../skill-scanner";

/** Helper — scan a single process body and return the result */
function scan(code: string) {
  return scanLogicBody("test-cell", { process: code });
}

/** Helper — assert a scan fails with a specific pattern label */
function expectViolation(code: string, label: string) {
  const result = scan(code);
  expect(result.passed).toBe(false);
  const labels = result.violations.map((v) => v.pattern);
  expect(labels).toContain(label);
}

/** Helper — assert a scan passes cleanly */
function expectClean(code: string) {
  const result = scan(code);
  expect(result.passed).toBe(true);
  expect(result.violations).toHaveLength(0);
}

// ─── Existing Patterns (regression) ─────────────────────────────────────

describe("existing patterns", () => {
  it("detects fetch()", () => {
    expectViolation(`fetch('https://evil.com')`, "fetch()");
  });

  it("detects XMLHttpRequest", () => {
    expectViolation(`const xhr = new XMLHttpRequest()`, "XMLHttpRequest");
  });

  it("detects WebSocket", () => {
    expectViolation(`const ws = new WebSocket('wss://evil.com')`, "WebSocket");
  });

  it("detects fs.*", () => {
    expectViolation(`fs.readFileSync('/etc/passwd')`, "fs.*");
  });

  it("detects require('fs')", () => {
    expectViolation(`require('fs')`, "require('fs')");
  });

  it("detects eval()", () => {
    expectViolation(`eval('alert(1)')`, "eval()");
  });

  it("detects new Function()", () => {
    expectViolation(`new Function('return 1')`, "new Function()");
  });

  it("detects process.env", () => {
    expectViolation(`const key = process.env.SECRET`, "process.env");
  });

  it("detects globalThis", () => {
    expectViolation(`globalThis.secret = 1`, "globalThis");
  });

  it("detects global[]", () => {
    expectViolation(`global['secret'] = 1`, "global[]");
  });

  it("detects identity mutation", () => {
    expectViolation(`this.identity = { name: 'evil' }`, "identity mutation");
  });
});

// ─── Obfuscation Patterns ───────────────────────────────────────────────

describe("obfuscation patterns", () => {
  it("detects atob()", () => {
    expectViolation(`const cmd = atob('ZmV0Y2g=')`, "atob()");
  });

  it("detects btoa()", () => {
    expectViolation(`const encoded = btoa(secrets)`, "btoa()");
  });

  it("detects Buffer.from(…, 'base64')", () => {
    expectViolation(
      `const decoded = Buffer.from(encoded, 'base64').toString()`,
      "Buffer.from(base64)",
    );
  });

  it("detects Function() template literal", () => {
    expectViolation(
      "const fn = Function(`return process.env.SECRET`)",
      "Function() template literal",
    );
  });

  it("detects dynamic require()", () => {
    expectViolation(`const mod = require(moduleName)`, "dynamic require()");
  });

  it("detects dynamic import()", () => {
    expectViolation(`const mod = await import('./secret')`, "dynamic import()");
  });

  it("detects hex escapes", () => {
    expectViolation(`const x = "\\x66\\x65\\x74\\x63\\x68"`, "hex escape");
  });

  it("detects unicode escapes", () => {
    expectViolation(
      `const x = "\\u0066\\u0065\\u0074\\u0063\\u0068"`,
      "unicode escape",
    );
  });
});

// ─── Clean Code (false positive checks) ─────────────────────────────────

describe("clean code", () => {
  it("allows require() with a string literal", () => {
    expectClean(`const lodash = require('lodash')`);
  });

  it("allows normal variable names containing 'base64'", () => {
    expectClean(`const base64String = "abc123"`);
  });

  it("allows normal function calls", () => {
    expectClean(`const result = transform(input)`);
  });

  it("allows string containing the word 'fetch' without call parens", () => {
    expectClean(`const msg = "will fetch later"`);
  });

  it("allows normal object property access", () => {
    expectClean(`const val = obj.property`);
  });

  it("allows null logic body", () => {
    const result = scanLogicBody("test-cell", null);
    expect(result.passed).toBe(true);
  });

  it("allows empty logic body", () => {
    const result = scanLogicBody("test-cell", {});
    expect(result.passed).toBe(true);
  });

  it("allows arithmetic and simple logic", () => {
    expectClean(`
      const sum = a + b;
      const product = a * b;
      if (sum > 10) return product;
      return sum;
    `);
  });
});
