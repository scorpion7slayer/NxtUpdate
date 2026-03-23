import chalk from "chalk";

export function showBanner() {
  const lines = [
    "",
    chalk.bold.cyan("  ╔══════════════════════════════════════╗"),
    chalk.bold.cyan("  ║") + chalk.bold.white("      ⬆  NxtUpdate v1.0.0  ⬆        ") + chalk.bold.cyan("║"),
    chalk.bold.cyan("  ║") + chalk.dim("  Universal macOS Package Updater    ") + chalk.bold.cyan("║"),
    chalk.bold.cyan("  ╚══════════════════════════════════════╝"),
    "",
  ];
  console.log(lines.join("\n"));
}
