import { exec } from "./exec.ts";

export async function getNpmPath(pkg: string): Promise<string> {
  const result = await exec(["npm", "root", "-g"]);
  if (result.exitCode !== 0 || !result.stdout) return "";
  return result.stdout.trim() + "/" + pkg;
}

export async function getPipPath(pkg: string): Promise<string> {
  const result = await exec(["pip3", "show", "-f", pkg]);
  if (result.exitCode !== 0 || !result.stdout) return "";
  const match = result.stdout.match(/^Location:\s*(.+)/m);
  return match?.[1]?.trim() ?? "";
}

export async function getGemPath(pkg: string): Promise<string> {
  const result = await exec(["gem", "which", pkg]);
  if (result.exitCode !== 0 || !result.stdout) return "";
  return result.stdout.trim();
}

export async function getBrewPath(pkg: string): Promise<string> {
  const cleanName = pkg.replace(/\s*\(cask\)\s*/, "");
  const result = await exec(["brew", "--prefix", cleanName]);
  if (result.exitCode !== 0 || !result.stdout) {
    const r2 = await exec(["brew", "--cellar", cleanName]);
    return r2.exitCode === 0 ? r2.stdout.trim() : "";
  }
  return result.stdout.trim();
}

export async function getPackagePath(pm: string, pkg: string): Promise<string> {
  const lower = pm.toLowerCase();
  if (lower.includes("homebrew") || lower.includes("brew")) return getBrewPath(pkg);
  if (lower.includes("node") || lower.includes("npm")) return getNpmPath(pkg);
  if (lower.includes("pip") || lower.includes("python")) return getPipPath(pkg);
  if (lower.includes("gem") || lower.includes("ruby")) return getGemPath(pkg);
  return "";
}

export async function fetchPaths(
  pm: string,
  pkgs: { name: string }[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  await Promise.allSettled(
    pkgs.map(async (pkg) => {
      const path = await getPackagePath(pm, pkg.name);
      if (path) result.set(pkg.name, path);
    })
  );
  return result;
}
