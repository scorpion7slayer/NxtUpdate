import chalk from "chalk";
import { checkbox } from "@inquirer/prompts";
import { detectInstalled } from "../detectors/index.ts";
import { fetchPaths } from "../utils/paths.ts";
import { logger } from "../ui/logger.ts";
import type { CliOptions } from "../detectors/types.ts";

export async function listCommand(options: CliOptions = {}) {
  console.log(chalk.bold("\n📋 Checking for outdated packages...\n"));

  let managers = options.only
    ? (await detectInstalled()).filter(
        (pm) => pm.name.toLowerCase().includes(options.only!.toLowerCase()) ||
                pm.command.toLowerCase() === options.only!.toLowerCase()
      )
    : await detectInstalled();

  if (managers.length === 0) {
    logger.warn(options.only ? `Package manager "${options.only}" not found.` : "No package managers detected.");
    return;
  }

  if (!options.only && !options.yes && managers.length > 1) {
    const selected = await checkbox({
      message: "Select managers to check:",
      choices: managers.map((pm) => ({
        name: `${pm.icon} ${pm.name}`,
        value: pm,
        checked: true,
      })),
    });
    if (selected.length === 0) {
      logger.info("Nothing selected. Exiting.");
      return;
    }
    managers = selected;
  }

  let totalOutdated = 0;

  for (const pm of managers) {
    try {
      const outdated = await pm.listOutdated();
      if (outdated.length > 0) {
        // Fetch paths
        const paths = await fetchPaths(pm.name, outdated);
        for (const pkg of outdated) {
          pkg.path = paths.get(pkg.name) ?? "";
        }

        console.log(chalk.bold(`${pm.icon} ${pm.name}`) + chalk.dim(` (${outdated.length} outdated)`));
        for (const pkg of outdated) {
          console.log(
            chalk.gray("  ·"),
            chalk.bold(pkg.name),
            chalk.dim(pkg.current),
            chalk.yellow("→"),
            chalk.green(pkg.latest)
          );
          if (pkg.path) {
            console.log(chalk.gray("    ") + chalk.dim(pkg.path));
          }
        }
        console.log("");
        totalOutdated += outdated.length;
      } else {
        console.log(chalk.green(`${pm.icon} ${pm.name}`) + chalk.dim(" — up to date\n"));
      }
    } catch (err) {
      logger.error(`Failed to check ${pm.name}: ${err}`);
    }
  }

  if (totalOutdated === 0) {
    logger.success("All packages are up to date!\n");
  } else {
    console.log(chalk.yellow(`  Total: ${totalOutdated} outdated package(s)\n`));
  }
}
