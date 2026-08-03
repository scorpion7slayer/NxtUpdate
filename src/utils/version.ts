export const VERSION = "1.0.6";

export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

export type VersionDelta = "MAJOR" | "minor" | "patch";

function parseComparableVersion(version: string): number[] | null {
  const match = version.trim().match(/^v?(\d+(?:\.\d+)*)/);
  const core = match?.[1];
  if (!core) return null;
  return core.split(".").map((part) => Number.parseInt(part, 10));
}

export function isVersionNewer(candidate: string, current: string): boolean {
  const candidateParts = parseComparableVersion(candidate);
  const currentParts = parseComparableVersion(current);
  if (!candidateParts || !currentParts) return false;

  const length = Math.max(candidateParts.length, currentParts.length);
  for (let index = 0; index < length; index++) {
    const candidatePart = candidateParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (candidatePart !== currentPart) return candidatePart > currentPart;
  }
  return false;
}

export function getVersionDelta(current: string, latest: string): VersionDelta {
  const parse = (v: string) => v.replace(/[^0-9.]/g, "").split(".").map((n) => parseInt(n, 10) || 0);
  const [cMaj = 0, cMin = 0] = parse(current);
  const [lMaj = 0, lMin = 0] = parse(latest);
  if (lMaj > cMaj) return "MAJOR";
  if (lMin > cMin) return "minor";
  return "patch";
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch("https://registry.npmjs.org/nxtupdate/latest", {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": `nxtupdate/${VERSION}` },
    });
    if (!res.ok) return null;
    const { version: latest } = await res.json() as { version: string };
    return { current: VERSION, latest, hasUpdate: isVersionNewer(latest, VERSION) };
  } catch {
    return null;
  }
}
