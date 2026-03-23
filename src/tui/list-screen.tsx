import { Box, Text, useInput } from "ink";
import { useState, useMemo } from "react";
import type { ManagerData } from "./app.tsx";

interface Props {
  managers: ManagerData[];
  onBack: () => void;
}

type FlatItem =
  | { type: "manager"; index: number; manager: ManagerData }
  | { type: "package"; managerIdx: number; pkgIdx: number; name: string; current: string; latest: string; path: string };

const VISIBLE = 15;

export function ListScreen({ managers, onBack }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [nav, setNav] = useState({ cursor: 0, scroll: 0 });

  const withOutdated = managers.filter((m) => m.outdated.length > 0);

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

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const moveTo = (newCursor: number) => {
    const c = clamp(newCursor, 0, flatItems.length - 1);
    setNav({
      cursor: c,
      scroll: c < nav.scroll ? c : c >= nav.scroll + VISIBLE ? c - VISIBLE + 1 : nav.scroll,
    });
  };

  useInput((input, key) => {
    const item = flatItems[nav.cursor];

    if (key.escape || input === "q" || (key.leftArrow && !(item?.type === "manager" && expanded.has(item.index)))) {
      if (key.leftArrow && item?.type === "package") {
        const hdrIdx = flatItems.findIndex((f) => f.type === "manager" && f.index === item.managerIdx);
        if (hdrIdx >= 0) moveTo(hdrIdx);
        return;
      }
      onBack();
      return;
    }
    if (key.leftArrow && item?.type === "manager" && expanded.has(item.index)) {
      setExpanded((p) => { const n = new Set(p); n.delete(item.index); return n; });
      return;
    }
    if (key.upArrow || input === "k") moveTo(nav.cursor - 1);
    if (key.downArrow || input === "j") moveTo(nav.cursor + 1);
    if (key.return || key.rightArrow) {
      if (item?.type === "manager") {
        const willExpand = !expanded.has(item.index);
        setExpanded((p) => { const n = new Set(p); if (n.has(item.index)) n.delete(item.index); else n.add(item.index); return n; });
        if (willExpand) moveTo(nav.cursor + 1);
      }
    }
  });

  const visible = flatItems.slice(nav.scroll, nav.scroll + VISIBLE);
  const showUp = nav.scroll > 0;
  const showDown = nav.scroll + VISIBLE < flatItems.length;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan">📋 Outdated Packages</Text>
        <Text dimColor> — →/enter expand · ←/q back</Text>
      </Box>

      {showUp && <Box><Text dimColor color="yellow">  ↑ {nav.scroll} more above</Text></Box>}

      <Box flexDirection="column">
        {visible.map((item, vi) => {
          const isCur = nav.scroll + vi === nav.cursor;
          if (item.type === "manager") {
            const m = item.manager;
            return (
              <Box key={`m-${item.index}`}>
                <Text color={isCur ? "cyan" : "gray"}>{isCur ? "❯ " : "  "}</Text>
                <Text bold color={isCur ? "cyan" : "white"}>
                  {expanded.has(item.index) ? "▼" : "▶"} {m.manager.icon} {m.manager.name}
                </Text>
                <Text dimColor> ({m.outdated.length} outdated)</Text>
              </Box>
            );
          }
          return (
            <Box key={`p-${item.managerIdx}-${item.pkgIdx}`} marginLeft={4} flexDirection="column">
              <Box>
                <Text color={isCur ? "cyan" : "gray"}>{isCur ? "❯ " : "  "}</Text>
                <Text bold={isCur} color={isCur ? "white" : "gray"}>{item.name}</Text>
                <Text dimColor> {item.current}</Text>
                <Text color="yellow"> → </Text>
                <Text color="green">{item.latest}</Text>
              </Box>
              {item.path && <Box marginLeft={3}><Text dimColor>{item.path}</Text></Box>}
            </Box>
          );
        })}
      </Box>

      {showDown && <Box><Text dimColor color="yellow">  ↓ {flatItems.length - nav.scroll - VISIBLE} more below</Text></Box>}

      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate · →/enter expand · ← collapse/back</Text>
      </Box>
    </Box>
  );
}
