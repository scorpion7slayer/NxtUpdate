import type { PackageManager, OutdatedPackage, InstalledPackage, UpdateResult } from "./types.ts";
import { exec, isInstalled } from "../utils/exec.ts";

function getPipCommand(): string | null {
  // Skip if inside a virtualenv — only show global packages
  if (process.env.VIRTUAL_ENV) return null;
  if (isInstalled("pip3")) return "pip3";
  if (isInstalled("pip")) return "pip";
  return null;
}

export const python: PackageManager = {
  name: "Python (pip)",
  command: "pip3",
  icon: "🐍",

  async detect(): Promise<boolean> {
    return getPipCommand() !== null;
  },

  async listOutdated(): Promise<OutdatedPackage[]> {
    const pip = getPipCommand();
    if (!pip) return [];
    const result = await exec([pip, "list", "--outdated", "--format=json"]);
    if (result.exitCode !== 0 || !result.stdout) return [];
    try {
      const data = JSON.parse(result.stdout);
      return data.map((pkg: any) => ({ name: pkg.name, current: pkg.version, latest: pkg.latest_version }));
    } catch { return []; }
  },

  async listInstalled(): Promise<InstalledPackage[]> {
    const pip = getPipCommand();
    if (!pip) return [];
    const result = await exec([pip, "list", "--format=json"]);
    if (result.exitCode !== 0 || !result.stdout) return [];
    try {
      return JSON.parse(result.stdout).map((pkg: any) => ({ name: pkg.name, version: pkg.version }));
    } catch { return []; }
  },

  async update(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    const pip = getPipCommand() ?? "pip3";
    if (dryRun) return { manager: "Python (pip)", success: true, updated: packages?.length ?? 0, output: "dry run" };
    const names = packages && packages.length > 0 ? packages : (await this.listOutdated()).map(p => p.name);
    if (!names.length) return { manager: "Python (pip)", success: true, updated: 0, output: "Nothing to update" };
    const result = await exec([pip, "install", "--upgrade", ...names]);
    return { manager: "Python (pip)", success: result.exitCode === 0, updated: names.length, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },

  async uninstall(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    if (!packages?.length) return { manager: "Python (pip)", success: true, updated: 0, output: "Nothing to uninstall" };
    const pip = getPipCommand() ?? "pip3";
    if (dryRun) return { manager: "Python (pip)", success: true, updated: packages.length, output: "dry run" };
    const result = await exec([pip, "uninstall", "-y", ...packages]);
    return { manager: "Python (pip)", success: result.exitCode === 0, updated: packages.length, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },
};
