import type { PackageManager } from "./types.ts";
import { homebrew } from "./homebrew.ts";
import { node } from "./node.ts";
import { python } from "./python.ts";
import { cargo } from "./cargo.ts";
import { macos } from "./macos.ts";

export function getAllDetectors(): PackageManager[] {
  return [homebrew, node, python, cargo, macos];
}

export async function detectInstalled(): Promise<PackageManager[]> {
  const all = getAllDetectors();
  const detected: PackageManager[] = [];

  const checks = await Promise.allSettled(
    all.map(async (pm) => {
      const found = await pm.detect();
      return { pm, found };
    })
  );

  for (const result of checks) {
    if (result.status === "fulfilled" && result.value.found) {
      detected.push(result.value.pm);
    }
  }

  return detected;
}

export function findByName(name: string): PackageManager | undefined {
  return getAllDetectors().find(
    (pm) => pm.name.toLowerCase().includes(name.toLowerCase()) ||
            pm.command.toLowerCase() === name.toLowerCase()
  );
}

export { homebrew, node, python, cargo, macos };
