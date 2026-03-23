import { Box, Text, useInput } from "ink";
import { useState, useEffect } from "react";
import type { ManagerData } from "./app.tsx";
import type { CliOptions, UpdateResult } from "../detectors/types.ts";
import { setNoSudo } from "../detectors/macos.ts";
import { ProgressBar } from "./progress-bar.tsx";

interface Props {
  managers: ManagerData[];
  options: CliOptions;
  onDone: () => void;
}

type TaskStatus = "pending" | "running" | "done" | "failed";

interface TaskState {
  manager: ManagerData;
  status: TaskStatus;
  result?: UpdateResult;
}

export function UpdateScreen({ managers, options, onDone }: Props) {
  const withOutdated = managers.filter((m) => m.outdated.length > 0);
  const totalPkgs = withOutdated.reduce((s, m) => s + m.outdated.length, 0);
  const [tasks, setTasks] = useState<TaskState[]>(
    withOutdated.map((m) => ({ manager: m, status: "pending" as TaskStatus }))
  );
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);

  if (options.noSudo) setNoSudo(true);

  useEffect(() => {
    if (started) return;
    setStarted(true);

    (async () => {
      for (let i = 0; i < withOutdated.length; i++) {
        const m = withOutdated[i]!;
        setTasks((prev: TaskState[]) =>
          prev.map((t: TaskState, idx: number) => (idx === i ? { ...t, status: "running" } : t))
        );
        try {
          const pkgNames = m.outdated.map((p) => p.name);
          const result = await m.manager.update(options.dryRun, pkgNames);
          setTasks((prev: TaskState[]) =>
            prev.map((t: TaskState, idx: number) =>
              idx === i ? { ...t, status: result.success ? "done" : "failed", result } : t
            )
          );
        } catch (err) {
          setTasks((prev: TaskState[]) =>
            prev.map((t: TaskState, idx: number) =>
              idx === i ? { ...t, status: "failed", result: { manager: m.manager.name, success: false, updated: 0, output: "", error: String(err) } } : t
            )
          );
        }
      }
      setFinished(true);
    })();
  }, []);

  useInput((input, key) => {
    if (finished && (key.return || input === "q" || key.escape)) onDone();
  });

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;
  const totalUpdated = tasks.reduce((s, t) => s + (t.result?.updated ?? 0), 0);

  // Count completed packages for progress bar
  const completedPkgs = tasks.reduce((s, t) => {
    if (t.status === "done") return s + (t.result?.updated ?? t.manager.outdated.length);
    if (t.status === "failed") return s + t.manager.outdated.length;
    return s;
  }, 0);

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{options.dryRun ? "⚡ Dry Run" : "⬆️ Updating"}</Text>
        <Text dimColor> — {totalPkgs} packages across {withOutdated.length} manager(s)</Text>
      </Box>

      {/* Progress bar */}
      <ProgressBar current={completedPkgs} total={totalPkgs} />

      {/* Tasks */}
      <Box flexDirection="column" marginTop={1}>
        {tasks.map((task: TaskState, i: number) => {
          const { manager, outdated } = task.manager;
          return (
            <Box key={i}>
              <Box width={4}>
                {task.status === "pending" && <Text dimColor>  ○</Text>}
                {task.status === "running" && <Text color="yellow">  ◐</Text>}
                {task.status === "done" && <Text color="green">  ✔</Text>}
                {task.status === "failed" && <Text color="red">  ✖</Text>}
              </Box>
              <Box>
                <Text bold={task.status === "running"}>
                  {manager.icon} {manager.name}
                </Text>
                <Text dimColor> ({outdated.length})</Text>
              </Box>
              {task.result && (
                <Box marginLeft={1}>
                  {task.result.success ? (
                    <Text color="green" dimColor> — {task.result.updated} updated</Text>
                  ) : (
                    <Text color="red" dimColor> — {task.result.error?.slice(0, 60) ?? "failed"}</Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Summary */}
      {finished && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
          {options.dryRun ? (
            <Text color="yellow">⚡ Dry run — {totalPkgs} package(s) would be updated</Text>
          ) : (
            <Box flexDirection="column">
              {/* Successful packages */}
              {tasks.filter((t) => t.status === "done").map((t, i) => (
                <Box key={`ok-${i}`} flexDirection="column">
                  <Text color="green">{t.manager.manager.icon} {t.manager.manager.name}</Text>
                  {t.manager.outdated.map((p, j) => (
                    <Box key={j} marginLeft={2}>
                      <Text color="green">✔ {p.name}</Text>
                      <Text dimColor> {p.current}</Text>
                      <Text color="yellow"> → </Text>
                      <Text color="green">{p.latest}</Text>
                    </Box>
                  ))}
                </Box>
              ))}
              {/* Failed packages */}
              {tasks.filter((t) => t.status === "failed").map((t, i) => (
                <Box key={`fail-${i}`} flexDirection="column">
                  <Text color="red">{t.manager.manager.icon} {t.manager.manager.name}</Text>
                  {t.result?.error && <Box marginLeft={2}><Text dimColor>{t.result.error.slice(0, 80)}</Text></Box>}
                  {t.manager.outdated.map((p, j) => (
                    <Box key={j} marginLeft={2}>
                      <Text color="red">✖ {p.name}</Text>
                      <Text dimColor> {p.current}</Text>
                      <Text color="yellow"> → </Text>
                      <Text dimColor>{p.latest}</Text>
                    </Box>
                  ))}
                </Box>
              ))}
              {totalUpdated === 0 && failedCount === 0 && <Text color="green">🎉 Everything up to date!</Text>}
            </Box>
          )}
          <Box marginTop={1}><Text dimColor>Press enter/q to go back</Text></Box>
        </Box>
      )}
    </Box>
  );
}
