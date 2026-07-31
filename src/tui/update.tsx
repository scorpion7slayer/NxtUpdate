import { Box, Text, Spacer, useInput } from "ink";
import Spinner from "ink-spinner";
import { useEffect, useRef, useState } from "react";
import type { ManagerData } from "./app.tsx";
import type { CliOptions } from "../detectors/types.ts";
import { setNoSudo } from "../detectors/macos.ts";
import { getVersionDelta } from "../utils/version.ts";
import { KeyHints } from "./key-hints.tsx";
import { useTerminalSize } from "./use-terminal-size.ts";

interface Props {
  managers: ManagerData[];
  options: CliOptions;
  mode?: "update" | "uninstall";
  onDone: (completed: { managerName: string; pkgNames: string[] }[]) => void;
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

const deltaColor = { MAJOR: "red", minor: "yellow", patch: "green" } as const;

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function UpdateScreen({
  managers,
  options,
  mode = "update",
  onDone,
}: Props) {
  const { columns, rows } = useTerminalSize();
  const compact = columns < 96 || rows < 30;
  const withPackages = managers.filter((manager) => manager.outdated.length > 0);
  const started = useRef(false);

  const [tasks, setTasks] = useState<PkgTask[]>(() =>
    withPackages.flatMap((manager, managerIdx) =>
      manager.outdated.map((pkg, pkgIdx) => ({
        managerIdx,
        pkgIdx,
        name: pkg.name,
        current: pkg.current,
        latest: pkg.latest,
        status: "pending" as PkgStatus,
      }))
    )
  );
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setNoSudo(Boolean(options.noSudo));
  }, [options.noSudo]);

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      for (let managerIdx = 0; managerIdx < withPackages.length; managerIdx++) {
        const manager = withPackages[managerIdx]!;
        const packageNames = manager.outdated.map((pkg) => pkg.name);

        setTasks((previous) => previous.map((task) =>
          task.managerIdx === managerIdx
            ? { ...task, status: "running", error: undefined }
            : task
        ));

        try {
          const result = mode === "uninstall"
            ? await manager.manager.uninstall(options.dryRun, packageNames)
            : await manager.manager.update(options.dryRun, packageNames);
          setTasks((previous) => previous.map((task) =>
            task.managerIdx === managerIdx
              ? {
                  ...task,
                  status: result.success ? "done" : "failed",
                  error: result.success ? undefined : result.error ?? "Operation failed",
                }
              : task
          ));
        } catch (error) {
          setTasks((previous) => previous.map((task) =>
            task.managerIdx === managerIdx
              ? { ...task, status: "failed", error: String(error) }
              : task
          ));
        }
      }
      setFinished(true);
    })();
  }, []);

  useInput((input, key) => {
    if (finished && (key.return || key.escape || input === "q")) {
      const completed = withPackages
        .map((manager, managerIdx) => ({
          managerName: manager.manager.name,
          pkgNames: tasks
            .filter((task) => task.managerIdx === managerIdx && task.status === "done")
            .map((task) => task.name),
        }))
        .filter((result) => result.pkgNames.length > 0);
      onDone(completed);
    }
  });

  const totalPackages = tasks.length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const failCount = tasks.filter((task) => task.status === "failed").length;
  const completedCount = doneCount + failCount;
  const donePct = totalPackages > 0
    ? Math.round((completedCount / totalPackages) * 100)
    : 0;
  const focusTask = tasks.find((task) => task.status === "running")
    ?? tasks.find((task) => task.status === "pending")
    ?? tasks.at(-1);
  const focusManagerIdx = focusTask?.managerIdx ?? 0;
  const visibleManagers = compact
    ? withPackages.map((manager, managerIdx) => ({ manager, managerIdx }))
        .filter(({ managerIdx }) => managerIdx === focusManagerIdx)
    : withPackages.map((manager, managerIdx) => ({ manager, managerIdx }));
  const taskLimit = Math.max(3, rows - 16);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={options.dryRun ? "yellow" : mode === "uninstall" ? "red" : "cyan"}>
          {options.dryRun
            ? `Dry run · ${mode}`
            : mode === "uninstall"
              ? "Removing packages"
              : "Updating packages"}
        </Text>
        <Text> · {totalPackages} package(s) · {withPackages.length} manager(s)</Text>
        <Spacer />
        <Text>{formatElapsed(elapsed)}</Text>
      </Box>

      {compact && withPackages.length > 1 && (
        <Box marginBottom={1}>
          <Text>
            Manager {Math.min(focusManagerIdx + 1, withPackages.length)}/{withPackages.length}
          </Text>
        </Box>
      )}

      {visibleManagers.map(({ manager, managerIdx }) => {
        const managerTasks = tasks.filter((task) => task.managerIdx === managerIdx);
        const managerDone = managerTasks.filter((task) => task.status === "done").length;
        const managerFailed = managerTasks.filter((task) => task.status === "failed").length;
        const managerCompleted = managerDone + managerFailed;
        const managerTotal = managerTasks.length;
        const isActive = managerTasks.some((task) => task.status === "running");
        const isDone = managerCompleted === managerTotal;
        const pct = managerTotal > 0
          ? Math.round((managerCompleted / managerTotal) * 100)
          : 0;
        const color = managerFailed > 0
          ? "red"
          : isDone
            ? "green"
            : isActive
              ? "cyan"
              : "gray";
        const visibleTasks = managerTasks.slice(0, compact ? taskLimit : managerTasks.length);
        const firstError = managerTasks.find((task) => task.error)?.error;

        return (
          <Box
            key={manager.manager.name}
            flexDirection="column"
            marginBottom={1}
            borderStyle="single"
            borderColor={color}
            paddingX={1}
          >
            <Box>
              {isActive && !isDone
                ? <Text color="yellow"><Spinner type="dots" /></Text>
                : isDone
                  ? <Text color={managerFailed > 0 ? "red" : "green"}>{managerFailed > 0 ? "✖" : "✔"}</Text>
                  : <Text>○</Text>}
              <Text bold> {manager.manager.icon} {manager.manager.name}</Text>
              <Spacer />
              <Text color={color}>{pct}% · {managerCompleted}/{managerTotal}</Text>
            </Box>

            <Box flexDirection="column" marginTop={1}>
              {visibleTasks.map((task) => {
                const delta = mode === "update"
                  ? getVersionDelta(task.current, task.latest)
                  : null;
                return (
                  <Text key={`${task.managerIdx}-${task.pkgIdx}`} wrap="truncate-middle">
                    {task.status === "pending" && "○ "}
                    {task.status === "running" && "◐ "}
                    {task.status === "done" && "✔ "}
                    {task.status === "failed" && "✖ "}
                    {task.name}
                    {mode === "update" && `  ${task.current} → ${task.latest}`}
                    {delta && <Text bold color={deltaColor[delta]}> [{delta}]</Text>}
                  </Text>
                );
              })}
              {managerTasks.length > visibleTasks.length && (
                <Text>…and {managerTasks.length - visibleTasks.length} more</Text>
              )}
              {firstError && (
                <Text color="red" wrap="truncate-end">Error: {firstError}</Text>
              )}
            </Box>
          </Box>
        );
      })}

      {finished ? (
        <Box
          borderStyle="single"
          borderColor={failCount > 0 ? "red" : "green"}
          paddingX={1}
        >
          <Text color={failCount > 0 ? "yellow" : options.dryRun ? "yellow" : "green"} bold>
            {options.dryRun
              ? `Dry run complete · ${totalPackages} package(s) checked`
              : failCount > 0
                ? `${doneCount} succeeded · ${failCount} failed · ${formatElapsed(elapsed)}`
                : `${doneCount} package(s) ${mode === "uninstall" ? "removed" : "updated"} · ${formatElapsed(elapsed)}`}
          </Text>
        </Box>
      ) : (
        <Box>
          <Text>{completedCount}/{totalPackages} complete · {donePct}%</Text>
        </Box>
      )}

      {finished && (
        <KeyHints
          compact={compact}
          hints={[{ keys: "enter/esc/q", label: "back to menu" }]}
        />
      )}
    </Box>
  );
}
