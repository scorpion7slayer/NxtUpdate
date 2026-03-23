import { Box, Text, useInput, render } from "ink";
import { useState, useEffect } from "react";
import { detectInstalled } from "../detectors/index.ts";
import { fetchPaths } from "../utils/paths.ts";
import { MainMenu } from "./main-menu.tsx";
import { UpdateScreen } from "./update.tsx";
import { ListScreen } from "./list-screen.tsx";
import { SelectPackagesScreen } from "./select-packages.tsx";
import { ProgressBar } from "./progress-bar.tsx";
import type { PackageManager, OutdatedPackage, InstalledPackage, CliOptions } from "../detectors/types.ts";

export type Screen = "scan" | "menu" | "update" | "list" | "select" | "uninstall-scan" | "uninstall" | "mole-tip";
export type ManagerData = { manager: PackageManager; outdated: OutdatedPackage[] };
export type InstalledManagerData = { manager: PackageManager; installed: InstalledPackage[] };

interface AppProps {
  options: CliOptions;
  startScreen?: Screen;
}

function ScanScreen({ onComplete }: { onComplete: (data: ManagerData[]) => void }) {
  const [status, setStatus] = useState("Detecting package managers...");
  const [detected, setDetected] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await detectInstalled();
      setDetected(all.map((pm) => `${pm.icon} ${pm.name}`));
      setStatus("Scanning for outdated packages...");
      setScanning(true);
      setProgress({ current: 0, total: all.length });
      const results: ManagerData[] = [];
      for (let i = 0; i < all.length; i++) {
        const pm = all[i]!;
        try { results.push({ manager: pm, outdated: await pm.listOutdated() }); }
        catch { results.push({ manager: pm, outdated: [] }); }
        setProgress({ current: i + 1, total: all.length });
      }

      // Fetch install paths for all outdated packages
      setStatus("Fetching install paths...");
      for (const m of results) {
        if (m.outdated.length === 0) continue;
        const paths = await fetchPaths(m.manager.name, m.outdated);
        for (const pkg of m.outdated) {
          pkg.path = paths.get(pkg.name) ?? "";
        }
      }

      setDone(true);
      setTimeout(() => onComplete(results), 400);
    })();
  }, []);

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}><Text bold color="cyan">⬆️  NxtUpdate — Universal macOS Updater</Text></Box>

      {detected.length > 0 && !scanning && (
        <Box flexDirection="column" marginTop={1}>
          {detected.map((d, i) => <Box key={i}><Text color="green">✔</Text><Text> {d}</Text></Box>)}
        </Box>
      )}

      {scanning && !done && (
        <Box flexDirection="column" marginTop={1}>
          <Text>{status}</Text>
          <ProgressBar current={progress.current} total={progress.total} />
        </Box>
      )}

      {done && (
        <Box marginTop={1}>
          <Text color="green">✔ Scan complete</Text>
        </Box>
      )}
    </Box>
  );
}

function UninstallScanScreen({ onComplete }: { onComplete: (data: InstalledManagerData[]) => void }) {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await detectInstalled();
      setProgress({ current: 0, total: all.length });
      const results: InstalledManagerData[] = [];
      for (let i = 0; i < all.length; i++) {
        const pm = all[i]!;
        try {
          const installed = await pm.listInstalled();
          // Fetch paths
          const paths = await fetchPaths(pm.name, installed);
          for (const pkg of installed) {
            (pkg as any).path = paths.get(pkg.name) ?? "";
          }
          results.push({ manager: pm, installed });
        }
        catch { results.push({ manager: pm, installed: [] }); }
        setProgress({ current: i + 1, total: all.length });
      }
      setDone(true);
      setTimeout(() => onComplete(results), 400);
    })();
  }, []);

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}><Text bold color="red">🗑️  Scanning installed packages...</Text></Box>
      <ProgressBar current={progress.current} total={progress.total} />
    </Box>
  );
}

function MoleTipScreen({ onBack }: { onBack: () => void }) {
  useInput((input, key) => {
    if (key.escape || input === "q" || key.leftArrow || key.return || key.rightArrow) onBack();
  });

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}><Text bold color="magenta">🐹 Want to uninstall .app files?</Text></Box>
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Text>Use <Text bold color="cyan">Mole</Text> to uninstall macOS apps and clean</Text>
        <Text>all their leftover files (caches, prefs, logs...).</Text>
        <Box marginTop={1} flexDirection="column">
          <Text bold> Install:</Text>
          <Text color="cyan">  brew install mole</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold> Then run:</Text>
          <Text color="cyan">  mole</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold> Learn more:</Text>
          <Text color="cyan">  https://github.com/tw93/Mole</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press any key to go back</Text>
      </Box>
    </Box>
  );
}

export function App({ options, startScreen = "scan" }: AppProps) {
  const [screen, setScreen] = useState<Screen>(startScreen);
  const [managers, setManagers] = useState<ManagerData[]>([]);
  const [installedManagers, setInstalledManagers] = useState<InstalledManagerData[]>([]);
  const [selectedForUpdate, setSelectedForUpdate] = useState<ManagerData[]>([]);

  useInput((input, key) => { if (key.ctrl && input === "c") process.exit(0); });

  if (screen === "scan") return <ScanScreen onComplete={(data) => { setManagers(data); setScreen("menu"); }} />;
  if (screen === "list") return <ListScreen managers={managers} onBack={() => setScreen("menu")} />;
  if (screen === "select") {
    return <SelectPackagesScreen managers={managers} title="⬆️  Select Packages to Update"
      onConfirm={(selected) => { setSelectedForUpdate(selected); setScreen("update"); }}
      onBack={() => setScreen("menu")} />;
  }
  if (screen === "menu") {
    return <MainMenu managers={managers} options={options}
      onStartUpdate={() => setScreen("select")}
      onUninstall={() => setScreen("uninstall-scan")}
      onViewList={() => setScreen("list")}
      onViewMoleTip={() => setScreen("mole-tip")} />;
  }
  if (screen === "update") {
    return <UpdateScreen managers={selectedForUpdate.length > 0 ? selectedForUpdate : managers}
      options={options} onDone={() => { setSelectedForUpdate([]); setScreen("menu"); }} />;
  }
  if (screen === "uninstall-scan") {
    return <UninstallScanScreen onComplete={(data) => { setInstalledManagers(data); setScreen("uninstall"); }} />;
  }
  if (screen === "uninstall") {
    const asManagerData: ManagerData[] = installedManagers.filter((m) => m.installed.length > 0)
      .map((m) => ({ manager: m.manager, outdated: m.installed.map((p) => ({ name: p.name, current: p.version, latest: "", path: (p as any).path ?? "" })) }));
    return <SelectPackagesScreen managers={asManagerData} title="🗑️  Select Packages to Uninstall"
      onConfirm={async (selected) => {
        for (const s of selected) { await s.manager.uninstall(options.dryRun, s.outdated.map((p) => p.name)); }
        setScreen("menu");
      }}
      onBack={() => setScreen("menu")} />;
  }
  if (screen === "mole-tip") {
    return <MoleTipScreen onBack={() => setScreen("menu")} />;
  }

  return null;
}

export function launchTUI(options: CliOptions, startScreen?: Screen) {
  // Enter alternate screen buffer + clear
  process.stdout.write("\x1b[?1049h\x1b[H\x1b[2J");

  const instance = render(<App options={options} startScreen={startScreen} />, {
    exitOnCtrlC: true,
  });

  // Restore normal screen on exit
  instance.waitUntilExit().then(() => {
    process.stdout.write("\x1b[?1049l");
  });
}
