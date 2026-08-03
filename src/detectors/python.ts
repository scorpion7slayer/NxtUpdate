import type { PackageManager, OutdatedPackage, InstalledPackage, UpdateResult, ProgressReporter } from "./types.ts";
import { exec, isInstalled, type ExecOptions } from "../utils/exec.ts";

function getPipCommand(): string | null {
  // Skip if inside a virtualenv — only show global packages
  if (process.env.VIRTUAL_ENV) return null;
  if (isInstalled("pip3")) return "pip3";
  if (isInstalled("pip")) return "pip";
  return null;
}

type CommandResult = { stdout: string; stderr: string; exitCode: number };
type Execute = (command: string[], options?: ExecOptions) => Promise<CommandResult>;

interface PythonManagerDependencies {
  execute?: Execute;
  findPip?: () => string | null;
}

const PIP_CAPABILITY_PROBE = [
  "install",
  "--dry-run",
  "--no-index",
  "--disable-pip-version-check",
  "pip",
];

export function isExternallyManagedPipResult(result: CommandResult): boolean {
  const output = `${result.stderr}\n${result.stdout}`;
  return result.exitCode !== 0
    && /externally-managed-environment|this environment is externally managed/i.test(output);
}

export function createPythonManager({
  execute = exec,
  findPip = getPipCommand,
}: PythonManagerDependencies = {}): PackageManager {
  let externallyManagedPromise: Promise<boolean> | undefined;
  let manager: PackageManager;

  const isExternallyManaged = (pip: string): Promise<boolean> => {
    externallyManagedPromise ??= execute([pip, ...PIP_CAPABILITY_PROBE])
      .then((result) => {
        const externallyManaged = isExternallyManagedPipResult(result);
        if (externallyManaged) {
          manager.skipReason = "externally managed (PEP 668); use Homebrew, pipx, or a virtual environment";
        }
        return externallyManaged;
      });
    return externallyManagedPromise;
  };

  const blockedResult = (): UpdateResult => ({
    manager: "Python (pip)",
    success: false,
    updated: 0,
    output: "",
    error: "Python is externally managed (PEP 668); NxtUpdate will not modify it with pip. Use the system package manager, pipx, or a virtual environment.",
  });

  manager = {
    name: "Python (pip)",
    command: "pip3",
    icon: "🐍",

    async detect(): Promise<boolean> {
      const pip = findPip();
      if (!pip) return false;
      await isExternallyManaged(pip);
      return true;
    },

    async listOutdated(): Promise<OutdatedPackage[]> {
      const pip = findPip();
      if (!pip || await isExternallyManaged(pip)) return [];
      const result = await execute([pip, "list", "--outdated", "--format=json"]);
      if (result.exitCode !== 0 || !result.stdout) return [];
      try {
        const data = JSON.parse(result.stdout);
        return data.map((pkg: any) => ({ name: pkg.name, current: pkg.version, latest: pkg.latest_version }));
      } catch { return []; }
    },

    async listInstalled(): Promise<InstalledPackage[]> {
      const pip = findPip();
      if (!pip || await isExternallyManaged(pip)) return [];
      const result = await execute([pip, "list", "--format=json"]);
      if (result.exitCode !== 0 || !result.stdout) return [];
      try {
        return JSON.parse(result.stdout).map((pkg: any) => ({ name: pkg.name, version: pkg.version }));
      } catch { return []; }
    },

    async update(dryRun = false, packages?: string[], onProgress?: ProgressReporter): Promise<UpdateResult> {
      const pip = findPip();
      if (!pip) return { manager: "Python (pip)", success: false, updated: 0, output: "", error: "pip is not installed" };
      if (await isExternallyManaged(pip)) return blockedResult();
      if (dryRun) return { manager: "Python (pip)", success: true, updated: packages?.length ?? 0, output: "dry run" };
      const names = packages && packages.length > 0 ? packages : (await manager.listOutdated()).map(p => p.name);
      if (!names.length) return { manager: "Python (pip)", success: true, updated: 0, output: "Nothing to update" };
      onProgress?.(`Downloading and installing ${names.length} Python package(s)…`);
      const result = await execute([pip, "install", "--upgrade", ...names], { onLine: onProgress });
      return { manager: "Python (pip)", success: result.exitCode === 0, updated: names.length, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
    },

    async uninstall(dryRun = false, packages?: string[], onProgress?: ProgressReporter): Promise<UpdateResult> {
      if (!packages?.length) return { manager: "Python (pip)", success: true, updated: 0, output: "Nothing to uninstall" };
      const pip = findPip();
      if (!pip) return { manager: "Python (pip)", success: false, updated: 0, output: "", error: "pip is not installed" };
      if (await isExternallyManaged(pip)) return blockedResult();
      if (dryRun) return { manager: "Python (pip)", success: true, updated: packages.length, output: "dry run" };
      onProgress?.(`Removing ${packages.length} Python package(s)…`);
      const result = await execute([pip, "uninstall", "-y", ...packages], { onLine: onProgress });
      return { manager: "Python (pip)", success: result.exitCode === 0, updated: packages.length, output: result.stdout, error: result.exitCode !== 0 ? result.stderr : undefined };
    },
  };

  return manager;
}

export const python = createPythonManager();
