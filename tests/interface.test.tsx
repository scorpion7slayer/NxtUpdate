import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render, renderToString } from "ink";
import { isMenuActionDisabled, MainMenu } from "../src/tui/main-menu.tsx";
import { ListScreen } from "../src/tui/list-screen.tsx";
import { SelectPackagesScreen } from "../src/tui/select-packages.tsx";
import {
  MoleTipScreen,
  MOLE_APP_AFFILIATE_URL,
  MOLE_CLI_URL,
} from "../src/tui/mole-tip.tsx";
import { withAlternateScreen } from "../src/tui/app.tsx";
import { normalizeProgressMessage, UpdateScreen } from "../src/tui/update.tsx";
import { exec } from "../src/utils/exec.ts";
import type { ManagerData } from "../src/tui/app.tsx";
import type { PackageManager } from "../src/detectors/types.ts";

const manager: PackageManager = {
  name: "Homebrew",
  command: "brew",
  icon: "B",
  async detect() { return true; },
  async listOutdated() { return []; },
  async listInstalled() { return []; },
  async update() {
    return { manager: "Homebrew", success: true, updated: 0, output: "" };
  },
  async uninstall() {
    return { manager: "Homebrew", success: true, updated: 0, output: "" };
  },
};

const managers: ManagerData[] = [{
  manager,
  outdated: [
    { name: "alpha-package", current: "1.0.0", latest: "2.0.0" },
    { name: "beta-package", current: "2.1.0", latest: "2.2.0" },
  ],
}];

function expectWithinWidth(output: string, columns: number) {
  for (const line of output.split("\n")) {
    expect(Bun.stringWidth(line)).toBeLessThanOrEqual(columns);
  }
}

function expectWithinRows(output: string, rows: number) {
  expect(output.split("\n").length).toBeLessThanOrEqual(rows);
}

