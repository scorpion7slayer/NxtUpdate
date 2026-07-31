import { Box, Text, Spacer, useApp, useInput } from "ink";
import { useEffect } from "react";
import type { ManagerData } from "./app.tsx";
import type { CliOptions } from "../detectors/types.ts";
import type { UpdateInfo } from "../utils/version.ts";
import { VERSION, getVersionDelta } from "../utils/version.ts";
import { KeyHints } from "./key-hints.tsx";
import { useTerminalSize } from "./use-terminal-size.ts";

interface Props {
  managers: ManagerData[];
  options: CliOptions;
  updateInfo: UpdateInfo | null;
  selected: number;
  onSelectionChange: (index: number) => void;
  onStartUpdate: () => void;
  onUninstall: () => void;
  onViewList: () => void;
  onViewMoleTip: () => void;
}

type MenuAction = "update" | "uninstall" | "mole-tip" | "list" | "quit";

const menuItems: { label: string; action: MenuAction; icon: string; hint: string; key: string }[] = [
  { label: "Update packages",       action: "update",    icon: "↑", hint: "Select and update outdated packages", key: "u" },
  { label: "Uninstall packages",    action: "uninstall", icon: "−", hint: "Review installed packages before removal", key: "x" },
  { label: "Mole for macOS apps",   action: "mole-tip",  icon: "◇", hint: "Open Mole CLI instructions and application link", key: "m" },
  { label: "View outdated list",    action: "list",      icon: "≡", hint: "Browse every outdated package", key: "l" },
  { label: "Quit",                  action: "quit",      icon: "·", hint: "Exit NxtUpdate", key: "q" },
];

const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

export function MainMenu({
  managers,
  options,
  updateInfo,
  selected,
  onSelectionChange,
  onStartUpdate,
  onUninstall,
  onViewList,
  onViewMoleTip,
}: Props) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();
  const compact = columns < 96 || rows < 28;
  const withOutdated = managers.filter((manager) => manager.outdated.length > 0);
  const upToDate = managers.filter((manager) => manager.outdated.length === 0);
  const totalOutdated = withOutdated.reduce((sum, manager) => sum + manager.outdated.length, 0);

  const isDisabled = (index: number) => {
    const action = menuItems[index]?.action;
    return totalOutdated === 0 && (action === "update" || action === "list");
  };

  const moveSelection = (direction: -1 | 1) => {
    for (let step = 1; step <= menuItems.length; step++) {
      const next = (selected + direction * step + menuItems.length) % menuItems.length;
      if (!isDisabled(next)) {
        onSelectionChange(next);
        return;
      }
    }
  };

  const doSelect = (index: number) => {
    if (isDisabled(index)) return;
    switch (menuItems[index]!.action) {
      case "update":    onStartUpdate(); break;
      case "uninstall": onUninstall(); break;
      case "mole-tip":  onViewMoleTip(); break;
      case "list":      onViewList(); break;
      case "quit":      exit(); break;
    }
  };

  useEffect(() => {
    if (isDisabled(selected)) {
      const firstAvailable = menuItems.findIndex((_, index) => !isDisabled(index));
      if (firstAvailable >= 0) onSelectionChange(firstAvailable);
    }
  }, [totalOutdated, selected]);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      moveSelection(-1);
      return;
    }
    if (key.downArrow || input === "j") {
      moveSelection(1);
      return;
    }
    if (key.return || key.rightArrow) {
      doSelect(selected);
      return;
    }

    const byKey = menuItems.findIndex((item) => item.key === input);
    if (byKey >= 0) {
      onSelectionChange(byKey);
      doSelect(byKey);
    }
  });

  const previewManagers = withOutdated.slice(0, compact ? 3 : Math.max(3, rows - 18));

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">NxtUpdate</Text>
        <Text> · macOS package maintenance</Text>
        {options.dryRun && <Text color="yellow"> · DRY RUN</Text>}
        <Spacer />
        <Text>v{VERSION}</Text>
      </Box>

      {updateInfo?.hasUpdate && (
        <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>Update available </Text>
          <Text>v{updateInfo.current} → v{updateInfo.latest}</Text>
          {!compact && <Text> · npm i -g nxtupdate</Text>}
        </Box>
      )}

      <Box flexDirection={compact ? "column" : "row"} gap={1}>
        <Box
          flexDirection="column"
          width={compact ? "100%" : 38}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold>Actions</Text>
          <Box marginTop={compact ? 0 : 1} flexDirection="column">
            {menuItems.map((item, index) => {
              const active = index === selected;
              const disabled = isDisabled(index);
              return (
                <Box key={item.action}>
                  <Text
                    bold={active}
                    inverse={active}
                    color={disabled ? "gray" : active ? undefined : "white"}
                  >
                    {active ? " › " : "   "}
                    {item.icon} {item.label}
                  </Text>
                  {!active && <Text color={disabled ? "gray" : undefined}> [{item.key}]</Text>}
                  {disabled && <Text color="gray"> unavailable</Text>}
                </Box>
              );
            })}
          </Box>
          <Box marginTop={compact ? 0 : 1}>
            <Text wrap="truncate-end">{menuItems[selected]?.hint ?? ""}</Text>
          </Box>
        </Box>

        <Box
          flexDirection="column"
          flexGrow={compact ? 0 : 1}
          width={compact ? "100%" : undefined}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Box justifyContent="space-between">
            <Text bold>System status</Text>
            <Text>{managers.length} manager(s)</Text>
          </Box>

          <Box marginTop={compact ? 0 : 1}>
            {totalOutdated > 0 ? (
              <Text>
                <Text bold color="yellow">{totalOutdated}</Text>
                {" outdated across "}
                <Text bold color="yellow">{withOutdated.length}</Text>
                {" manager(s)"}
              </Text>
            ) : (
              <Text color="green" bold>✔ Everything is up to date</Text>
            )}
          </Box>

          {previewManagers.map((manager) => (
            <Box key={manager.manager.name} flexDirection="column" marginTop={compact ? 0 : 1}>
              <Text wrap="truncate-end">
                <Text bold>{manager.manager.icon} {manager.manager.name}</Text>
                <Text color="yellow"> · {manager.outdated.length} outdated</Text>
              </Text>
              {!compact && manager.outdated.slice(0, 2).map((pkg) => {
                const delta = getVersionDelta(pkg.current, pkg.latest);
                return (
                  <Text key={pkg.name} wrap="truncate-middle">
                    {"  · "}{pkg.name} {pkg.current} → {pkg.latest}
                    <Text bold color={deltaColor[delta]}> [{delta}]</Text>
                  </Text>
                );
              })}
            </Box>
          ))}

          {withOutdated.length > previewManagers.length && (
            <Text>…and {withOutdated.length - previewManagers.length} more manager(s)</Text>
          )}

          {upToDate.length > 0 && (
            <Box marginTop={compact ? 0 : 1}>
              <Text color="green">✔ {upToDate.length} manager(s) current</Text>
            </Box>
          )}
        </Box>
      </Box>

      <KeyHints
        compact={compact}
        hints={[
          { keys: "↑↓/jk", label: "move" },
          { keys: "enter/→", label: "select" },
          { keys: "u/x/m/l", label: "shortcuts" },
          { keys: "q", label: "quit" },
        ]}
      />
    </Box>
  );
}
