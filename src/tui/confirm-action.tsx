import { Box, Text, useInput } from "ink";
import type { ManagerData } from "./app.tsx";
import { KeyHints } from "./key-hints.tsx";
import { useTerminalSize } from "./use-terminal-size.ts";

interface Props {
  managers: ManagerData[];
  dryRun?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmUninstallScreen({ managers, dryRun = false, onConfirm, onBack }: Props) {
  const { columns, rows } = useTerminalSize();
  const compact = columns < 96 || rows < 28;
  const packages = managers.flatMap((manager) =>
    manager.outdated.map((pkg) => ({ manager: manager.manager.name, name: pkg.name }))
  );
  const previewLimit = Math.max(3, rows - 14);
  const preview = packages.slice(0, previewLimit);

  useInput((input, key) => {
    if (input === "y") {
      onConfirm();
      return;
    }
    if (input === "n" || input === "q" || key.escape || key.leftArrow) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={dryRun ? "yellow" : "red"}>
        {dryRun ? "⚡ Confirm uninstall dry run" : "⚠ Confirm package removal"}
      </Text>
      <Text>
        {packages.length} package(s) across {managers.length} manager(s)
        {dryRun ? " will be previewed." : " will be removed."}
      </Text>

      <Box flexDirection="column" borderStyle="single" borderColor={dryRun ? "yellow" : "red"} paddingX={1} marginTop={1}>
        {preview.map((pkg) => (
          <Text key={`${pkg.manager}-${pkg.name}`} wrap="truncate-middle">
            {pkg.manager} · {pkg.name}
          </Text>
        ))}
        {packages.length > preview.length && (
          <Text>…and {packages.length - preview.length} more</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={dryRun ? "yellow" : "red"}>
          {dryRun
            ? "No package will be removed in dry-run mode."
            : "This uses each package manager's native uninstall command."}
        </Text>
      </Box>

      <KeyHints
        compact={compact}
        hints={[
          { keys: "y", label: dryRun ? "run preview" : "uninstall" },
          { keys: "n/esc/q/←", label: "cancel" },
        ]}
      />
    </Box>
  );
}