describe("terminal interface", () => {
  test("keeps Mole CLI instructions and labels the application affiliate link", () => {
    const output = renderToString(<MoleTipScreen onBack={() => {}} />, { columns: 80 });

    expect(output).toContain("brew install mole");
    expect(output).toContain("Mole CLI — run:");
    expect(output).toContain("mole");
    expect(output).toContain("affiliate link");
    expect(output).toContain(MOLE_APP_AFFILIATE_URL);
    expect(output).toContain(MOLE_CLI_URL);
    expectWithinWidth(output, 80);
    expectWithinRows(output, 24);
  });

  test("renders the compact main menu inside 80 columns", () => {
    const output = renderToString(
      <MainMenu
        managers={managers}
        options={{}}
        updateInfo={null}
        selected={0}
        onSelectionChange={() => {}}
        onStartUpdate={() => {}}
        onUninstall={() => {}}
        onViewList={() => {}}
        onViewMoleTip={() => {}}
      />,
      { columns: 80 }
    );

    expect(output).toContain("Actions");
    expect(output).toContain("2 outdated across 1 manager(s)");
    expectWithinWidth(output, 80);
    expectWithinRows(output, 24);
  });

  test("distinguishes skipped managers from up-to-date managers", () => {
    const skippedManager: PackageManager = {
      ...manager,
      name: "Python (pip)",
      command: "pip3",
      icon: "P",
      skipReason: "externally managed (PEP 668)",
    };
    const output = renderToString(
      <MainMenu
        managers={[{ manager: skippedManager, outdated: [] }]}
        options={{}}
        updateInfo={null}
        selected={1}
        onSelectionChange={() => {}}
        onStartUpdate={() => {}}
        onUninstall={() => {}}
        onViewList={() => {}}
        onViewMoleTip={() => {}}
      />,
      { columns: 80 },
    );

    expect(output).toContain("No actionable updates");
    expect(output).toContain("Python (pip) skipped · externally managed (PEP 668)");
    expect(output).not.toContain("Everything is up to date");
    expect(output).not.toContain("unavailable");
    expectWithinWidth(output, 80);
    expectWithinRows(output, 24);
  });

  test("keeps the outdated list available when there are no actionable updates", () => {
    expect(isMenuActionDisabled("update", 0)).toBe(true);
    expect(isMenuActionDisabled("list", 0)).toBe(false);

    const skippedManager: PackageManager = {
      ...manager,
      name: "Python (pip)",
      command: "pip3",
      icon: "P",
      skipReason: "externally managed (PEP 668)",
    };
    const output = renderToString(
      <ListScreen
        managers={[{ manager: skippedManager, outdated: [] }]}
        onBack={() => {}}
      />,
      { columns: 80 },
    );

    expect(output).toContain("No actionable updates");
    expect(output).toContain("Python (pip) skipped · externally managed (PEP 668)");
    expect(output).not.toContain("Everything is up to date");
    expect(output).toContain("[esc/q] back");
    expect(output).not.toContain("[↑↓/jk] move");
    expectWithinWidth(output, 80);
    expectWithinRows(output, 24);
  });

  test("keeps mixed outdated and skipped results inside 80 by 24", () => {
    const skippedManager: PackageManager = {
      ...manager,
      name: "Python (pip)",
      command: "pip3",
      icon: "P",
      skipReason: "externally managed (PEP 668)",
    };
    const manyPackages: ManagerData = {
      manager,
      outdated: Array.from({ length: 20 }, (_, index) => ({
        name: `package-${index}`,
        current: "1.0.0",
        latest: "1.1.0",
      })),
    };
    const output = renderToString(
      <ListScreen
        managers={[manyPackages, { manager: skippedManager, outdated: [] }]}
        onBack={() => {}}
      />,
      { columns: 80 },
    );

    expect(output).toContain("20 across 1 manager(s)");
    expect(output).toContain("Python (pip) skipped");
    expect(output).toContain("more below");
    expectWithinWidth(output, 80);
    expectWithinRows(output, 24);
  });

  test("starts destructive package selection empty", () => {
    const output = renderToString(
      <SelectPackagesScreen
        managers={managers}
        title="Select packages to uninstall"
        mode="uninstall"
        onConfirm={() => {}}
        onBack={() => {}}
      />,
      { columns: 80 }
    );

    expect(output).toContain("0/2 selected");
    expect(output).toContain("□");
    expectWithinWidth(output, 80);
    expectWithinRows(output, 24);
  });

  test("restores destructive selection after cancelling confirmation", () => {
    const output = renderToString(
      <SelectPackagesScreen
        managers={managers}
        title="Select packages to uninstall"
        mode="uninstall"
        initialSelected={[{ manager, outdated: [managers[0]!.outdated[0]!] }]}
        onConfirm={() => {}}
        onBack={() => {}}
      />,
      { columns: 80 }
    );

    expect(output).toContain("1/2 selected");
    expect(output).toContain("◩");
    expectWithinWidth(output, 80);
    expectWithinRows(output, 24);
  });

  test("restores the terminal after the interface exits or fails", async () => {
    const normalWrites: string[] = [];
    await withAlternateScreen(
      async () => {},
      (value) => normalWrites.push(value),
    );
    expect(normalWrites).toEqual([
      "\x1b[?1049h\x1b[H\x1b[2J",
      "\x1b[?1049l",
    ]);

    const failureWrites: string[] = [];
    await expect(withAlternateScreen(
      async () => {
        throw new Error("render failed");
      },
      (value) => failureWrites.push(value),
    )).rejects.toThrow("render failed");
    expect(failureWrites.at(-1)).toBe("\x1b[?1049l");
  });

  test("does not keep the interactive development command under a watcher", async () => {
    const packageJson = await Bun.file(
      new URL("../package.json", import.meta.url),
    ).json() as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.dev).toBe("bun run src/cli.ts");
    expect(packageJson.scripts?.dev).not.toContain("--watch");
  });

  test("normalizes native updater output before rendering it", () => {
    expect(normalizeProgressMessage("\u001b[32mDownloading  42%\u001b[0m\r"))
      .toBe("Downloading 42%");
  });

  test("streams carriage-return progress before the updater command finishes", async () => {
    const lines: string[] = [];
    let resolveFirstLine!: () => void;
    const firstLine = new Promise<void>((resolve) => {
      resolveFirstLine = resolve;
    });
    let finished = false;

    const running = exec([
      process.execPath,
      "-e",
      'process.stdout.write("Downloading 10%\\r"); await Bun.sleep(100); process.stdout.write("Installing\\n")',
    ], {
      onLine: (line) => {
        lines.push(line);
        if (lines.length === 1) resolveFirstLine();
      },
    }).finally(() => {
      finished = true;
    });

    await firstLine;
    expect(finished).toBe(false);
    expect(lines).toEqual(["Downloading 10%"]);

    const result = await running;
    expect(result.exitCode).toBe(0);
    expect(lines).toEqual(["Downloading 10%", "Installing"]);
  });

  test("renders native updater activity before a batched update finishes", async () => {
    const stdout = new PassThrough() as PassThrough & NodeJS.WriteStream;
    Object.assign(stdout, { columns: 80, rows: 24, isTTY: false });
    const stdin = new PassThrough() as PassThrough & NodeJS.ReadStream;
    Object.assign(stdin, {
      isTTY: true,
      isRaw: false,
      setRawMode(value: boolean) {
        this.isRaw = value;
        return this;
      },
      ref() { return this; },
      unref() { return this; },
    });

    let finishUpdate!: (result: Awaited<ReturnType<PackageManager["update"]>>) => void;
    const updateFinished = new Promise<Awaited<ReturnType<PackageManager["update"]>>>((resolve) => {
      finishUpdate = resolve;
    });
    let managerFinished = false;
    const liveManager: PackageManager = {
      ...manager,
      async update(_dryRun, _packages, onProgress) {
        onProgress?.("\u001b[36mDownloading alpha-package 42%\u001b[0m\r");
        const result = await updateFinished;
        managerFinished = true;
        return result;
      },
    };

    let resolveLiveFrame!: (frame: string) => void;
    const liveFrame = new Promise<string>((resolve) => {
      resolveLiveFrame = resolve;
    });
    let resolveCompletedFrame!: (frame: string) => void;
    const completedFrame = new Promise<string>((resolve) => {
      resolveCompletedFrame = resolve;
    });
    stdout.on("data", (chunk) => {
      const frame = chunk.toString();
      if (frame.includes("Downloading alpha-package 42%")) resolveLiveFrame(frame);
      if (frame.includes("1 package(s) updated")) resolveCompletedFrame(frame);
    });

    const instance = render(
      <UpdateScreen
        managers={[{
          manager: liveManager,
          outdated: [{ name: "alpha-package", current: "1.0.0", latest: "2.0.0" }],
        }]}
        options={{}}
        onDone={() => {}}
      />,
      { stdout, stdin, debug: true, patchConsole: false },
    );

    try {
      const activeFrame = await liveFrame;
      expect(managerFinished).toBe(false);
      expect(activeFrame).toContain("working · 1 package(s)");
      expect(activeFrame).toContain("NxtUpdate is still working");
      expect(activeFrame).toContain("0/1 package(s) finished");
      expectWithinWidth(activeFrame, 80);
      expectWithinRows(activeFrame, 24);

      finishUpdate({ manager: "Homebrew", success: true, updated: 1, output: "" });
      const finalFrame = await completedFrame;
      expect(managerFinished).toBe(true);
      expect(finalFrame).toContain("1 package(s) updated");
    } finally {
      instance.unmount();
      instance.cleanup();
    }
  });
});
