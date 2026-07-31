import { describe, expect, test } from "bun:test";
import { renderToString } from "ink";
import { MainMenu } from "../src/tui/main-menu.tsx";
import { SelectPackagesScreen } from "../src/tui/select-packages.tsx";
import {
  MoleTipScreen,
  MOLE_APP_AFFILIATE_URL,
  MOLE_CLI_URL,
} from "../src/tui/mole-tip.tsx";
import { withAlternateScreen } from "../src/tui/app.tsx";
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
});
