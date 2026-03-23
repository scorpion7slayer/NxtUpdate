import { Box, Text, Spacer, useInput } from "ink";
import { useState } from "react";
import type { ManagerData } from "./app.tsx";
import type { CliOptions } from "../detectors/types.ts";
import type { UpdateInfo } from "../utils/version.ts";
import { VERSION, getVersionDelta } from "../utils/version.ts";

interface Props {
  managers: ManagerData[];
  options: CliOptions;
  updateInfo: UpdateInfo | null;
  onStartUpdate: () => void;
  onUninstall: () => void;
  onViewList: () => void;
  onViewMoleTip: () => void;
}

type MenuAction = "update" | "uninstall" | "mole-tip" | "list" | "quit";

const menuItems: { label: string; action: MenuAction; icon: string; hint: string; key: string }[] = [
  { label: "Update packages",       action: "update",    icon: "⬆️ ", hint: "Select & update outdated packages", key: "u" },
  { label: "Uninstall packages",    action: "uninstall", icon: "🗑️ ", hint: "Remove installed packages",         key: "x" },
  { label: "Uninstall .app (Mole)", action: "mole-tip",  icon: "🐹 ", hint: "Clean .app files with Mole",        key: "m" },
  { label: "View outdated list",    action: "list",      icon: "📋 ", hint: "Browse all outdated packages",       key: "l" },
  { label: "Quit",                  action: "quit",      icon: "   ", hint: "Exit NxtUpdate",                    key: "q" },
];

const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

export function MainMenu({ managers, options, updateInfo, onStartUpdate, onUninstall, onViewList, onViewMoleTip }: Props) {
  const [selected, setSelected] = useState(0);

  const withOutdated  = managers.filter((m) => m.outdated.length > 0);
  const upToDate      = managers.filter((m) => m.outdated.length === 0);
  const totalOutdated = withOutdated.reduce((s, m) => s + m.outdated.length, 0);

  const doSelect = (idx: number) => {
    switch (menuItems[idx]!.action) {
      case "update":    onStartUpdate();  break;
      case "uninstall": onUninstall();    break;
      case "mole-tip":  onViewMoleTip();  break;
      case "list":      onViewList();     break;
      case "quit":      process.exit(0);
    }
  };

  useInput((input, key) => {
    if (key.upArrow   || input === "k") { setSelected((p) => (p - 1 + menuItems.length) % menuItems.length); return; }
    if (key.downArrow || input === "j") { setSelected((p) => (p + 1) % menuItems.length); return; }
    if (key.return || key.rightArrow)   { doSelect(selected); return; }
    // Direct key shortcuts
    const byKey = menuItems.findIndex((m) => m.key === input);
    if (byKey >= 0) { doSelect(byKey); return; }
  });

  return (
    <Box flexDirection="column" paddingX={1}>

      {/* ── Header ── */}
      <Box marginBottom={1}>
        <Text bold color="cyan">⬆️  NxtUpdate</Text>
        <Text dimColor> — Universal macOS Updater</Text>
        <Spacer />
        <Text dimColor>v{VERSION}</Text>
      </Box>

      {/* ── Update available ── */}
      {updateInfo?.hasUpdate && (
        <Box marginBottom={1} borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>! </Text>
          <Text color="yellow">New version: </Text>
          <Text dimColor>v{updateInfo.current} → </Text>
          <Text color="green" bold>v{updateInfo.latest}</Text>
          <Text dimColor>   npm i -g nxtupdate</Text>
        </Box>
      )}

      {/* ── 2-column body ── */}
      <Box flexDirection="row" gap={1}>

        {/* LEFT — Actions */}
        <Box flexDirection="column" width={40} borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold dimColor>Actions</Text>
          <Box marginTop={1} flexDirection="column">
            {menuItems.map((item, i) => {
              const active = i === selected;
              return (
                <Box key={i}>
                  {/* Inverse highlight on active row */}
                  <Text
                    bold={active}
                    inverse={active}
                    color={active ? undefined : "white"}
                  >
                    {active ? " > " : "   "}
                    {item.icon}{item.label}
                    {"  "}
                    {/* shortcut key indicator */}
                  </Text>
                  {!active && <Text dimColor>[{item.key}]</Text>}
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text dimColor italic>{menuItems[selected]?.hint}</Text>
          </Box>
        </Box>

        {/* RIGHT — Package summary */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold dimColor>Status</Text>
            <Text dimColor>{managers.length} manager(s)</Text>
          </Box>
          <Box marginTop={1} marginBottom={1}>
            {totalOutdated > 0 ? (
              <Box>
                <Text bold color="yellow">{totalOutdated}</Text>
                <Text dimColor> package(s) outdated across </Text>
                <Text bold color="yellow">{withOutdated.length}</Text>
                <Text dimColor> manager(s)</Text>
              </Box>
            ) : (
              <Text color="green" bold>✔  Everything is up to date!</Text>
            )}
          </Box>

          {/* Outdated — packages list (max 3) */}
          {withOutdated.map((m, i) => (
            <Box key={`out-${i}`} flexDirection="column" marginBottom={1}>
              <Box>
                <Text bold>{m.manager.icon} {m.manager.name}</Text>
                <Text color="yellow"> ({m.outdated.length})</Text>
              </Box>
              {m.outdated.slice(0, 3).map((pkg, j) => {
                const delta = getVersionDelta(pkg.current, pkg.latest);
                return (
                  <Box key={j} marginLeft={2}>
                    <Text dimColor>· {pkg.name}  </Text>
                    <Text dimColor>{pkg.current} → </Text>
                    <Text color="green">{pkg.latest}</Text>
                    <Text bold color={deltaColor[delta]}> [{delta}]</Text>
                  </Box>
                );
              })}
              {m.outdated.length > 3 && (
                <Box marginLeft={2}><Text dimColor>  + {m.outdated.length - 3} more...</Text></Box>
              )}
            </Box>
          ))}

          {/* Up-to-date */}
          {upToDate.map((m, i) => (
            <Box key={`up-${i}`}>
              <Text dimColor>{m.manager.icon} {m.manager.name} </Text>
              <Text color="green">✔</Text>
            </Box>
          ))}
        </Box>

      </Box>

      {/* ── Footer ── */}
      <Box marginTop={1} gap={2}>
        <Text dimColor>[↑↓] or [jk]  move</Text>
        <Text dimColor>[enter] or [→]  select</Text>
        <Text dimColor>[u/x/m/l]  shortcut</Text>
        <Text dimColor>[q]  quit</Text>
      </Box>

    </Box>
  );
}
