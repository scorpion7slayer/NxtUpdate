import { Box, Text, useApp, useInput, render } from "ink";
import { useEffect, useState } from "react";
import { detectInstalled } from "../detectors/index.ts";
import { checkForUpdate, VERSION } from "../utils/version.ts";
import { MainMenu } from "./main-menu.tsx";
import { UpdateScreen } from "./update.tsx";
import { ListScreen } from "./list-screen.tsx";
import { SelectPackagesScreen } from "./select-packages.tsx";
import { ProgressBar } from "./progress-bar.tsx";
import { MoleTipScreen } from "./mole-tip.tsx";
import { ConfirmUninstallScreen } from "./confirm-action.tsx";
import type {
  PackageManager,
  OutdatedPackage,
  InstalledPackage,
  CliOptions,
} from "../detectors/types.ts";
import type { UpdateInfo } from "../utils/version.ts";

export type Screen =
  | "scan"
  | "menu"
  | "update"
  | "list"
  | "select"
  | "uninstall-scan"
  | "uninstall"
  | "uninstall-confirm"
  | "uninstall-run"
  | "mole-tip";

export type ManagerData = {
  manager: PackageManager;
  outdated: OutdatedPackage[];
};

export type InstalledManagerData = {
  manager: PackageManager;
  installed: InstalledPackage[];
};

interface AppProps {
  options: CliOptions;
  startScreen?: Screen;
}

