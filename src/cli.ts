#!/usr/bin/env bun

import { Command } from "commander";
import { showBanner } from "./ui/banner.ts";
import { scanCommand } from "./commands/scan.ts";
import { listCommand } from "./commands/list.ts";
import { updateCommand } from "./commands/update.ts";
import { launchTUI } from "./tui/app.tsx";
import { VERSION } from "./utils/version.ts";

const program = new Command();

program
  .name("nxtupdate")
  .description("⬆️  Universal macOS package updater — auto-detects and updates everything")
  .version(VERSION);

program
  .command("tui")
  .description("Launch interactive TUI")
  .option("-d, --dry-run", "Start in dry-run mode")
  .option("--no-sudo", "Skip updates that require sudo")
  .action(async (opts) => {
    launchTUI(opts);
  });

program
  .command("update")
  .description("Auto-detect and update all packages")
  .option("-o, --only <manager>", "Update only a specific manager (e.g. homebrew, npm)")
  .option("-d, --dry-run", "Show what would be updated without making changes")
  .option("--no-sudo", "Skip updates that require sudo")
  .option("-v, --verbose", "Show detailed output")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(async (opts) => {
    showBanner();
    await updateCommand(opts);
  });

program
  .command("scan")
  .description("Detect installed package managers")
  .action(async () => {
    showBanner();
    await scanCommand();
  });

program
  .command("list")
  .description("List outdated packages")
  .option("-o, --only <manager>", "List only for a specific manager")
  .option("-y, --yes", "Skip interactive selection")
  .action(async (opts) => {
    showBanner();
    await listCommand(opts);
  });

// Default: launch TUI
program.action(() => {
  launchTUI({});
});

program.parse();
