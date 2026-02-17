#!/usr/bin/env node

/**
 * FractalClaw CLI — Constitutional Skill Security Tool
 *
 * Commands:
 *   scan    Scan .fc files for constitutional violations
 *   sign    Compute and verify structural signatures
 *   init    Create a new .fc skill template
 *   verify  Deep verification of a single .fc file
 */

import { Command } from "commander";
import { scanCommand } from "./commands/scan";
import { signCommand } from "./commands/sign";
import { initCommand } from "./commands/init";
import { verifyCommand } from "./commands/verify";

const program = new Command();

program
  .name("fractalclaw")
  .description("Constitutional skill security scanner for Fractal Code")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan .fc files for constitutional violations")
  .argument("[directory]", "Directory to scan", ".")
  .option("--json", "Output results as JSON")
  .option("--verbose", "Show all checks for passing files")
  .option("--no-recursive", "Disable directory recursion")
  .action(scanCommand);

program
  .command("sign")
  .description("Compute and verify structural signatures")
  .argument("<path>", "File or directory to sign")
  .option("-w, --write", "Write computed signature into the file(s)")
  .action(signCommand);

program
  .command("init")
  .description("Create a new .fc skill template")
  .argument("[name]", "Skill name", "new-skill")
  .action(initCommand);

program
  .command("verify")
  .description("Deep verification of a single .fc file")
  .argument("<file>", "Path to .fc file")
  .action(verifyCommand);

program.parse();
