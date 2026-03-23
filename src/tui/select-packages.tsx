import { Box, Text, Spacer, useInput } from "ink";
import { useState, useMemo } from "react";
import type { ManagerData } from "./app.tsx";
import type { OutdatedPackage } from "../detectors/types.ts";
import { getVersionDelta } from "../utils/version.ts";

interface Props {
  managers: ManagerData[];
  title: string;
  onConfirm: (selected: ManagerData[]) => void;
  onBack: () => void;
}

type FlatItem =
  | { type: "header";  managerIdx: number; manager: ManagerData; allChecked: boolean }
  | { type: "package"; managerIdx: number; pkgIdx: number; pkg: OutdatedPackage; checked: boolean };

const VISIBLE = 16;
const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

export function SelectPackagesScreen({ managers, title, onConfirm, onBack }: Props) {
  const withOutdated = managers.filter((m) => m.outdated.length > 0);

  // All expanded by default, all checked by default
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(withOutdated.map((_, i) => i))
  );
  const [checked, setChecked] = useState<Set<string>>(() => {
    const all = new Set<string>();
    withOutdated.forEach((m, mi) => m.outdated.forEach((_, pi) => all.add(`${mi}-${pi}`)));
    return all;
  });
  const [nav, setNav] = useState({ cursor: 0, scroll: 0 });

  // Search/filter state
  const [filterMode, setFilterMode] = useState(false);
  const [filterText, setFilterText] = useState("");

  const flatItems: FlatItem[] = useMemo(() => {
    const query = filterText.toLowerCase();
    const items: FlatItem[] = [];
    withOutdated.forEach((m, mi) => {
      if (filterText) {
        // Filter mode: flat list of matching packages only
        m.outdated.forEach((pkg, pi) => {
          if (pkg.name.toLowerCase().includes(query)) {
            items.push({ type: "package", managerIdx: mi, pkgIdx: pi, pkg, checked: checked.has(`${mi}-${pi}`) });
          }
        });
      } else {
        const pkgKeys = m.outdated.map((_, pi) => `${mi}-${pi}`);
        items.push({ type: "header", managerIdx: mi, manager: m, allChecked: pkgKeys.every((k) => checked.has(k)) });
        if (expanded.has(mi)) {
          m.outdated.forEach((pkg, pi) => {
            items.push({ type: "package", managerIdx: mi, pkgIdx: pi, pkg, checked: checked.has(`${mi}-${pi}`) });
          });
        }
      }
    });
    return items;
  }, [withOutdated, checked, expanded, filterText]);

  const totalChecked  = checked.size;
  const totalPackages = withOutdated.reduce((s, m) => s + m.outdated.length, 0);

  const clamp  = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const moveTo = (next: number) => {
    const c = clamp(next, 0, Math.max(0, flatItems.length - 1));
    setNav({ cursor: c, scroll: c < nav.scroll ? c : c >= nav.scroll + VISIBLE ? c - VISIBLE + 1 : nav.scroll });
  };

  const toggleCheck = (key: string) =>
    setChecked((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  useInput((input, key) => {
    // ── Filter mode ──
    if (filterMode) {
      if (key.escape)                              { setFilterMode(false); setFilterText(""); moveTo(0); return; }
      if (key.return)                              { setFilterMode(false); return; }
      if (key.backspace || key.delete)             { setFilterText((t) => t.slice(0, -1)); moveTo(0); return; }
      if (input && !key.ctrl && !key.meta && !key.tab) { setFilterText((t) => t + input); moveTo(0); return; }
      return;
    }

    // ── Normal mode ──
    if (input === "/") { setFilterMode(true); return; }
    if (key.escape)    { setFilterText(""); return; }

    const item = flatItems[nav.cursor];

    if (input === "q" || (key.leftArrow && !item)) { onBack(); return; }
    if (key.leftArrow) {
      if (item?.type === "header" && expanded.has(item.managerIdx)) {
        setExpanded((p) => { const n = new Set(p); n.delete(item.managerIdx); return n; }); return;
      }
      if (item?.type === "package" && !filterText) {
        const hdr = flatItems.findIndex((f) => f.type === "header" && f.managerIdx === item.managerIdx);
        if (hdr >= 0) moveTo(hdr); return;
      }
      onBack(); return;
    }

    if (key.upArrow   || input === "k") { moveTo(nav.cursor - 1); return; }
    if (key.downArrow || input === "j") { moveTo(nav.cursor + 1); return; }

    // Toggle all
    if (input === "a") {
      if (totalChecked === totalPackages) {
        setChecked(new Set());
      } else {
        const all = new Set<string>();
        withOutdated.forEach((m, mi) => m.outdated.forEach((_, pi) => all.add(`${mi}-${pi}`)));
        setChecked(all);
      }
      return;
    }

    // → : expand header uniquement
    if (key.rightArrow) {
      if (item?.type === "header" && !expanded.has(item.managerIdx)) {
        setExpanded((p) => { const n = new Set(p); n.add(item.managerIdx); return n; });
        moveTo(nav.cursor + 1);
      }
      return;
    }

    // space : toggle check (package) ou expand/collapse (header)
    if (input === " ") {
      if (!item) return;
      if (item.type === "header") {
        setExpanded((p) => { const n = new Set(p); n.has(item.managerIdx) ? n.delete(item.managerIdx) : n.add(item.managerIdx); return n; });
        if (!expanded.has(item.managerIdx)) moveTo(nav.cursor + 1);
        return;
      }
      toggleCheck(`${item.managerIdx}-${item.pkgIdx}`);
      return;
    }

    // Enter : confirmer la sélection
    if (key.return) {
      if (totalChecked === 0) return;
      const sel: ManagerData[] = [];
      withOutdated.forEach((m, mi) => {
        const pkgs = m.outdated.filter((_, pi) => checked.has(`${mi}-${pi}`));
        if (pkgs.length > 0) sel.push({ manager: m.manager, outdated: pkgs });
      });
      onConfirm(sel);
      return;
    }

    // c : alias confirmer (raccourci conservé)
    if (input === "c") {
      if (totalChecked === 0) return;
      const sel: ManagerData[] = [];
      withOutdated.forEach((m, mi) => {
        const pkgs = m.outdated.filter((_, pi) => checked.has(`${mi}-${pi}`));
        if (pkgs.length > 0) sel.push({ manager: m.manager, outdated: pkgs });
      });
      onConfirm(sel);
    }
  });

  const visible   = flatItems.slice(nav.scroll, nav.scroll + VISIBLE);
  const showUp    = nav.scroll > 0;
  const showDown  = nav.scroll + VISIBLE < flatItems.length;

  return (
    <Box flexDirection="column" paddingX={1}>

      {/* ── Header ── */}
      <Box marginBottom={1}>
        <Text bold color="cyan">{title}</Text>
        <Spacer />
        <Text bold color={totalChecked > 0 ? "green" : "red"}>{totalChecked}</Text>
        <Text dimColor>/{totalPackages} selected</Text>
      </Box>

      {/* ── Search bar ── */}
      <Box
        marginBottom={1}
        borderStyle="round"
        borderColor={filterMode ? "cyan" : filterText ? "yellow" : "gray"}
        paddingX={1}
      >
        <Text dimColor>{filterMode ? "Search: " : filterText ? "Filter: " : "/ search  ·  a all  ·  enter confirm"}</Text>
        {filterMode ? (
          <>
            <Text color="cyan" bold>{filterText || " "}</Text>
            <Text color="cyan">▌</Text>
            <Spacer />
            <Text dimColor>esc cancel</Text>
          </>
        ) : filterText ? (
          <>
            <Text color="yellow">{filterText}</Text>
            <Text dimColor>  ({flatItems.length} match)  esc clear</Text>
          </>
        ) : null}
      </Box>

      {showUp && (
        <Box><Text color="yellow" dimColor>  ↑ {nav.scroll} more above</Text></Box>
      )}

      {/* ── List ── */}
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {visible.length === 0 && (
          <Box paddingY={1}>
            {filterText
              ? <Text dimColor>No packages match "{filterText}"</Text>
              : <Text color="green">✔  Everything is up to date!</Text>
            }
          </Box>
        )}
        {visible.map((item, vi) => {
          const isCur = nav.scroll + vi === nav.cursor;
          if (item.type === "header") {
            return (
              <Box key={`h-${item.managerIdx}`}>
                <Text inverse={isCur} bold={isCur} color={item.allChecked ? "green" : "yellow"}>
                  {isCur ? " > " : "   "}
                  {item.allChecked ? "[✔]" : "[ ]"}
                  {" "}{expanded.has(item.managerIdx) ? "▼" : "▶"} {item.manager.manager.icon} {item.manager.manager.name}
                  {"  "}{item.manager.outdated.length} pkg(s){"  "}
                </Text>
              </Box>
            );
          }
          const delta = getVersionDelta(item.pkg.current, item.pkg.latest);
          return (
            <Box key={`p-${item.managerIdx}-${item.pkgIdx}`} marginLeft={filterText ? 0 : 4} flexDirection="column">
              <Box>
                <Text inverse={isCur} color={item.checked ? "green" : "gray"}>
                  {isCur ? " > " : "   "}
                  {item.checked ? "✔ " : "○ "}
                  {item.pkg.name}
                  {"  "}
                  {item.pkg.current}{" → "}
                  {item.pkg.latest}
                  {"  "}
                </Text>
                <Text bold color={deltaColor[delta]}>[{delta}]</Text>
                {filterText && <Text dimColor>  {withOutdated[item.managerIdx]?.manager.icon}</Text>}
              </Box>
              {item.pkg.path && !filterText && isCur && (
                <Box marginLeft={5}>
                  <Text dimColor>{item.pkg.path}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {showDown && (
        <Box><Text color="yellow" dimColor>  ↓ {flatItems.length - nav.scroll - VISIBLE} more below</Text></Box>
      )}

      {/* ── Footer ── */}
      <Box marginTop={1} gap={2}>
        <Text dimColor>[↑↓]/[jk]  move</Text>
        <Text dimColor>[space]  toggle</Text>
        <Text dimColor>[→]  expand</Text>
        <Text dimColor>[a]  all/none</Text>
        <Text dimColor>[/]  search</Text>
        <Text dimColor>[enter]  confirm</Text>
        <Text dimColor>[q]  back</Text>
      </Box>

    </Box>
  );
}
