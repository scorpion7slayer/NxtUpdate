import type { PackageManager, OutdatedPackage, InstalledPackage, UpdateResult } from "./types.ts";
import { exec, isInstalled } from "../utils/exec.ts";

export const cargo: PackageManager = {
  name: "Rust (Cargo)",
  command: "cargo",
  icon: "🦀",

  async detect(): Promise<boolean> {
    return isInstalled("cargo");
  },

  async listOutdated(): Promise<OutdatedPackage[]> {
    if (!isInstalled("cargo-install-update")) return [];
    const result = await exec(["cargo", "install-update", "--list"]);
    if (result.exitCode !== 0 || !result.stdout) return [];
    return result.stdout.split("\n").filter(l => l.includes("->")).map(line => {
      const parts = line.trim().split(/\s+/);
      return { name: parts[0] ?? "?", current: parts[1] ?? "?", latest: parts[3] ?? "?" };
    });
  },

  async listInstalled(): Promise<InstalledPackage[]> {
    const result = await exec(["cargo", "install", "--list"]);
    if (result.exitCode !== 0 || !result.stdout) return [];
    return result.stdout.split("\n").filter(l => l.trim() && l.startsWith("  ")).map(line => {
      const match = line.trim().match(/^(\S+)\s+v([\d.]+)/);
      if (match) return { name: match[1]!, version: match[2]! };
      return { name: line.trim().split(" ")[0] ?? "?", version: "?" };
    });
  },

  async update(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    if (dryRun) return { manager: "Rust (Cargo)", success: true, updated: packages?.length ?? 0, output: "dry run" };
    if (!isInstalled("cargo-install-update")) {
      return { manager: "Rust (Cargo)", success: false, updated: 0, output: "", error: "cargo-install-update not installed. Run: cargo install cargo-install-update" };
    }
    const cmd = packages && packages.length > 0 ? ["cargo", "install-update", ...packages] : ["cargo", "install-update", "--all"];
    const result = await exec(cmd);
    return { manager: "Rust (Cargo)", success: result.exitCode === 0, updated: packages?.length ?? 0, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },

  async uninstall(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    if (!packages?.length) return { manager: "Rust (Cargo)", success: true, updated: 0, output: "Nothing to uninstall" };
    if (dryRun) return { manager: "Rust (Cargo)", success: true, updated: packages.length, output: "dry run" };
    const result = await exec(["cargo", "uninstall", ...packages]);
    return { manager: "Rust (Cargo)", success: result.exitCode === 0, updated: packages.length, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },
};
