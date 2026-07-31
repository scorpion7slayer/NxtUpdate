import { useEffect, useState } from "react";
import { getPackagePath } from "../utils/paths.ts";

const pathCache = new Map<string, string>();

interface PackagePathState {
  path: string;
  loading: boolean;
}

export function usePackagePath(
  managerName: string | undefined,
  packageName: string | undefined,
  initialPath = ""
): PackagePathState {
  const cacheKey = managerName && packageName ? `${managerName}\0${packageName}` : "";
  const [state, setState] = useState<PackagePathState>({ path: initialPath, loading: false });

  useEffect(() => {
    if (!managerName || !packageName) {
      setState({ path: "", loading: false });
      return;
    }
    if (initialPath) {
      pathCache.set(cacheKey, initialPath);
      setState({ path: initialPath, loading: false });
      return;
    }
    if (pathCache.has(cacheKey)) {
      setState({ path: pathCache.get(cacheKey) ?? "", loading: false });
      return;
    }

    let cancelled = false;
    setState({ path: "", loading: true });
    void getPackagePath(managerName, packageName).then((path) => {
      if (cancelled) return;
      pathCache.set(cacheKey, path);
      setState({ path, loading: false });
    }).catch(() => {
      if (!cancelled) setState({ path: "", loading: false });
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, initialPath, managerName, packageName]);

  return state;
}
