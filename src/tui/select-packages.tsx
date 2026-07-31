import { Box, Text, Spacer, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import type { ManagerData } from "./app.tsx";
import type { OutdatedPackage } from "../detectors/types.ts";
import { getVersionDelta } from "../utils/version.ts";
import { KeyHints } from "./key-hints.tsx";
import { getViewportRows, useTerminalSize } from "./use-terminal-size.ts";
import { usePackagePath } from "./use-package-path.ts";

interface Props {
  managers: ManagerData[];
  title: string;
  mode?: "update" | "uninstall";
  initialSelected?: ManagerData[];
  onConfirm: (selected: ManagerData[]) => void;
  onBack: () => void;
}

type FlatItem =
  | {
      type: "header";
      managerIdx: number;
      manager: ManagerData;
      selectedCount: number;
    }
  | {
      type: "package";
      managerIdx: number;
      pkgIdx: number;
      pkg: OutdatedPackage;
      checked: boolean;
    };

const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

export function SelectPackagesScreen({
  managers,
  title,
  mode = "update",
  initialSelected = [],
  onConfirm,
  onBack,
}: Props) {
  const { columns, rows } = useTerminalSize();
  const compact = columns < 96 || rows < 28;
  const visibleCount = getViewportRows(rows, compact ? 10 : 11, 18);
  const withPackages = useMemo(
    () => managers.filter((manager) => manager.outdated.length > 0),
    [managers]
  );

  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(withPackages.map((_, index) => index))
  );
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (mode === "uninstall") {
      const selectedByManager = new Map(
        initialSelected.map((manager) => [
          manager.manager.name,
          new Set(manager.outdated.map((pkg) => pkg.name)),
        ])
      );
      const selected = new Set<string>();
      withPackages.forEach((manager, managerIdx) => {
        manager.outdated.forEach((pkg, pkgIdx) => {
          if (selectedByManager.get(manager.manager.name)?.has(pkg.name)) {
            selected.add(`${managerIdx}-${pkgIdx}`);
          }
        });
      });
      return selected;
    }
    const all = new Set<string>();
    withPackages.forEach((manager, managerIdx) => {
      manager.outdated.forEach((_, pkgIdx) => all.add(`${managerIdx}-${pkgIdx}`));
    });
    return all;
  });
  const [nav, setNav] = useState({ cursor: 0, scroll: 0 });
  const [filterMode, setFilterMode] = useState(false);
  const [filterText, setFilterText] = useState("");

  const flatItems: FlatItem[] = useMemo(() => {
    const query = filterText.toLowerCase();
    const items: FlatItem[] = [];

    withPackages.forEach((manager, managerIdx) => {
      if (filterText) {
        manager.outdated.forEach((pkg, pkgIdx) => {
          if (pkg.name.toLowerCase().includes(query)) {
            items.push({
              type: "package",
              managerIdx,
              pkgIdx,
              pkg,
              checked: checked.has(`${managerIdx}-${pkgIdx}`),
            });
          }
        });
        return;
      }

      const selectedCount = manager.outdated.reduce(
        (count, _, pkgIdx) => count + (checked.has(`${managerIdx}-${pkgIdx}`) ? 1 : 0),
        0
      );
      items.push({ type: "header", managerIdx, manager, selectedCount });
      if (expanded.has(managerIdx)) {
        manager.outdated.forEach((pkg, pkgIdx) => {
          items.push({
            type: "package",
            managerIdx,
            pkgIdx,
            pkg,
            checked: checked.has(`${managerIdx}-${pkgIdx}`),
          });
        });
      }
    });

    return items;
  }, [withPackages, checked, expanded, filterText]);

  const activeItem = flatItems[nav.cursor];
  const activeManager = activeItem?.type === "package"
    ? withPackages[activeItem.managerIdx]
    : undefined;
  const activePath = usePackagePath(
    activeManager?.manager.name,
    activeItem?.type === "package" ? activeItem.pkg.name : undefined,
    activeItem?.type === "package" ? activeItem.pkg.path ?? "" : ""
  );

  const totalChecked = checked.size;
  const totalPackages = withPackages.reduce(
    (sum, manager) => sum + manager.outdated.length,
    0
  );

  const moveTo = (next: number) => {
    setNav((previous) => {
      const cursor = Math.max(0, Math.min(next, Math.max(0, flatItems.length - 1)));
      const scroll = cursor < previous.scroll
        ? cursor
        : cursor >= previous.scroll + visibleCount
          ? cursor - visibleCount + 1
          : previous.scroll;
      return { cursor, scroll };
    });
  };

  useEffect(() => {
    setNav((previous) => {
      const cursor = Math.min(previous.cursor, Math.max(0, flatItems.length - 1));
      const maxScroll = Math.max(0, flatItems.length - visibleCount);
      return { cursor, scroll: Math.min(previous.scroll, maxScroll) };
    });
  }, [flatItems.length, visibleCount]);

  const togglePackage = (key: string) => {
    setChecked((previous) => {
      const next = new Set(previous);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleManager = (managerIdx: number) => {
    const manager = withPackages[managerIdx];
    if (!manager) return;
    const keys = manager.outdated.map((_, pkgIdx) => `${managerIdx}-${pkgIdx}`);
    const allSelected = keys.every((key) => checked.has(key));
    setChecked((previous) => {
      const next = new Set(previous);
      keys.forEach((key) => allSelected ? next.delete(key) : next.add(key));
      return next;
    });
  };

  const selectAll = () => {
    if (totalChecked === totalPackages) {
      setChecked(new Set());
      return;
    }
    const all = new Set<string>();
    withPackages.forEach((manager, managerIdx) => {
      manager.outdated.forEach((_, pkgIdx) => all.add(`${managerIdx}-${pkgIdx}`));
    });
    setChecked(all);
  };

  const confirm = () => {
    if (totalChecked === 0) return;
    const selected: ManagerData[] = [];
    withPackages.forEach((manager, managerIdx) => {
      const packages = manager.outdated.filter((_, pkgIdx) =>
        checked.has(`${managerIdx}-${pkgIdx}`)
      );
      if (packages.length > 0) {
        selected.push({ manager: manager.manager, outdated: packages });
      }
    });
    onConfirm(selected);
  };

  useInput((input, key) => {
    if (filterMode) {
      if (key.escape) {
        setFilterMode(false);
        setFilterText("");
        moveTo(0);
        return;
      }
      if (key.return) {
        setFilterMode(false);
        return;
      }
      if (key.backspace || key.delete) {
        setFilterText((text) => text.slice(0, -1));
        moveTo(0);
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.tab) {
        setFilterText((text) => text + input);
        moveTo(0);
      }
      return;
    }

    if (input === "/") {
      setFilterMode(true);
      return;
    }
    if (key.escape) {
      if (filterText) {
        setFilterText("");
        moveTo(0);
      } else {
        onBack();
      }
      return;
    }
    if (input === "q") {
      onBack();
      return;
    }

    const item = flatItems[nav.cursor];

    if (key.leftArrow) {
      if (item?.type === "package" && !filterText) {
        const header = flatItems.findIndex(
          (entry) => entry.type === "header" && entry.managerIdx === item.managerIdx
        );
        if (header >= 0) moveTo(header);
        return;
      }
      if (item?.type === "header" && expanded.has(item.managerIdx)) {
        setExpanded((previous) => {
          const next = new Set(previous);
          next.delete(item.managerIdx);
          return next;
        });
        return;
      }
      onBack();
      return;
    }

    if (key.upArrow || input === "k") {
      moveTo(nav.cursor - 1);
      return;
    }
    if (key.downArrow || input === "j") {
      moveTo(nav.cursor + 1);
      return;
    }
    if (input === "a") {
      selectAll();
      return;
    }
    if (key.rightArrow && item?.type === "header") {
      if (!expanded.has(item.managerIdx)) {
        setExpanded((previous) => new Set(previous).add(item.managerIdx));
        moveTo(nav.cursor + 1);
      }
      return;
    }
    if (input === " ") {
      if (item?.type === "header") {
        toggleManager(item.managerIdx);
      } else if (item?.type === "package") {
        togglePackage(`${item.managerIdx}-${item.pkgIdx}`);
      }
      return;
    }
    if (key.return || input === "c") {
      confirm();
    }
  });

  const visible = flatItems.slice(nav.scroll, nav.scroll + visibleCount);
  const showUp = nav.scroll > 0;
  const showDown = nav.scroll + visibleCount < flatItems.length;
  const selectionColor = totalChecked === 0
    ? "gray"
    : mode === "uninstall"
      ? "red"
      : "green";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={mode === "uninstall" ? "red" : "cyan"}>{title}</Text>
        <Spacer />
        <Text bold color={selectionColor}>{totalChecked}</Text>
        <Text>/{totalPackages} selected</Text>
      </Box>

      <Box
        marginBottom={1}
        borderStyle="single"
        borderColor={filterMode ? "cyan" : filterText ? "yellow" : "gray"}
        paddingX={1}
      >
        {filterMode ? (
          <>
            <Text>Search: </Text>
            <Text color="cyan" bold>{filterText || " "}</Text>
            <Text color="cyan">▌</Text>
            <Spacer />
            <Text>esc cancel</Text>
          </>
        ) : filterText ? (
          <Text wrap="truncate-end">
            Filter: <Text color="yellow">{filterText}</Text> · {flatItems.length} match(es) · esc clear
          </Text>
        ) : (
          <Text>/ search · space toggle · a all/none · enter continue</Text>
        )}
      </Box>

      {showUp && <Text>↑ {nav.scroll} more above</Text>}

      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        {visible.length === 0 && (
          <Text>
            {filterText
              ? `No packages match "${filterText}"`
              : mode === "uninstall"
                ? "No installed packages available."
                : "✔ Everything is up to date."}
          </Text>
        )}

        {visible.map((item, visibleIndex) => {
          const active = nav.scroll + visibleIndex === nav.cursor;
          if (item.type === "header") {
            const total = item.manager.outdated.length;
            const mark = item.selectedCount === total ? "■" : item.selectedCount > 0 ? "◩" : "□";
            return (
              <Text key={`h-${item.managerIdx}`} inverse={active} bold={active} wrap="truncate-end">
                {active ? " › " : "   "}
                {mark} {expanded.has(item.managerIdx) ? "▼" : "▶"}{" "}
                {item.manager.manager.icon} {item.manager.manager.name} · {item.selectedCount}/{total}
              </Text>
            );
          }

          const delta = mode === "update"
            ? getVersionDelta(item.pkg.current, item.pkg.latest)
            : null;
          return (
            <Box
              key={`p-${item.managerIdx}-${item.pkgIdx}`}
              marginLeft={filterText ? 0 : compact ? 2 : 4}
              flexDirection="column"
            >
              <Text
                inverse={active}
                color={item.checked ? (mode === "uninstall" ? "red" : "green") : active ? undefined : "gray"}
                wrap="truncate-middle"
              >
                {active ? " › " : "   "}
                {item.checked ? "■ " : "□ "}
                {item.pkg.name}
                {mode === "update"
                  ? `  ${item.pkg.current} → ${item.pkg.latest}`
                  : `  ${item.pkg.current}`}
                {delta && <Text bold color={deltaColor[delta]}> [{delta}]</Text>}
              </Text>
              {active && (activePath.loading || activePath.path) && (
                <Box marginLeft={5}>
                  <Text wrap="truncate-middle">
                    {activePath.loading ? "Resolving install location…" : activePath.path}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {showDown && <Text>↓ {flatItems.length - nav.scroll - visibleCount} more below</Text>}

      <KeyHints
        compact={compact}
        hints={compact
          ? [
              { keys: "↑↓", label: "move" },
              { keys: "space", label: "toggle" },
              { keys: "enter", label: "continue" },
              { keys: "esc/q", label: "back" },
            ]
          : [
              { keys: "↑↓/jk", label: "move" },
              { keys: "space", label: "toggle package/group" },
              { keys: "←/→", label: "collapse/expand" },
              { keys: "a", label: "all/none" },
              { keys: "/", label: "search" },
              { keys: "enter", label: "continue" },
              { keys: "esc/q", label: "back" },
            ]}
      />
    </Box>
  );
}
