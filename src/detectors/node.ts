import type { PackageManager, OutdatedPackage, InstalledPackage, UpdateResult } from "./types.ts";
import { exec, isInstalled } from "../utils/exec.ts";
import { listOutdatedViaRegistry, getGlobalPackages } from "../utils/registry.ts";

function detectPrimaryPM(): string | null {
  // npm first — most reliable for global packages
  if (isInstalled("npm")) return "npm";
  if (isInstalled("pnpm")) return "pnpm";
  if (isInstalled("yarn")) return "yarn";
  if (isInstalled("bun")) return "bun";
  return null;
}

function detectAllPMs(): string[] {
  const pms: string[] = [];
  if (isInstalled("bun")) pms.push("bun");
  if (isInstalled("pnpm")) pms.push("pnpm");
  if (isInstalled("yarn")) pms.push("yarn");
  if (isInstalled("npm")) pms.push("npm");
  return pms;
}

function cmdFor(pm: string, action: string, packages?: string[]): string[] {
  const hasPkgs = packages && packages.length > 0;
  if (action === "update") {
    switch (pm) {
      case "yarn": return hasPkgs ? ["yarn", "global", "upgrade", ...packages] : ["yarn", "global", "upgrade"];
      case "pnpm": return hasPkgs ? ["pnpm", "update", "-g", ...packages] : ["pnpm", "update", "-g"];
      // bun doesn't have `update -g`, use `add -g` to reinstall latest
      case "bun": return hasPkgs ? ["bun", "add", "-g", ...packages.map(p => p + "@latest")] : ["bun", "add", "-g"];
      default: return hasPkgs ? ["npm", "update", "-g", ...packages] : ["npm", "update", "-g"];
    }
  }
  // uninstall
  switch (pm) {
    case "yarn": return ["yarn", "global", "remove", ...packages!];
    case "pnpm": return ["pnpm", "remove", "-g", ...packages!];
    case "bun": return ["bun", "remove", "-g", ...packages!];
    default: return ["npm", "uninstall", "-g", ...packages!];
  }
}

export const node: PackageManager = {
  name: `Node (${detectAllPMs().join("/")})`,
  command: "node",
  icon: "📦",

  async detect(): Promise<boolean> {
    return detectPrimaryPM() !== null;
  },

  async listOutdated(): Promise<OutdatedPackage[]> {
    return listOutdatedViaRegistry();
  },

  async listInstalled(): Promise<InstalledPackage[]> {
    return getGlobalPackages();
  },

  async update(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    const pm = detectPrimaryPM() ?? "npm";
    if (dryRun) return { manager: "Node", success: true, updated: packages?.length ?? 0, output: "dry run" };
    const cmd = cmdFor(pm, "update", packages);
    const result = await exec(cmd);
    return { manager: "Node", success: result.exitCode === 0, updated: packages?.length ?? 0, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },

  async uninstall(dryRun = false, packages?: string[]): Promise<UpdateResult> {
    if (!packages?.length) return { manager: "Node", success: true, updated: 0, output: "Nothing to uninstall" };
    const pm = detectPrimaryPM() ?? "npm";
    if (dryRun) return { manager: "Node", success: true, updated: packages.length, output: "dry run" };
    const cmd = cmdFor(pm, "uninstall", packages);
    const result = await exec(cmd);
    return { manager: "Node", success: result.exitCode === 0, updated: packages.length, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
  },
};
