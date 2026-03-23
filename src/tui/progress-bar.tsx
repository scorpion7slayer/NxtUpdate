import { Box, Text } from "ink";

interface Props {
  current: number;
  total: number;
  width?: number;
  label?: string;
}

export function ProgressBar({ current, total, width = 26, label }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const filled = total > 0 ? Math.round((current / total) * width) : 0;
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const color = pct === 100 ? "green" : pct > 60 ? "cyan" : "yellow";

  return (
    <Box gap={1}>
      <Text color={color}>[{bar}]</Text>
      <Text bold color={color}>{pct}%</Text>
      {label && <Text dimColor>{label}</Text>}
    </Box>
  );
}
