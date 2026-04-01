export const VERSION = "1.0.4";

export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

export type VersionDelta = "MAJOR" | "minor" | "patch";

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
    return { current: VERSION, latest, hasUpdate: latest !== VERSION };
  } catch {
    return null;
  }
}
