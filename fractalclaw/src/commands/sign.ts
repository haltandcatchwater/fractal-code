/**
 * FractalClaw — sign command
 *
 * Computes and verifies structural signatures for .fc files.
 * Can optionally write the computed signature back into the file.
 *
 * Usage:
 *   fractalclaw sign <path>          Verify signatures
 *   fractalclaw sign <path> -w       Compute and write signatures
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  statSync,
} from "fs";
import { join, resolve, basename } from "path";
import { computeSignature, findProjectRoot } from "../signer";

// ── File Discovery ──────────────────────────────────────────────────────

/**
 * Recursively discover all .fc files starting from `dir`.
 */
function discoverFcFiles(dir: string): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isFile() && entry.endsWith(".fc")) {
      results.push(fullPath);
    } else if (stat.isDirectory()) {
      results.push(...discoverFcFiles(fullPath));
    }
  }

  return results.sort();
}

// ── Display Helpers ─────────────────────────────────────────────────────

/**
 * Format a hex hash for display: "0x" + first 16 hex chars + "..."
 */
function formatHash(hash: string): string {
  const hex = hash.startsWith("0x") ? hash.slice(2) : hash;
  return `0x${hex.slice(0, 16)}...`;
}

// ── Main Command ────────────────────────────────────────────────────────

export function signCommand(
  pathArg: string,
  options: { write?: boolean }
): void {
  const resolvedPath = resolve(pathArg);

  // Determine which files to process
  let files: string[];

  if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
    files = discoverFcFiles(resolvedPath);
  } else if (
    existsSync(resolvedPath) &&
    statSync(resolvedPath).isFile()
  ) {
    files = [resolvedPath];
  } else {
    console.error(`Path not found: ${resolvedPath}`);
    process.exit(1);
    return;
  }

  if (files.length === 0) {
    console.log("No .fc files found.");
    return;
  }

  // Find the project root from the first file
  const projectRoot = findProjectRoot(
    statSync(resolvedPath).isDirectory() ? resolvedPath : files[0]
  );

  let totalChecked = 0;
  let totalValid = 0;
  let totalUpdated = 0;

  for (const filePath of files) {
    const fileName = basename(filePath);

    try {
      const result = computeSignature(filePath, projectRoot);
      totalChecked++;

      const computedDisplay = formatHash(result.computed);

      // Normalize declared signature for comparison (strip optional 0x prefix)
      const normalizedDeclared = result.declared.startsWith("0x")
        ? result.declared.slice(2)
        : result.declared;
      const isValid = normalizedDeclared === result.computed;

      const declaredDisplay = formatHash(result.declared);

      console.log(`File: ${fileName}`);
      console.log(`Computed signature: ${computedDisplay}`);
      console.log(`Current signature:  ${declaredDisplay}`);

      if (isValid) {
        console.log("Status: \u2705 Signature is valid");
        totalValid++;
      } else {
        console.log("Status: \u26A0\uFE0F  Signature needs updating");
      }

      // Write mode: update the file in place
      if (options.write && !isValid) {
        const fileContent = readFileSync(filePath, "utf-8");
        const signatureRegex = /^(\s*)signature:\s*.+$/m;

        if (signatureRegex.test(fileContent)) {
          const updatedContent = fileContent.replace(
            signatureRegex,
            `$1signature: "${result.computed}"`
          );
          writeFileSync(filePath, updatedContent, "utf-8");
          console.log(`\u2705 Signature written to ${fileName}`);
          totalUpdated++;
        } else {
          console.log(
            `Warning: Could not find signature line in ${fileName}`
          );
        }
      }

      console.log("");
    } catch (err) {
      console.error(`Error processing ${fileName}: ${(err as Error).message}`);
      console.log("");
    }
  }

  // Summary
  console.log(
    `${totalChecked} files checked, ${totalValid} valid, ${totalUpdated} updated`
  );
}
