import type { PackageManager, OutdatedPackage, InstalledPackage, UpdateResult } from "./types.ts";
import { exec, isInstalled } from "../utils/exec.ts";
import { runSudo } from "../utils/sudo.ts";

let noSudoGlobal = false;

export function setNoSudo(value: boolean) {
  noSudoGlobal = value;
}

export const macos: PackageManager = {
  name: "macOS System",
  command: "softwareupdate",
  icon: "🍎",

  async detect(): Promise<boolean> {
    return isInstalled("softwareupdate");
  },

  async listOutdated(): Promise<OutdatedPackage[]> {
    const result = await exec(["softwareupdate", "--list"]);
    const output = result.stdout + "\n" + result.stderr;
    const updates: OutdatedPackage[] = [];
    const labelRegex = /\*\s+Label:\s*(.+)/g;
    let match: RegExpExecArray | null;
    while ((match = labelRegex.exec(output)) !== null) {
      updates.push({ name: match[1]!.trim(), current: "pending", latest: "available" });
    }
    if (updates.length === 0) {
      const titleRegex = /-\s+(.+)/g;
      while ((match = titleRegex.exec(output)) !== null) {
        const name = match[1]!.trim();
        if (!name.includes("No new software available")) {
          updates.push({ name, current: "pending", latest: "available" });
        }
      }
    }
    return updates;
  },

  async listInstalled(): Promise<InstalledPackage[]> {
    // macOS system updates don't have an "installed list" concept
    return [];
  },

  async update(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    if (dryRun) return { manager: "macOS System", success: true, updated: packages?.length ?? 0, output: "dry run" };
    const cmd = packages && packages.length > 0
      ? ["softwareupdate", "--install", ...packages]
      : ["softwareupdate", "--install", "--all", "--restart"];
    const result = await runSudo(cmd, noSudoGlobal);
    return { manager: "macOS System", success: result.exitCode === 0, updated: packages?.length ?? 0, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },

  async uninstall(): Promise<UpdateResult> {
    return { manager: "macOS System", success: false, updated: 0, output: "", error: "Cannot uninstall macOS system updates" };
  },
};
