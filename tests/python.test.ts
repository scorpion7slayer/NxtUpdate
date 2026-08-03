import { describe, expect, test } from "bun:test";
import { createPythonManager, isExternallyManagedPipResult } from "../src/detectors/python.ts";
import type { ExecOptions } from "../src/utils/exec.ts";

type CommandResult = { stdout: string; stderr: string; exitCode: number };

describe("Python package manager", () => {
  test("does not offer or mutate packages in an externally managed environment", async () => {
    const calls: string[][] = [];
    const execute = async (command: string[]): Promise<CommandResult> => {
      calls.push(command);
      return {
        stdout: "",
        stderr: "error: externally-managed-environment\nThis environment is externally managed",
        exitCode: 1,
      };
    };
    const manager = createPythonManager({ execute, findPip: () => "fake-pip" });

    expect(await manager.detect()).toBe(true);
    expect(manager.skipReason).toContain("PEP 668");
    expect(await manager.listOutdated()).toEqual([]);
    expect(await manager.listInstalled()).toEqual([]);

    const update = await manager.update(false, ["pip"]);
    const uninstall = await manager.uninstall(false, ["demo"]);
    expect(update).toMatchObject({ success: false, updated: 0 });
    expect(update.error).toContain("PEP 668");
    expect(uninstall).toMatchObject({ success: false, updated: 0 });
    expect(calls).toEqual([[
      "fake-pip",
      "install",
      "--dry-run",
      "--no-index",
      "--disable-pip-version-check",
      "pip",
    ]]);
    expect(calls.flat()).not.toContain("--break-system-packages");
  });

  test("keeps mutable pip environments fully functional", async () => {
    const calls: string[][] = [];
    const progress: string[] = [];
    const execute = async (command: string[], options?: ExecOptions): Promise<CommandResult> => {
      calls.push(command);
      if (command.includes("--dry-run")) {
        return { stdout: "Requirement already satisfied: pip", stderr: "", exitCode: 0 };
      }
      if (command.includes("--outdated")) {
        return {
          stdout: '[{"name":"demo","version":"1.0.0","latest_version":"2.0.0"}]',
          stderr: "",
          exitCode: 0,
        };
      }
      options?.onLine?.("Downloading demo 50%");
      return { stdout: "Successfully installed demo", stderr: "", exitCode: 0 };
    };
    const manager = createPythonManager({ execute, findPip: () => "fake-pip" });

    expect(await manager.listOutdated()).toEqual([
      { name: "demo", current: "1.0.0", latest: "2.0.0" },
    ]);
    expect(await manager.update(true, ["demo"])).toMatchObject({ success: true, updated: 1 });
    expect(calls.some((command) => command.includes("--upgrade"))).toBe(false);

    const result = await manager.update(false, ["demo"], (line) => progress.push(line));
    expect(result).toMatchObject({ success: true, updated: 1 });
    expect(progress).toEqual([
      "Downloading and installing 1 Python package(s)…",
      "Downloading demo 50%",
    ]);
    expect(calls.at(-1)).toEqual(["fake-pip", "install", "--upgrade", "demo"]);
  });

  test("does not misclassify unrelated pip failures as PEP 668", () => {
    expect(isExternallyManagedPipResult({
      stdout: "",
      stderr: "ERROR: No matching distribution found",
      exitCode: 1,
    })).toBe(false);

    expect(isExternallyManagedPipResult({
      stdout: "This environment is externally managed",
      stderr: "",
      exitCode: 0,
    })).toBe(false);
  });
});
