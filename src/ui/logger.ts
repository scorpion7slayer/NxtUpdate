import chalk from "chalk";

export const logger = {
  info: (msg: string) => console.log(chalk.blue("ℹ"), msg),
  success: (msg: string) => console.log(chalk.green("✔"), msg),
  warn: (msg: string) => console.log(chalk.yellow("⚠"), msg),
  error: (msg: string) => console.error(chalk.red("✖"), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  bold: (msg: string) => console.log(chalk.bold(msg)),
  step: (msg: string) => console.log(chalk.cyan("▸"), msg),
  list: (items: string[]) => {
    for (const item of items) {
      console.log(chalk.gray("  ·"), item);
    }
  },
};
