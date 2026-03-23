import { Box, Text, useInput } from "ink";
import { useState, useMemo } from "react";
import type { ManagerData } from "./app.tsx";
import type { OutdatedPackage } from "../detectors/types.ts";

interface Props {
  managers: ManagerData[];
  title: string;
  onConfirm: (selected: ManagerData[]) => void;
  onBack: () => void;
}

type FlatItem =
  | { type: "header"; managerIdx: number; manager: ManagerData; allChecked: boolean }
  | { type: "package"; managerIdx: number; pkgIdx: number; pkg: OutdatedPackage; checked: boolean };

const VISIBLE = 15;

export function SelectPackagesScreen({ managers, title, onConfirm, onBack }: Props) {
  const withOutdated = managers.filter((m) => m.outdated.length > 0);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(() => {
    const all = new Set<string>();
    withOutdated.forEach((m, mi) => m.outdated.forEach((_, pi) => all.add(`${mi}-${pi}`)));
    return all;
  });

  // Cursor + scroll in ONE state — never desync
  const [nav, setNav] = useState({ cursor: 0, scroll: 0 });

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    withOutdated.forEach((m, mi) => {
      const pkgKeys = m.outdated.map((_, pi) => `${mi}-${pi}`);
      items.push({ type: "header", managerIdx: mi, manager: m, allChecked: pkgKeys.every((k) => checked.has(k)) });
      if (expanded.has(mi)) {
        m.outdated.forEach((pkg, pi) => {
          items.push({ type: "package", managerIdx: mi, pkgIdx: pi, pkg, checked: checked.has(`${mi}-${pi}`) });
        });
      }
    });
    return items;
  }, [withOutdated, checked, expanded]);

  const totalChecked = checked.size;
  const totalPackages = withOutdated.reduce((s, m) => s + m.outdated.length, 0);

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

    if (key.escape || input === "q" || key.leftArrow) {
      if (key.leftArrow && item?.type === "header" && expanded.has(item.managerIdx)) {
        setExpanded((p) => { const n = new Set(p); n.delete(item.managerIdx); return n; });
        return;
      }
      if (key.leftArrow && item?.type === "package") {
        // Jump back to header
        const hdrIdx = flatItems.findIndex((f) => f.type === "header" && f.managerIdx === item.managerIdx);
        if (hdrIdx >= 0) moveTo(hdrIdx);
        return;
      }
      onBack();
      return;
    }
    if (key.upArrow || input === "k") moveTo(nav.cursor - 1);
    if (key.downArrow || input === "j") moveTo(nav.cursor + 1);

    if (input === "a") {
      if (totalChecked === totalPackages) setChecked(new Set());
      else { const a = new Set<string>(); withOutdated.forEach((m, mi) => m.outdated.forEach((_, pi) => a.add(`${mi}-${pi}`))); setChecked(a); }
    }

    if (key.return || key.rightArrow || input === " ") {
      if (!item) return;
      if (item.type === "header") {
        const willExpand = !expanded.has(item.managerIdx);
        setExpanded((p) => { const n = new Set(p); if (n.has(item.managerIdx)) n.delete(item.managerIdx); else n.add(item.managerIdx); return n; });
        if (willExpand) {
          // Move cursor to first package after this header (it will exist after re-render)
          // We can't know the new index yet, so we set cursor to header+1 optimistically
          moveTo(nav.cursor + 1);
        }
      } else {
        setChecked((p) => {
          const k = `${item.managerIdx}-${item.pkgIdx}`;
          const n = new Set(p);
          if (n.has(k)) n.delete(k); else n.add(k);
          return n;
        });
      }
    }

    if (input === "c") {
      if (totalChecked === 0) return;
      const selected: ManagerData[] = [];
      withOutdated.forEach((m, mi) => {
        const pkgs = m.outdated.filter((_, pi) => checked.has(`${mi}-${pi}`));
        if (pkgs.length > 0) selected.push({ manager: m.manager, outdated: pkgs });
      });
      onConfirm(selected);
    }
  });

  const visible = flatItems.slice(nav.scroll, nav.scroll + VISIBLE);
  const showUp = nav.scroll > 0;
  const showDown = nav.scroll + VISIBLE < flatItems.length;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}><Text bold color="cyan">{title}</Text></Box>
      <Box marginBottom={1}>
        <Text>
          <Text color={totalChecked > 0 ? "green" : "red"} bold>{totalChecked}</Text>
          <Text dimColor>/{totalPackages} selected</Text>
        </Text>
      </Box>

      {showUp && <Box><Text dimColor color="yellow">  ↑ {nav.scroll} more above</Text></Box>}

      <Box flexDirection="column">
        {visible.map((item, vi) => {
          const isCur = nav.scroll + vi === nav.cursor;
          if (item.type === "header") {
            return (
              <Box key={`h-${item.managerIdx}`}>
                <Text color={isCur ? "cyan" : "gray"}>{isCur ? "❯ " : "  "}</Text>
                <Text color={item.allChecked ? "green" : "yellow"}>{item.allChecked ? "[✔]" : "[ ]"}</Text>
                <Text bold color={isCur ? "cyan" : "white"}>
                  {" "}{expanded.has(item.managerIdx) ? "▼" : "▶"} {item.manager.manager.icon} {item.manager.manager.name}
                </Text>
                <Text dimColor> ({item.manager.outdated.length})</Text>
              </Box>
            );
          }
          return (
            <Box key={`p-${item.managerIdx}-${item.pkgIdx}`} marginLeft={4} flexDirection="column">
              <Box>
                <Text color={isCur ? "cyan" : "gray"}>{isCur ? "❯ " : "  "}</Text>
                <Text color={item.checked ? "green" : "gray"}>{item.checked ? "✔" : "○"}</Text>
                <Text bold={isCur} color={isCur ? "white" : "gray"}> {item.pkg.name}</Text>
                <Text dimColor> {item.pkg.current}</Text>
                <Text color="yellow"> → </Text>
                <Text color="green">{item.pkg.latest}</Text>
              </Box>
              {item.pkg.path && <Box marginLeft={3}><Text dimColor>{item.pkg.path}</Text></Box>}
            </Box>
          );
        })}
      </Box>

      {showDown && <Box><Text dimColor color="yellow">  ↓ {flatItems.length - nav.scroll - VISIBLE} more below</Text></Box>}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>↑↓ navigate · → expand · ← collapse · space toggle · a all · c confirm · q back</Text>
      </Box>
    </Box>
  );
}
