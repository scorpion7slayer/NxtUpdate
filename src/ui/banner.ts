import chalk from "chalk";
import { VERSION } from "../utils/version.ts";
import type { UpdateInfo } from "../utils/version.ts";

export function showBanner() {
  const lines = [
    "",
    chalk.bold.cyan("  ╔══════════════════════════════════════╗"),
    chalk.bold.cyan("  ║") + chalk.bold.white(`      ⬆  NxtUpdate v${VERSION}  ⬆        `) + chalk.bold.cyan("║"),
    chalk.bold.cyan("  ║") + chalk.dim("  Universal macOS Package Updater    ") + chalk.bold.cyan("║"),
    chalk.bold.cyan("  ╚══════════════════════════════════════╝"),
    "",
  ];
  console.log(lines.join("\n"));
}

export function showUpdateNotice(info: UpdateInfo) {
  console.log(
    chalk.bgYellow.black(" UPDATE ") +
    chalk.yellow(` v${info.latest} is available `) +
    chalk.dim(`(current: v${info.current})`)
  );
  console.log(chalk.dim("  Run: ") + chalk.cyan("npm i -g nxtupdate") + "\n");
}
