import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { KeyHints } from "./key-hints.tsx";
import { useTerminalSize } from "./use-terminal-size.ts";

export const MOLE_APP_AFFILIATE_URL = "https://mole.fit/?atp=SCo7Qr4nXn";
export const MOLE_CLI_URL = "https://github.com/tw93/Mole";

type LinkState = "idle" | "opening" | "opened" | "error";

export function MoleTipScreen({ onBack }: { onBack: () => void }) {
  const { columns, rows } = useTerminalSize();
  const [linkState, setLinkState] = useState<LinkState>("idle");
  const compact = columns < 96 || rows < 28;

  const openMoleApp = async () => {
    if (linkState === "opening") return;
    setLinkState("opening");
    try {
      const process = Bun.spawn(["open", MOLE_APP_AFFILIATE_URL], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      });
      setLinkState((await process.exited) === 0 ? "opened" : "error");
    } catch {
      setLinkState("error");
    }
  };

  useInput((input, key) => {
    if (key.escape || input === "q" || key.leftArrow) {
      onBack();
      return;
    }
    if (key.return || key.rightArrow || input === "o") {
      void openMoleApp();
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">🐹 Uninstall macOS apps with Mole</Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text wrap="wrap">
          Mole uninstalls .app bundles and cleans their related files (caches, preferences, and logs).
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Mole CLI — install:</Text>
          <Text color="cyan">  brew install mole</Text>
          <Text bold>Mole CLI — run:</Text>
          <Text color="cyan">  mole</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Mole application website (affiliate link):</Text>
          <Text color="cyan" wrap="truncate-end">  {MOLE_APP_AFFILIATE_URL}</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Mole CLI source:</Text>
          <Text color="cyan" wrap="truncate-end">  {MOLE_CLI_URL}</Text>
        </Box>
      </Box>

      {linkState === "opening" && (
        <Box marginTop={1}><Text color="yellow">Opening Mole application website…</Text></Box>
      )}
      {linkState === "opened" && (
        <Box marginTop={1}><Text color="green">✔ Mole application website opened in your browser.</Text></Box>
      )}
      {linkState === "error" && (
        <Box marginTop={1}><Text color="red">✖ Could not open the browser. Copy the URL above.</Text></Box>
      )}

      <KeyHints
        compact={compact}
        hints={[
          { keys: "enter/o/→", label: "open app" },
          { keys: "esc/q/←", label: "back" },
        ]}
      />
    </Box>
  );
}
