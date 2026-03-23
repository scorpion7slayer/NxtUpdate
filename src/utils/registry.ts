import type { OutdatedPackage } from "../detectors/types.ts";
import { exec } from "./exec.ts";

export async function getGlobalPackages(): Promise<{ name: string; version: string }[]> {
  const result = await exec(["npm", "ls", "-g", "--json", "--depth=0"]);
  if (!result.stdout) return [];

  try {
    const data = JSON.parse(result.stdout);
    const deps = data.dependencies ?? {};
    return Object.entries(deps).map(([name, info]: [string, any]) => ({
      name,
      version: info.version ?? "?",
    }));
  } catch {
    return [];
  }
}

export async function getLatestVersion(pkg: string): Promise<string | null> {
  const result = await exec(["npm", "view", pkg, "version"]);
  if (result.exitCode !== 0 || !result.stdout) return null;
  return result.stdout.trim();
}

export async function listOutdatedViaRegistry(): Promise<OutdatedPackage[]> {
  const installed = await getGlobalPackages();
  if (installed.length === 0) return [];

  const checks = await Promise.allSettled(
    installed.map(async (pkg) => {
      const latest = await getLatestVersion(pkg.name);
      if (latest && latest !== pkg.version) {
        return { name: pkg.name, current: pkg.version, latest };
      }
      return null;
    })
  );

  return checks
    .filter((r): r is PromiseFulfilledResult<OutdatedPackage> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}