function ScanScreen({ onComplete }: { onComplete: (data: ManagerData[]) => void }) {
  const [status, setStatus] = useState("Detecting package managers…");
  const [detected, setDetected] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    void (async () => {
      const all = await detectInstalled();
      setDetected(all.map((manager) => `${manager.icon} ${manager.name}`));
      setStatus(`Checking ${all.length} package managers in parallel…`);
      setProgress({ current: 0, total: all.length });

      const results = await Promise.all(all.map(async (manager): Promise<ManagerData> => {
        try {
          return { manager, outdated: await manager.listOutdated() };
        } catch {
          return { manager, outdated: [] };
        } finally {
          setProgress((previous) => ({ ...previous, current: previous.current + 1 }));
        }
      }));

      onComplete(results);
    })();
  }, []);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">NxtUpdate · system scan</Text>
        <Text>v{VERSION}</Text>
      </Box>

      <Text>{status}</Text>
      <ProgressBar current={progress.current} total={progress.total} />

      {detected.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {detected.map((manager) => (
            <Text key={manager} wrap="truncate-end">· {manager}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function UninstallScanScreen({
  onComplete,
}: {
  onComplete: (data: InstalledManagerData[]) => void;
}) {
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    void (async () => {
      const all = await detectInstalled();
      setProgress({ current: 0, total: all.length });
      const results = await Promise.all(all.map(async (manager): Promise<InstalledManagerData> => {
        try {
          return { manager, installed: await manager.listInstalled() };
        } catch {
          return { manager, installed: [] };
        } finally {
          setProgress((previous) => ({ ...previous, current: previous.current + 1 }));
        }
      }));
      onComplete(results);
    })();
  }, []);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="red">Reviewing installed packages…</Text>
      <Text>Package managers are queried in parallel. Nothing is removed during this scan.</Text>
      <ProgressBar current={progress.current} total={progress.total} />
    </Box>
  );
}

export function App({ options, startScreen = "scan" }: AppProps) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>(startScreen);
  const [managers, setManagers] = useState<ManagerData[]>([]);
  const [installedManagers, setInstalledManagers] = useState<InstalledManagerData[]>([]);
  const [selectedForUpdate, setSelectedForUpdate] = useState<ManagerData[]>([]);
  const [selectedForUninstall, setSelectedForUninstall] = useState<ManagerData[]>([]);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [menuSelection, setMenuSelection] = useState(0);

  useEffect(() => {
    let active = true;
    void checkForUpdate().then((info) => {
      if (active) setUpdateInfo(info);
    });
    return () => {
      active = false;
    };
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === "c") exit();
  });

  if (screen === "scan") {
    return <ScanScreen onComplete={(data) => {
      setManagers(data);
      setScreen("menu");
    }} />;
  }

  if (screen === "list") {
    return <ListScreen managers={managers} onBack={() => setScreen("menu")} />;
  }

  if (screen === "select") {
    return (
      <SelectPackagesScreen
        managers={managers}
        title="Select packages to update"
        mode="update"
        onConfirm={(selected) => {
          setSelectedForUpdate(selected);
          setScreen("update");
        }}
        onBack={() => setScreen("menu")}
      />
    );
  }

  if (screen === "menu") {
    return (
      <MainMenu
        managers={managers}
        options={options}
        updateInfo={updateInfo}
        selected={menuSelection}
        onSelectionChange={setMenuSelection}
        onStartUpdate={() => setScreen("select")}
        onUninstall={() => setScreen("uninstall-scan")}
        onViewList={() => setScreen("list")}
        onViewMoleTip={() => setScreen("mole-tip")}
      />
    );
  }

  if (screen === "update") {
    return (
      <UpdateScreen
        managers={selectedForUpdate.length > 0 ? selectedForUpdate : managers}
        options={options}
        mode="update"
        onDone={(updated) => {
          if (!options.dryRun) {
            const succeeded = new Map(
              updated.map((result) => [result.managerName, new Set(result.pkgNames)])
            );
            setManagers((previous) => previous.map((manager) => ({
              ...manager,
              outdated: manager.outdated.filter(
                (pkg) => !succeeded.get(manager.manager.name)?.has(pkg.name)
              ),
            })));
          }
          setSelectedForUpdate([]);
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "uninstall-scan") {
    return (
      <UninstallScanScreen
        onComplete={(data) => {
          setInstalledManagers(data);
          setScreen("uninstall");
        }}
      />
    );
  }

  if (screen === "uninstall") {
    const selectable: ManagerData[] = installedManagers
      .filter((manager) => manager.installed.length > 0)
      .map((manager) => ({
        manager: manager.manager,
        outdated: manager.installed.map((pkg) => ({
          name: pkg.name,
          current: pkg.version,
          latest: "",
        })),
      }));

    return (
      <SelectPackagesScreen
        managers={selectable}
        title="Select packages to uninstall"
        mode="uninstall"
        initialSelected={selectedForUninstall}
        onConfirm={(selected) => {
          setSelectedForUninstall(selected);
          setScreen("uninstall-confirm");
        }}
        onBack={() => setScreen("menu")}
      />
    );
  }

  if (screen === "uninstall-confirm") {
    return (
      <ConfirmUninstallScreen
        managers={selectedForUninstall}
        dryRun={options.dryRun}
        onConfirm={() => setScreen("uninstall-run")}
        onBack={() => setScreen("uninstall")}
      />
    );
  }

  if (screen === "uninstall-run") {
    return (
      <UpdateScreen
        managers={selectedForUninstall}
        options={options}
        mode="uninstall"
        onDone={(removed) => {
          if (!options.dryRun) {
            const succeeded = new Map(
              removed.map((result) => [result.managerName, new Set(result.pkgNames)])
            );
            setInstalledManagers((previous) => previous.map((manager) => ({
              ...manager,
              installed: manager.installed.filter(
                (pkg) => !succeeded.get(manager.manager.name)?.has(pkg.name)
              ),
            })));
          }
          setSelectedForUninstall([]);
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "mole-tip") {
    return <MoleTipScreen onBack={() => setScreen("menu")} />;
  }

  return null;
}

export async function withAlternateScreen(
  run: () => Promise<void>,
  write: (value: string) => unknown = (value) => process.stdout.write(value),
) {
  write("\x1b[?1049h\x1b[H\x1b[2J");
  try {
    await run();
  } finally {
    write("\x1b[?1049l");
  }
}

export async function launchTUI(options: CliOptions, startScreen?: Screen) {
  await withAlternateScreen(async () => {
    const instance = render(<App options={options} startScreen={startScreen} />, {
      exitOnCtrlC: false,
    });
    await instance.waitUntilExit();
  });
}
