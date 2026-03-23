import { Box, Text, Spacer, useInput } from "ink";
import Spinner from "ink-spinner";
import { useState, useEffect } from "react";
import type { ManagerData } from "./app.tsx";
import type { CliOptions } from "../detectors/types.ts";
import { setNoSudo } from "../detectors/macos.ts";
import { getVersionDelta } from "../utils/version.ts";

interface Props {
  managers: ManagerData[];
  options: CliOptions;
  onDone: (updated: { managerName: string; pkgNames: string[] }[]) => void;
}

type PkgStatus = "pending" | "running" | "done" | "failed";

interface PkgTask {
  managerIdx: number;
  pkgIdx: number;
  name: string;
  current: string;
  latest: string;
  status: PkgStatus;
  error?: string;
}

interface ManagerGroup {
  manager: ManagerData;
  managerIdx: number;
}

const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function UpdateScreen({ managers, options, onDone }: Props) {
  const withOutdated = managers.filter((m) => m.outdated.length > 0);

  // Flat list of all individual package tasks
  const [tasks, setTasks] = useState<PkgTask[]>(() =>
    withOutdated.flatMap((m, mi) =>
      m.outdated.map((pkg, pi) => ({
        managerIdx: mi, pkgIdx: pi,
        name: pkg.name, current: pkg.current, latest: pkg.latest,
        status: "pending" as PkgStatus,
      }))
    )
  );

  const groups: ManagerGroup[] = withOutdated.map((m, mi) => ({ manager: m, managerIdx: mi }));

  const [finished, setFinished] = useState(false);
  const [started,  setStarted]  = useState(false);
  const [elapsed,  setElapsed]  = useState(0);

  if (options.noSudo) setNoSudo(true);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Run updates — one package at a time
  useEffect(() => {
    if (started) return;
    setStarted(true);

    (async () => {
      for (let mi = 0; mi < withOutdated.length; mi++) {
        const m = withOutdated[mi]!;
        for (let pi = 0; pi < m.outdated.length; pi++) {
          const pkg = m.outdated[pi]!;

          // Mark running
          setTasks((prev) => prev.map((t) =>
            t.managerIdx === mi && t.pkgIdx === pi ? { ...t, status: "running" } : t
          ));

          try {
            const result = await m.manager.update(options.dryRun, [pkg.name]);
            setTasks((prev) => prev.map((t) =>
              t.managerIdx === mi && t.pkgIdx === pi
                ? { ...t, status: result.success ? "done" : "failed", error: result.error }
                : t
            ));
          } catch (err) {
            setTasks((prev) => prev.map((t) =>
              t.managerIdx === mi && t.pkgIdx === pi
                ? { ...t, status: "failed", error: String(err) }
                : t
            ));
          }
        }
      }
      setFinished(true);
    })();
  }, []);

  useInput((input, key) => {
    if (finished && (key.return || input === "q" || key.escape)) {
      const updated = withOutdated
        .map((m, mi) => ({
          managerName: m.manager.name,
          pkgNames: tasks.filter((t) => t.managerIdx === mi && t.status === "done").map((t) => t.name),
        }))
        .filter((x) => x.pkgNames.length > 0);
      onDone(updated);
    }
  });

  const totalPkgs  = tasks.length;
  const doneCount  = tasks.filter((t) => t.status === "done").length;
  const failCount  = tasks.filter((t) => t.status === "failed").length;
  const donePct    = totalPkgs > 0 ? Math.round(((doneCount + failCount) / totalPkgs) * 100) : 0;

  return (
    <Box flexDirection="column" paddingX={1}>

      {/* ── Header ── */}
      <Box marginBottom={1}>
        <Text bold color={options.dryRun ? "yellow" : "cyan"}>
          {options.dryRun ? "⚡ Dry Run" : "⬆️  Updating"}
        </Text>
        <Text dimColor> — {totalPkgs} package(s) across {withOutdated.length} manager(s)</Text>
        <Spacer />
        <Text dimColor>{formatElapsed(elapsed)}</Text>
      </Box>

      {/* ── Per-manager groups ── */}
      {groups.map(({ manager, managerIdx }) => {
        const mgTasks = tasks.filter((t) => t.managerIdx === managerIdx);
        const mgDone  = mgTasks.filter((t) => t.status === "done").length;
        const mgFail  = mgTasks.filter((t) => t.status === "failed").length;
        const mgTotal = mgTasks.length;
        const isActive = mgTasks.some((t) => t.status === "running");
        const isDone   = mgDone + mgFail === mgTotal;
        const pct      = mgTotal > 0 ? Math.round(((mgDone + mgFail) / mgTotal) * 100) : 0;
        const barWidth = 16;
        const filled   = Math.round((pct / 100) * barWidth);
        const bar      = "█".repeat(filled) + "░".repeat(barWidth - filled);
        const barColor = mgFail > 0 ? "red" : isDone ? "green" : isActive ? "cyan" : "gray";

        return (
          <Box key={managerIdx} flexDirection="column" marginBottom={1}
               borderStyle="round"
               borderColor={mgFail > 0 ? "red" : isDone ? "green" : isActive ? "cyan" : "gray"}
               paddingX={1}>

            {/* Manager header row */}
            <Box marginBottom={1}>
              {isActive && !isDone
                ? <Text color="yellow"><Spinner type="dots" /></Text>
                : isDone
                  ? <Text color={mgFail > 0 ? "red" : "green"}>{mgFail > 0 ? "✖" : "✔"}</Text>
                  : <Text dimColor>○</Text>}
              <Text bold color={isActive ? "cyan" : isDone ? (mgFail > 0 ? "red" : "green") : "white"}>
                {" "}{manager.manager.icon} {manager.manager.name}
              </Text>
              <Spacer />
              <Text color={barColor}>[{bar}]</Text>
              <Text bold color={barColor}> {pct}%</Text>
              <Text dimColor>  {mgDone + mgFail}/{mgTotal}</Text>
            </Box>

            {/* Individual packages */}
            {mgTasks.map((task, i) => {
              const delta = getVersionDelta(task.current, task.latest);
              return (
                <Box key={i} marginLeft={2}>
                  {/* Status icon */}
                  <Box width={3}>
                    {task.status === "pending" && <Text dimColor>○ </Text>}
                    {task.status === "running" && <Text color="yellow"><Spinner type="dots" /></Text>}
                    {task.status === "done"    && <Text color="green">✔ </Text>}
                    {task.status === "failed"  && <Text color="red">✖ </Text>}
                  </Box>

                  {/* Package name */}
                  <Text
                    bold={task.status === "running"}
                    color={task.status === "done" ? "green" : task.status === "failed" ? "red" : task.status === "running" ? "white" : "gray"}
                  >
                    {task.name}
                  </Text>

                  {/* Version */}
                  <Text dimColor>  {task.current} → </Text>
                  <Text color={task.status === "done" ? "green" : "white"}>{task.latest}</Text>
                  <Text bold color={deltaColor[delta]}> [{delta}]</Text>

                  {/* Error inline */}
                  {task.error && (
                    <Text color="red" dimColor>  {task.error.slice(0, 40)}</Text>
                  )}
                </Box>
              );
            })}

          </Box>
        );
      })}

      {/* ── Footer ── */}
      {finished ? (
        <Box borderStyle="round" borderColor={failCount > 0 ? "red" : "green"} paddingX={1} marginTop={1}>
          <Box flexDirection="column">
            {options.dryRun ? (
              <Text color="yellow">⚡ Dry run — {totalPkgs} package(s) would be updated</Text>
            ) : (
              <Text color={failCount > 0 ? "yellow" : "green"} bold>
                {failCount > 0
                  ? `⚠ ${doneCount} updated, ${failCount} failed — ${formatElapsed(elapsed)}`
                  : `✔ ${doneCount} package(s) updated in ${formatElapsed(elapsed)}`}
              </Text>
            )}
            <Box marginTop={1}>
              <Text dimColor>enter / q  →  back to menu</Text>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor bold>{doneCount + failCount}/{totalPkgs}</Text>
          <Text dimColor> packages done  ({donePct}% overall)</Text>
        </Box>
      )}

    </Box>
  );
}
