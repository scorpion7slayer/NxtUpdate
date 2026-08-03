import { Box, Text, Spacer, useInput } from "ink";
import { useEffect, useState, useMemo } from "react";
import type { ManagerData } from "./app.tsx";
import { getVersionDelta } from "../utils/version.ts";
import { KeyHints } from "./key-hints.tsx";
import { getViewportRows, useTerminalSize } from "./use-terminal-size.ts";
import { usePackagePath } from "./use-package-path.ts";

interface Props {
  managers: ManagerData[];
  onBack: () => void;
}

type FlatItem =
  | { type: "manager"; index: number; manager: ManagerData }
  | { type: "package"; managerIdx: number; pkgIdx: number; name: string; current: string; latest: string; path: string };

const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

export function ListScreen({ managers, onBack }: Props) {
  const { columns, rows } = useTerminalSize();
  const compact = columns < 96 || rows < 28;
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(managers.filter((m) => m.outdated.length > 0).map((_, i) => i))
  );
  const [nav, setNav] = useState({ cursor: 0, scroll: 0 });

  const withOutdated = useMemo(
    () => managers.filter((manager) => manager.outdated.length > 0),
    [managers]
  );
  const skipped = useMemo(
    () => managers.filter((manager) => manager.manager.skipReason),
    [managers]
  );
  const skippedPanelRows = skipped.length > 0 ? skipped.length + 3 : 0;
  const visibleCount = getViewportRows(
    rows,
    (compact ? 7 : 8) + skippedPanelRows,
    20,
  );
  const totalOutdated = withOutdated.reduce((s, m) => s + m.outdated.length, 0);

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    withOutdated.forEach((m, idx) => {
      items.push({ type: "manager", index: idx, manager: m });
      if (expanded.has(idx)) {
        m.outdated.forEach((pkg, pi) => {
          items.push({ type: "package", managerIdx: idx, pkgIdx: pi, name: pkg.name, current: pkg.current, latest: pkg.latest, path: pkg.path ?? "" });
        });
      }
    });
    return items;
  }, [withOutdated, expanded]);

  const activeItem = flatItems[nav.cursor];
  const activeManager = activeItem?.type === "package"
    ? withOutdated[activeItem.managerIdx]
    : undefined;
  const activePath = usePackagePath(
    activeManager?.manager.name,
    activeItem?.type === "package" ? activeItem.name : undefined,
    activeItem?.type === "package" ? activeItem.path : ""
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

  useInput((input, key) => {
    const item = flatItems[nav.cursor];

    if (key.escape || input === "q") { onBack(); return; }
    if (key.leftArrow) {
      if (item?.type === "package") {
        const hdr = flatItems.findIndex((f) => f.type === "manager" && f.index === item.managerIdx);
        if (hdr >= 0) moveTo(hdr); return;
      }
      if (item?.type === "manager" && expanded.has(item.index)) {
        setExpanded((p) => { const n = new Set(p); n.delete(item.index); return n; }); return;
      }
      onBack(); return;
    }

    if (key.upArrow   || input === "k") { moveTo(nav.cursor - 1); return; }
    if (key.downArrow || input === "j") { moveTo(nav.cursor + 1); return; }

    if (key.return || key.rightArrow) {
      if (item?.type === "manager") {
        const willExpand = !expanded.has(item.index);
        setExpanded((p) => { const n = new Set(p); n.has(item.index) ? n.delete(item.index) : n.add(item.index); return n; });
        if (willExpand) moveTo(nav.cursor + 1);
      }
    }
  });

  const visible  = flatItems.slice(nav.scroll, nav.scroll + visibleCount);
  const showUp   = nav.scroll > 0;
  const showDown = nav.scroll + visibleCount < flatItems.length;

  return (
    <Box flexDirection="column" paddingX={1}>

      {/* ── Header ── */}
      <Box marginBottom={1}>
        <Text bold color="cyan">📋 Outdated Packages</Text>
        <Spacer />
        <Text bold color="yellow">{totalOutdated}</Text>
        <Text dimColor> across </Text>
        <Text bold color="yellow">{withOutdated.length}</Text>
        <Text dimColor> manager(s)</Text>
      </Box>

      {withOutdated.length === 0 && skipped.length === 0 && (
        <Box borderStyle="single" borderColor="green" paddingX={1}>
          <Text color="green">✔ Everything is up to date!</Text>
        </Box>
      )}

      {skipped.length > 0 && (
        <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
          {withOutdated.length === 0 && (
            <Text color="yellow" bold>✔ No actionable updates</Text>
          )}
          {skipped.map((manager) => (
            <Text key={manager.manager.name} color="yellow" wrap="truncate-end">
              ○ {manager.manager.name} skipped · {manager.manager.skipReason}
            </Text>
          ))}
        </Box>
      )}

      {showUp && <Box><Text color="yellow" dimColor>  ↑ {nav.scroll} more above</Text></Box>}

      {/* ── List ── */}
      {flatItems.length > 0 && (
        <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
          {visible.map((item, vi) => {
            const isCur = nav.scroll + vi === nav.cursor;

            if (item.type === "manager") {
              const m = item.manager;
              const hasMajor = m.outdated.some((p) => getVersionDelta(p.current, p.latest) === "MAJOR");
              return (
                <Box key={`m-${item.index}`}>
                  <Text inverse={isCur} bold wrap="truncate-end">
                    {isCur ? " > " : "   "}
                    {expanded.has(item.index) ? "▼ " : "▶ "}
                    {m.manager.icon} {m.manager.name}
                    {"  "}{m.outdated.length} pkg(s){"  "}
                  </Text>
                  {hasMajor && <Text color="red" bold> ⚠ MAJOR</Text>}
                </Box>
              );
            }

            const delta = getVersionDelta(item.current, item.latest);
            return (
              <Box key={`p-${item.managerIdx}-${item.pkgIdx}`} marginLeft={compact ? 2 : 4} flexDirection="column">
                <Box>
                  <Text inverse={isCur} color={isCur ? undefined : "gray"} wrap="truncate-middle">
                    {isCur ? " > " : "   "}
                    {item.name}
                    {"  "}{item.current}{" → "}{item.latest}{"  "}
                  </Text>
                  <Text bold color={deltaColor[delta]}> [{delta}]</Text>
                </Box>
                {isCur && (activePath.loading || activePath.path) && (
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
      )}

      {showDown && <Box><Text>  ↓ {flatItems.length - nav.scroll - visibleCount} more below</Text></Box>}

      <KeyHints
        compact={compact}
        hints={flatItems.length > 0
          ? [
              { keys: "↑↓/jk", label: "move" },
              { keys: "enter/→", label: "expand" },
              { keys: "←", label: "collapse/back" },
              { keys: "esc/q", label: "back" },
            ]
          : [{ keys: "esc/q", label: "back" }]}
      />

    </Box>
  );
}
