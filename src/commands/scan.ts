import chalk from "chalk";
import { getAllDetectors } from "../detectors/index.ts";
import { logger } from "../ui/logger.ts";
import { showUpdateNotice } from "../ui/banner.ts";
import { checkForUpdate } from "../utils/version.ts";

export async function scanCommand() {
  console.log(chalk.bold("\n🔍 Scanning for installed package managers...\n"));

  const updateInfoPromise = checkForUpdate();

  const all = getAllDetectors();
  const detected: string[] = [];
  const notFound: string[] = [];

  for (const pm of all) {
    try {
      const found = await pm.detect();
      if (found) {
        detected.push(`${pm.icon} ${chalk.bold(pm.name)} ${chalk.dim(`(${pm.command})`)}`);
      } else {
        notFound.push(pm.name);
      }
    } catch {
      notFound.push(pm.name);
    }
  }

  if (detected.length > 0) {
    logger.success(`Found ${detected.length} package manager(s):`);
    logger.list(detected);
  } else {
    logger.warn("No package managers detected.");
  }

  if (notFound.length > 0) {
    logger.dim(`\nNot installed: ${notFound.join(", ")}`);
  }

  console.log("");

  const updateInfo = await updateInfoPromise;
  if (updateInfo?.hasUpdate) showUpdateNotice(updateInfo);
}
