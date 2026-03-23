import chalk from "chalk";
import ora from "ora";
import { select, checkbox, confirm } from "@inquirer/prompts";
import { detectInstalled } from "../detectors/index.ts";
import { setNoSudo } from "../detectors/macos.ts";
import { logger } from "../ui/logger.ts";
import { showUpdateNotice } from "../ui/banner.ts";
import { checkForUpdate } from "../utils/version.ts";
import type { CliOptions, UpdateResult, PackageManager, OutdatedPackage } from "../detectors/types.ts";

export async function updateCommand(options: CliOptions) {
  if (options.noSudo) {
    setNoSudo(true);
  }

  console.log(chalk.bold("\n⬆️  NxtUpdate — Updating your system...\n"));

  const updateInfoPromise = checkForUpdate();

  let managers = await detectInstalled();

  if (options.only) {
    managers = managers.filter(
      (pm) => pm.name.toLowerCase().includes(options.only!.toLowerCase()) ||
              pm.command.toLowerCase() === options.only!.toLowerCase()
    );
    if (managers.length === 0) {
      logger.error(`Package manager "${options.only}" not found.`);
      logger.dim(`Available: ${managers.map((m) => m.name).join(", ")}`);
      return;
    }
  }

  if (managers.length === 0) {
    logger.warn("No package managers detected. Run `nxtupdate scan` to check.");
    return;
  }

  // Scan outdated first
  const spinner = ora({ text: "Scanning for outdated packages...", prefixText: "  " }).start();
  const outdatedMap = new Map<PackageManager, OutdatedPackage[]>();

  for (const pm of managers) {
    try {
      const outdated = await pm.listOutdated();
      outdatedMap.set(pm, outdated);
    } catch {
      outdatedMap.set(pm, []);
    }
  }
  spinner.stop();

  const withOutdated = managers.filter((pm) => (outdatedMap.get(pm)?.length ?? 0) > 0);

  if (withOutdated.length === 0) {
    logger.success("Everything is already up to date! 🎉\n");
    const updateInfo = await updateInfoPromise;
    if (updateInfo?.hasUpdate) showUpdateNotice(updateInfo);
    return;
  }

  // Show summary
  const totalOutdated = withOutdated.reduce((sum, pm) => sum + (outdatedMap.get(pm)?.length ?? 0), 0);
  console.log(chalk.yellow(`  Found ${totalOutdated} outdated package(s) across ${withOutdated.length} manager(s)\n`));

  // Interactive selection
  const choices = withOutdated.map((pm) => ({
    name: `${pm.icon} ${pm.name} (${outdatedMap.get(pm)?.length ?? 0} packages)`,
    value: pm,
    checked: true,
  }));

  if (!options.only && !options.yes && withOutdated.length > 1) {
    const selected = await checkbox({
      message: "Select which managers to update:",
      choices,
    });

    if (selected.length === 0) {
      logger.info("Nothing selected. Exiting.");
      return;
    }

    // Confirm
    const count = selected.reduce((sum: number, pm: PackageManager) => sum + (outdatedMap.get(pm)?.length ?? 0), 0);
    const ok = await confirm({
      message: `Update ${count} package(s) across ${selected.length} manager(s)?`,
      default: true,
    });

    if (!ok) {
      logger.info("Cancelled.");
      return;
    }

    managers = selected;
  } else if (!options.only && !options.yes) {
    const ok = await confirm({
      message: `Update all ${totalOutdated} outdated package(s)?`,
      default: true,
    });
    if (!ok) {
      logger.info("Cancelled.");
      return;
    }
  }

  // Dry run
  if (options.dryRun) {
    console.log(chalk.yellow("\n  ⚡ Dry run mode — nothing will be modified\n"));
  }

  // Run updates
  console.log("");
  const results: UpdateResult[] = [];

  for (const pm of managers) {
    const outdated = outdatedMap.get(pm) ?? [];
    if (outdated.length === 0) continue;

    const updSpinner = ora({
      text: `Updating ${pm.name} (${outdated.length} packages)...`,
      prefixText: "  ",
    }).start();

    try {
      if (options.verbose) {
        updSpinner.stop();
        console.log(chalk.dim(`    Packages: ${outdated.map((p) => p.name).join(", ")}`));
        updSpinner.start();
      }

      const result = await pm.update(options.dryRun);
      results.push(result);

      if (result.success) {
        if (options.dryRun) {
          updSpinner.info(chalk.yellow(`${pm.icon} ${pm.name}`) + chalk.dim(` — ${outdated.length} packages would be updated`));
        } else {
          updSpinner.succeed(chalk.green(`${pm.icon} ${pm.name}`) + chalk.dim(` — ${result.updated} packages updated`));
        }
      } else {
        updSpinner.fail(chalk.red(`${pm.icon} ${pm.name}`) + chalk.dim(` — failed: ${result.error ?? "unknown"}`));
      }
    } catch (err) {
      updSpinner.fail(chalk.red(`${pm.icon} ${pm.name}`) + chalk.dim(` — error: ${err}`));
      results.push({ manager: pm.name, success: false, updated: 0, output: "", error: String(err) });
    }
  }

  // Summary
  console.log("");
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalUpdated = successful.reduce((sum, r) => sum + r.updated, 0);

  if (options.dryRun) {
    logger.info("Dry run complete. Run without --dry-run to apply updates.");
  } else if (totalUpdated > 0) {
    logger.success(`Done! Updated ${totalUpdated} package(s) across ${successful.length} manager(s). 🎉`);
  } else {
    logger.success("Everything is already up to date! 🎉");
  }

  if (failed.length > 0) {
    logger.warn(`${failed.length} manager(s) failed:`);
    for (const f of failed) {
      logger.dim(`  · ${f.manager}: ${f.error}`);
    }
  }

  console.log("");

  const updateInfo = await updateInfoPromise;
  if (updateInfo?.hasUpdate) showUpdateNotice(updateInfo);
}
