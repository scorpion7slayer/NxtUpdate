import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { ManagerData } from "./app.tsx";
import type { CliOptions } from "../detectors/types.ts";

interface Props {
  managers: ManagerData[];
  options: CliOptions;
  onStartUpdate: () => void;
  onUninstall: () => void;
  onViewList: () => void;
  onViewMoleTip: () => void;
}

type MenuAction = "update" | "uninstall" | "mole-tip" | "list" | "quit";

const menuItems: { label: string; action: MenuAction; icon: string }[] = [
  { label: "Select packages to update", action: "update", icon: "⬆️" },
  { label: "Uninstall packages", action: "uninstall", icon: "🗑️" },
  { label: "Uninstall .app files (Mole)", action: "mole-tip", icon: "🐹" },
  { label: "View outdated packages detail", action: "list", icon: "📋" },
  { label: "Quit", action: "quit", icon: "👋" },
];

export function MainMenu({ managers, options, onStartUpdate, onUninstall, onViewList, onViewMoleTip }: Props) {
  const [selected, setSelected] = useState(0);

  const withOutdated = managers.filter((m) => m.outdated.length > 0);
  const totalOutdated = withOutdated.reduce((sum, m) => sum + m.outdated.length, 0);

  const select = () => {
    const action = menuItems[selected]!.action;
    switch (action) {
      case "update": onStartUpdate(); break;
      case "uninstall": onUninstall(); break;
      case "mole-tip": onViewMoleTip(); break;
      case "list": onViewList(); break;
      case "quit": process.exit(0);
    }
  };

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setSelected((prev: number) => (prev - 1 + menuItems.length) % menuItems.length);
    }
    if (key.downArrow || input === "j") {
      setSelected((prev: number) => (prev + 1) % menuItems.length);
    }
    if (key.return || key.rightArrow) {
      select();
    }
    if (input === "q") {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan">⬆️  NxtUpdate</Text>
        <Text dimColor> — Universal macOS Updater</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text>
          <Text bold color="yellow">{withOutdated.length}</Text>
          <Text> manager(s) with </Text>
          <Text bold color="red">{totalOutdated}</Text>
          <Text> outdated package(s)</Text>
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {withOutdated.map((m, i) => (
            <Box key={i}>
              <Text>  {m.manager.icon} {m.manager.name}</Text>
              <Text dimColor> — </Text>
              <Text color="yellow">{m.outdated.length} outdated</Text>
            </Box>
          ))}
          {withOutdated.length === 0 && <Text color="green">✔ All packages are up to date!</Text>}
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor> Actions:</Text>
        {menuItems.map((item, i) => (
          <Box key={i}>
            <Text color={i === selected ? "cyan" : "gray"}>
              {i === selected ? "❯ " : "  "}
            </Text>
            <Text bold={i === selected} color={i === selected ? "cyan" : "white"}>
              {item.icon} {item.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={2}>
        <Text dimColor>↑↓/jk navigate · →/enter select · q quit</Text>
      </Box>
    </Box>
  );
}
