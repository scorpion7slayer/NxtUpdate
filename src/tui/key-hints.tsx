import { Box, Text } from "ink";

export interface KeyHint {
  keys: string;
  label: string;
}

export function KeyHints({ hints, compact = false }: { hints: KeyHint[]; compact?: boolean }) {
  if (compact) {
    return (
      <Box marginTop={1}>
        <Text wrap="truncate-end">
          {hints.map((hint) => `[${hint.keys}] ${hint.label}`).join("  ")}
        </Text>
      </Box>
    );
  }

  return (
    <Box marginTop={1} gap={2} flexWrap="wrap">
      {hints.map((hint) => (
        <Text key={`${hint.keys}-${hint.label}`} dimColor>
          [{hint.keys}] {hint.label}
        </Text>
      ))}
    </Box>
  );
}
