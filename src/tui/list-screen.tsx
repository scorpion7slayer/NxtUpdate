import { Box, Text, Spacer, useInput } from "ink";
import { useState, useMemo } from "react";
import type { ManagerData } from "./app.tsx";
import { getVersionDelta } from "../utils/version.ts";

interface Props {
  managers: ManagerData[];
  onBack: () => void;
}

type FlatItem =
  | { type: "manager"; index: number; manager: ManagerData }
  | { type: "package"; managerIdx: number; pkgIdx: number; name: string; current: string; latest: string; path: string };

const VISIBLE = 18;
const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

export function ListScreen({ managers, onBack }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(managers.filter((m) => m.outdated.length > 0).map((_, i) => i))
  );
  const [nav, setNav] = useState({ cursor: 0, scroll: 0 });

  const withOutdated  = managers.filter((m) => m.outdated.length > 0);
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

  const clamp  = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const moveTo = (next: number) => {
    const c = clamp(next, 0, Math.max(0, flatItems.length - 1));
    setNav({ cursor: c, scroll: c < nav.scroll ? c : c >= nav.scroll + VISIBLE ? c - VISIBLE + 1 : nav.scroll });
  };

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

  const visible  = flatItems.slice(nav.scroll, nav.scroll + VISIBLE);
  const showUp   = nav.scroll > 0;
  const showDown = nav.scroll + VISIBLE < flatItems.length;

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

      {withOutdated.length === 0 && (
        <Box borderStyle="round" borderColor="green" paddingX={1}>
          <Text color="green">✔ Everything is up to date!</Text>
        </Box>
      )}

      {showUp && <Box><Text color="yellow" dimColor>  ↑ {nav.scroll} more above</Text></Box>}

      {/* ── List ── */}
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {visible.map((item, vi) => {
          const isCur = nav.scroll + vi === nav.cursor;

          if (item.type === "manager") {
            const m = item.manager;
            const hasMajor = m.outdated.some((p) => getVersionDelta(p.current, p.latest) === "MAJOR");
            return (
              <Box key={`m-${item.index}`}>
                <Text inverse={isCur} bold>
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
            <Box key={`p-${item.managerIdx}-${item.pkgIdx}`} marginLeft={4} flexDirection="column">
              <Box>
                <Text inverse={isCur} color={isCur ? undefined : "gray"}>
                  {isCur ? " > " : "   "}
                  {item.name}
                  {"  "}{item.current}{" → "}{item.latest}{"  "}
                </Text>
                <Text bold color={deltaColor[delta]}> [{delta}]</Text>
              </Box>
              {item.path && isCur && (
                <Box marginLeft={5}>
                  <Text dimColor>{item.path}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {showDown && <Box><Text color="yellow" dimColor>  ↓ {flatItems.length - nav.scroll - VISIBLE} more below</Text></Box>}

      {/* ── Footer ── */}
      <Box marginTop={1} gap={2}>
        <Text dimColor>[↑↓]/[jk]  move</Text>
        <Text dimColor>[→]/[enter]  expand</Text>
        <Text dimColor>[←]  collapse</Text>
        <Text dimColor>[q]  back</Text>
      </Box>

    </Box>
  );
}
