import type { PackageManager, OutdatedPackage, InstalledPackage, UpdateResult } from "./types.ts";
import { exec, isInstalled } from "../utils/exec.ts";

export const homebrew: PackageManager = {
  name: "Homebrew",
  command: "brew",
  icon: "🍺",

  async detect(): Promise<boolean> {
    return isInstalled("brew");
  },

  async listOutdated(): Promise<OutdatedPackage[]> {
    const result = await exec(["brew", "outdated", "--json"]);
    if (result.exitCode !== 0 || !result.stdout) return [];
    try {
      const data = JSON.parse(result.stdout);
      const outdated: OutdatedPackage[] = [];
      if (data.formulae) {
        for (const f of data.formulae) {
          outdated.push({ name: f.name, current: f.installed_versions[0], latest: f.current_version });
        }
      }
      if (data.casks) {
        for (const c of data.casks) {
          outdated.push({ name: c.name + " (cask)", current: c.installed_versions[0], latest: c.current_version });
        }
      }
      return outdated;
    } catch { return []; }
  },

  async listInstalled(): Promise<InstalledPackage[]> {
    const result = await exec(["brew", "list", "--versions"]);
    if (result.exitCode !== 0 || !result.stdout) return [];
    return result.stdout.split("\n").filter(l => l.trim()).map(line => {
      const parts = line.split(" ");
      return { name: parts[0]!, version: parts[1] ?? "?" };
    });
  },

  async update(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    if (dryRun) return { manager: "Homebrew", success: true, updated: packages?.length ?? 0, output: "dry run" };
    await exec(["brew", "update"]);

    if (!packages || packages.length === 0) {
      const result = await exec(["brew", "upgrade"]);
      return { manager: "Homebrew", success: result.exitCode === 0, updated: 0, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
    }

    const casks = packages.filter(p => p.endsWith(" (cask)")).map(p => p.replace(" (cask)", ""));
    const formulae = packages.filter(p => !p.endsWith(" (cask)"));

    let success = true;
    let output = "";
    let error = "";

    if (formulae.length > 0) {
      const result = await exec(["brew", "upgrade", ...formulae]);
      success = success && result.exitCode === 0;
      if (result.stdout) output += (output ? "\n" : "") + result.stdout;
      if (result.exitCode !== 0 && result.stderr) error += (error ? "\n" : "") + result.stderr;
    }

    if (casks.length > 0) {
      const result = await exec(["brew", "upgrade", "--cask", ...casks]);
      success = success && result.exitCode === 0;
      if (result.stdout) output += (output ? "\n" : "") + result.stdout;
      if (result.exitCode !== 0 && result.stderr) error += (error ? "\n" : "") + result.stderr;
    }

    return { manager: "Homebrew", success, updated: formulae.length + casks.length, output, error: error || undefined };
  },

  async uninstall(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    if (!packages?.length) return { manager: "Homebrew", success: true, updated: 0, output: "Nothing to uninstall" };
    if (dryRun) return { manager: "Homebrew", success: true, updated: packages.length, output: "dry run" };
    const result = await exec(["brew", "uninstall", ...packages]);
    return { manager: "Homebrew", success: result.exitCode === 0, updated: packages.length, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },
};
